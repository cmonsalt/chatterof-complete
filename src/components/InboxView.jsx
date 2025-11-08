import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function InboxView({ modelId }) {
  const [inboxItems, setInboxItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingMedia, setViewingMedia] = useState(null)

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

  const handleViewMedia = (item) => {
    setViewingMedia(item)
  }

  const handleOrganize = (item) => {
    // TODO: Abrir modal para organizar
    alert('Función de organizar - próximamente')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">📥 Inbox</h2>
        <p className="text-sm text-gray-600">
          Contenido capturado del vault fan. Organízalo para que la IA lo use.
        </p>
      </div>

      {inboxItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-600">
            No hay contenido en inbox.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Envía contenido desde OnlyFans al vault fan para que aparezca aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {inboxItems.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-100">
                {item.file_type === 'video' ? (
                  <video
                    src={item.r2_url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={item.r2_url || item.media_thumb}
                    alt={item.of_media_id}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {item.file_type === 'video' ? '🎥' : '📸'}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-2">
                  ID: {item.of_media_id}
                </p>

                {/* Botones */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleViewMedia(item)}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    👁️ Ver completo
                  </button>
                  <button
                    onClick={() => handleOrganize(item)}
                    className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    📝 Organizar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para ver media completo */}
      {viewingMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {viewingMedia.file_type === 'video' ? '🎥 Video' : '📸 Photo'}
                </h3>
                <p className="text-sm text-purple-100">
                  ID: {viewingMedia.of_media_id}
                </p>
              </div>
              <button
                onClick={() => setViewingMedia(null)}
                className="text-white hover:bg-white/20 rounded-lg p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto">
              {viewingMedia.file_type === 'video' ? (
                <video
                  src={viewingMedia.r2_url}
                  controls
                  className="w-full rounded-lg"
                  autoPlay
                >
                  Your browser doesn't support video
                </video>
              ) : (
                <img
                  src={viewingMedia.r2_url}
                  alt={viewingMedia.of_media_id}
                  className="w-full rounded-lg"
                />
              )}
            </div>

            <div className="border-t p-4 flex gap-2">
              <button
                onClick={() => handleOrganize(viewingMedia)}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
              >
                📝 Organizar este contenido
              </button>
              <button
                onClick={() => setViewingMedia(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}