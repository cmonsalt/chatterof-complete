import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function InboxView({ modelId }) {
  const [allContent, setAllContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewMedia, setPreviewMedia] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllContent()
  }, [modelId])

  const loadAllContent = async () => {
    setLoading(true)
    try {
      // INBOX = TODO el contenido del model
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAllContent(data || [])
    } catch (error) {
      console.error('Error loading content:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`¿Eliminar "${item.title}" permanentemente? Esta acción no se puede deshacer y lo quitará de Sessions/Singles también.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      alert('✅ Eliminado permanentemente')
      loadAllContent()

    } catch (error) {
      console.error('Error deleting:', error)
      alert('Error: ' + error.message)
    }
  }

  const getItemBadges = (item) => {
    const badges = []
    
    if (item.session_id) {
      badges.push({
        label: '📁 Session',
        color: 'bg-purple-100 text-purple-800'
      })
    }
    
    if (item.is_single) {
      badges.push({
        label: '💎 Single',
        color: 'bg-green-100 text-green-800'
      })
    }

    if (badges.length === 0) {
      badges.push({
        label: '⚪ Sin organizar',
        color: 'bg-gray-100 text-gray-600'
      })
    }

    return badges
  }

  const filteredContent = searchTerm 
    ? allContent.filter(item => 
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : allContent

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              📥 Inbox - Content Library
            </h3>
            <p className="text-gray-600">
              TODO tu contenido está aquí permanentemente. Organízalo en Sessions/Singles desde el tab <strong>Catalog</strong>, pero siempre estará disponible aquí para enviar manualmente.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
            📚 {allContent.length} items totales
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-semibold">
            📁 {allContent.filter(i => i.session_id).length} en Sessions
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
            💎 {allContent.filter(i => i.is_single).length} Singles
          </span>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-semibold">
            ⚪ {allContent.filter(i => !i.session_id && !i.is_single).length} sin organizar
          </span>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por título o keywords..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Content Grid */}
      {filteredContent.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">
            {searchTerm ? '🔍' : '📭'}
          </div>
          <p className="text-gray-500 text-lg font-semibold">
            {searchTerm ? 'No se encontraron resultados' : 'Inbox vacío'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {searchTerm ? 'Intenta con otros términos' : 'Envía contenido a tu vault fan para que aparezca aquí'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredContent.map(item => {
            const badges = getItemBadges(item)
            
            return (
              <div
                key={item.id}
                className="relative border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all group"
              >
                {/* Thumbnail */}
                <div 
                  className="aspect-square bg-gray-100 cursor-pointer"
                  onClick={() => setPreviewMedia(item)}
                >
                  {item.media_thumb ? (
                    <img
                      src={item.media_thumb}
                      alt={item.title || 'Media'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                      {item.file_type === 'video' ? '🎥' : '📷'}
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                    <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all">
                      👁️ Preview
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(item)}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="Eliminar permanentemente"
                >
                  🗑️
                </button>

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {badges.map((badge, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                {/* Info */}
                <div className="p-3 bg-white">
                  <p className="text-sm font-semibold text-gray-900 truncate mb-1">
                    {item.title || 'Untitled'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{item.file_type === 'video' ? '🎥' : '📷'}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  {item.base_price > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-semibold text-green-600">
                        ${item.base_price}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">💡 Cómo funciona:</p>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• <strong>Inbox</strong> = Biblioteca completa de contenido (siempre disponible)</p>
          <p>• <strong>Catalog → Sessions</strong> = Organizar en guiones para que la IA use</p>
          <p>• <strong>Catalog → Singles</strong> = Marcar para venta directa con keywords</p>
          <p>• <strong>Chatter manual</strong> = Busca aquí en Inbox y envía sin IA</p>
          <p>• <strong>🗑️ Delete</strong> = Elimina permanentemente (de todo)</p>
        </div>
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <MediaPreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
          onDelete={() => {
            handleDelete(previewMedia)
            setPreviewMedia(null)
          }}
        />
      )}

    </div>
  )
}

// Modal de preview mejorado
function MediaPreviewModal({ media, onClose, onDelete }) {
  const badges = []
  if (media.session_id) badges.push('📁 En Session: ' + media.session_name)
  if (media.is_single) badges.push('💎 Marcado como Single')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{media.title || 'Preview'}</h3>
            <p className="text-sm text-blue-100">
              {media.file_type === 'video' ? '🎥 Video' : '📷 Photo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {media.file_type === 'video' ? (
            <video
              src={media.r2_url || media.media_url}
              controls
              className="w-full rounded-lg mb-4"
            >
              Your browser doesn't support video
            </video>
          ) : (
            <img
              src={media.media_url || media.media_thumb}
              alt={media.title}
              className="w-full rounded-lg mb-4"
            />
          )}

          {/* Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>Tipo:</strong> {media.file_type}</p>
            <p><strong>Creado:</strong> {new Date(media.created_at).toLocaleString()}</p>
            <p><strong>ID:</strong> {media.of_media_id}</p>
            {media.base_price > 0 && (
              <p><strong>Precio:</strong> ${media.base_price}</p>
            )}
            {badges.length > 0 && (
              <div>
                <strong>Organización:</strong>
                <div className="mt-1 space-y-1">
                  {badges.map((badge, i) => (
                    <div key={i} className="text-xs text-gray-600">• {badge}</div>
                  ))}
                </div>
              </div>
            )}
            {media.keywords && media.keywords.length > 0 && (
              <div>
                <strong>Keywords:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {media.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-4 flex gap-2">
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            🗑️ Delete Permanently
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
