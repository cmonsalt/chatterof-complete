import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function InboxView({ modelId }) {
  const [inboxItems, setInboxItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewMedia, setPreviewMedia] = useState(null)

  useEffect(() => {
    loadInbox()
  }, [modelId])

  const loadInbox = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .eq('status', 'inbox')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInboxItems(data || [])
    } catch (error) {
      console.error('Error loading inbox:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              📥 Inbox - Content Library
            </h3>
            <p className="text-gray-600 mb-4">
              Todo el contenido que envías al vault fan aparece aquí. Para organizarlo en Sessions o Singles, ve a la tab <strong>Catalog</strong>.
            </p>
            <div className="flex gap-4 text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                {inboxItems.length} items disponibles
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {inboxItems.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg font-semibold">Inbox vacío</p>
          <p className="text-gray-400 text-sm mt-2">
            Envía contenido a tu vault fan para que aparezca aquí
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {inboxItems.map(item => (
            <div
              key={item.id}
              className="relative border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer"
              onClick={() => setPreviewMedia(item)}
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-gray-100">
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
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all flex items-center justify-center">
                <span className="text-white text-sm font-semibold opacity-0 hover:opacity-100 transition-all">
                  👁️ Preview
                </span>
              </div>

              {/* Info */}
              <div className="p-3 bg-white">
                <p className="text-sm font-semibold text-gray-900 truncate mb-1">
                  {item.title || 'Untitled'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{item.file_type === 'video' ? '🎥' : '📷'}</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">💡 Para organizar este contenido:</p>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Ve a la tab <strong>Catalog</strong></p>
          <p>• Click en <strong>"Create Session"</strong> para crear guiones multi-parte</p>
          <p>• O usa el SessionManager para seleccionar medias del Inbox</p>
        </div>
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <MediaPreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      )}

    </div>
  )
}

// Modal de preview
function MediaPreviewModal({ media, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        
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

        <div className="p-4 max-h-[70vh] overflow-auto">
          {media.file_type === 'video' ? (
            <video
              src={media.media_url}
              controls
              className="w-full rounded-lg"
            >
              Your browser doesn't support video
            </video>
          ) : (
            <img
              src={media.media_url || media.media_thumb}
              alt={media.title}
              className="w-full rounded-lg"
            />
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-3">
            <p><strong>Tipo:</strong> {media.file_type}</p>
            <p><strong>Creado:</strong> {new Date(media.created_at).toLocaleString()}</p>
            <p><strong>ID:</strong> {media.of_media_id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
