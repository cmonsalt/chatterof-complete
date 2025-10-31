import { useState, useEffect } from 'react'

export default function AIResponseModal({ 
  isOpen, 
  onClose, 
  aiResponse,
  onSave,
  onRegenerate  // NUEVO: callback para regenerar
}) {
  const [editedText, setEditedText] = useState('')
  const [isEditing, setIsEditing] = useState(false) // NUEVO

  useEffect(() => {
    if (aiResponse) {
      setEditedText(aiResponse.texto)
      setIsEditing(false) // Reset editing mode
    }
  }, [aiResponse])

  if (!isOpen || !aiResponse) return null

  const getAccionColor = (accion) => {
    switch(accion) {
      case 'SOLO_TEXTO': return 'bg-green-500'
      case 'CONTENIDO_SUGERIDO': return 'bg-amber-500'
      case 'ENVIAR_DESBLOQUEADO': return 'bg-purple-500'
      case 'CUSTOM_REQUEST': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAccionText = (accion) => {
    switch(accion) {
      case 'SOLO_TEXTO': return '💬 SOLO TEXTO'
      case 'CONTENIDO_SUGERIDO': return '📦 CONTENIDO SUGERIDO'
      case 'ENVIAR_DESBLOQUEADO': return '💰 ENVIAR GRATIS'
      case 'CUSTOM_REQUEST': return '🎨 CUSTOM REQUEST'
      default: return accion
    }
  }

  const handleSave = () => {
    onSave(editedText)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText)
    alert('✅ Copiado al portapapeles!')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">🤖 AI Suggestion</h2>
            <span className={`${getAccionColor(aiResponse.accion)} text-white px-4 py-2 rounded-lg text-sm font-semibold`}>
              {getAccionText(aiResponse.accion)}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body - Texto AI (editable o no) */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                {isEditing ? '✏️ Editing Response:' : '💬 AI Response:'}
              </label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-semibold"
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full border-2 border-purple-300 rounded-lg p-4 min-h-[150px] text-lg focus:border-purple-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <p className="text-lg whitespace-pre-wrap">{editedText}</p>
              </div>
            )}
          </div>

          {/* Offer ID si existe */}
          {aiResponse.offer_id && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">📦 Content Offered:</p>
              <p className="text-amber-900 font-mono">{aiResponse.offer_id}</p>
            </div>
          )}

          {/* Detected Info si existe */}
          {aiResponse.detected_info && Object.keys(aiResponse.detected_info).length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">📝 Detected Info:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(aiResponse.detected_info).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-semibold text-blue-900">{key}:</span>{' '}
                    <span className="text-blue-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          {isEditing ? (
            // Modo edición: Guardar o Cancelar
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditedText(aiResponse.texto)
                  setIsEditing(false)
                }}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all text-lg"
              >
                ❌ Cancel Edit
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-lg"
              >
                ✅ Done Editing
              </button>
            </div>
          ) : (
            // Modo normal: Send, Regenerate, Copy
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all text-lg"
              >
                📋 Copy
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-lg"
                >
                  🔄 Regenerate
                </button>
              )}
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all text-lg"
              >
                ✅ Send
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
