import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function InboxView({ modelId, onContentOrganized }) {
  const [inboxItems, setInboxItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [previewMedia, setPreviewMedia] = useState(null)
  const [processingAction, setProcessingAction] = useState(null)

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

  const toggleSelect = (itemId) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const selectAll = () => {
    if (selectedItems.size === inboxItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(inboxItems.map(item => item.id)))
    }
  }

  const handleMarkAsSingle = async () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un item')
      return
    }

    setProcessingAction('single')
    try {
      const updates = Array.from(selectedItems).map(id => {
        return supabase
          .from('catalog')
          .update({ 
            status: 'single',
            parent_type: 'single'
          })
          .eq('id', id)
      })

      await Promise.all(updates)
      
      alert(`✅ ${selectedItems.size} item(s) marcados como Singles. Ahora configúralos en la tab Singles.`)
      setSelectedItems(new Set())
      loadInbox()
      onContentOrganized?.()
      
    } catch (error) {
      console.error('Error marking as single:', error)
      alert('Error: ' + error.message)
    } finally {
      setProcessingAction(null)
    }
  }

  const handleCreateSession = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un item para crear la session')
      return
    }
    
    onContentOrganized?.('create-session', Array.from(selectedItems))
  }

  const handleDelete = async () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un item')
      return
    }

    if (!confirm(`¿Eliminar ${selectedItems.size} item(s)? Esta acción no se puede deshacer.`)) {
      return
    }

    setProcessingAction('delete')
    try {
      const deletes = Array.from(selectedItems).map(id => {
        return supabase
          .from('catalog')
          .delete()
          .eq('id', id)
      })

      await Promise.all(deletes)
      
      alert(`✅ ${selectedItems.size} item(s) eliminados`)
      setSelectedItems(new Set())
      loadInbox()
      
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Error: ' + error.message)
    } finally {
      setProcessingAction(null)
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
      
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              📥 Inbox - Processing Zone
            </h3>
            <p className="text-gray-600 mb-4">
              Todo el contenido nuevo llega aquí primero. Organízalo en Sessions o Singles para que la IA pueda usarlo.
            </p>
            <div className="flex gap-4 text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                {inboxItems.length} items sin organizar
              </span>
              {selectedItems.size > 0 && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-semibold">
                  {selectedItems.size} seleccionados
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {inboxItems.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm"
              >
                {selectedItems.size === inboxItems.length ? '✓ Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <span className="text-sm text-gray-500">
                {selectedItems.size} de {inboxItems.length} seleccionados
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateSession}
                disabled={selectedItems.size === 0 || processingAction}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
              >
                📁 Crear Session
              </button>
              <button
                onClick={handleMarkAsSingle}
                disabled={selectedItems.size === 0 || processingAction}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
              >
                💎 Marcar como Single
              </button>
              <button
                onClick={handleDelete}
                disabled={selectedItems.size === 0 || processingAction}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {inboxItems.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg font-semibold">Inbox vacío</p>
          <p className="text-gray-400 text-sm mt-2">
            Todo el contenido nuevo aparecerá aquí
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {inboxItems.map(item => (
            <div
              key={item.id}
              className={`relative border-2 rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer ${
                selectedItems.has(item.id)
                  ? 'border-purple-600 ring-2 ring-purple-300'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleSelect(item.id)}
            >
              <div className="absolute top-2 left-2 z-10">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedItems.has(item.id)
                      ? 'bg-purple-600 border-purple-600'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {selectedItems.has(item.id) && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </div>
              </div>

              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewMedia(item)
                  }}
                  className="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center text-white"
                >
                  👁️
                </button>
              </div>

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

      {processingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="text-gray-700 font-semibold">
              {processingAction === 'single' && 'Marcando como Singles...'}
              {processingAction === 'delete' && 'Eliminando...'}
            </span>
          </div>
        </div>
      )}

      {previewMedia && (
        <MediaPreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      )}

    </div>
  )
}

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

        <div className="border-t p-4">
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
