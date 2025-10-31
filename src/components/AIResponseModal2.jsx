import { useState, useEffect } from 'react'

export default function AIResponseModal({ 
  isOpen, 
  onClose, 
  aiResponse,
  onSave
}) {
  const [editedText, setEditedText] = useState('')

  useEffect(() => {
    if (aiResponse) {
      setEditedText(aiResponse.texto)
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">🤖 AI Generated Response</h2>
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

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Editable Response Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                📝 Message Text (Editable)
              </label>
              <span className="text-xs text-gray-500">
                ✏️ You can edit this before saving
              </span>
            </div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-base leading-relaxed"
              placeholder="Edit AI response here..."
            />
            <div className="text-xs text-gray-500 mt-1">
              Characters: {editedText.length}
            </div>
          </div>

          {/* Instructions */}
          {aiResponse.instrucciones_chatter && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span>📋</span> Instructions for Chatter:
              </div>
              <div className="text-blue-700 text-sm">
                {aiResponse.instrucciones_chatter}
              </div>
            </div>
          )}

          {/* Suggested Content */}
          {aiResponse.contenido_sugerido && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <div className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <span>📦</span> Suggested Content:
              </div>
              <div className="text-sm text-amber-700 space-y-1">
                <div><strong>ID:</strong> {aiResponse.contenido_sugerido.offer_id}</div>
                <div><strong>Title:</strong> {aiResponse.contenido_sugerido.title}</div>
                <div><strong>Price:</strong> ${aiResponse.contenido_sugerido.price}</div>
                <div><strong>Description:</strong> {aiResponse.contenido_sugerido.description}</div>
              </div>
            </div>
          )}

          {/* Context */}
          {aiResponse.contexto && (
            <div className="bg-gray-100 rounded-lg p-4 text-sm">
              <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span>ℹ️</span> Context Info:
              </div>
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <div>Tier: <span className="font-semibold">{aiResponse.contexto.fan_tier}</span></div>
                <div>Total Spent: <span className="font-semibold">${aiResponse.contexto.spent_total}</span></div>
                <div className="col-span-2">Messages this session: <span className="font-semibold">{aiResponse.contexto.mensajes_sesion}</span></div>
                {aiResponse.contexto.recent_tip && (
                  <div className="col-span-2 text-green-600 font-semibold">
                    💰 Recent tip: ${aiResponse.contexto.recent_tip.amount} ({aiResponse.contexto.recent_tip.minutes_ago} min ago)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all text-lg"
          >
            ✕ Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all text-lg"
          >
            📋 Copy & Save to Chat
          </button>
        </div>

      </div>
    </div>
  )
}
