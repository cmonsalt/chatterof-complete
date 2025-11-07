export default function AISuggestedPPV({ content, onSend, onDismiss }) {
  if (!content) return null

  const getNivelBadge = (nivel) => {
    const badges = {
      1: { label: '🟢 Tease', color: 'bg-green-100 text-green-800' },
      2: { label: '🟢 Soft', color: 'bg-green-100 text-green-800' },
      3: { label: '🟢 Innocent', color: 'bg-green-100 text-green-800' },
      4: { label: '🟡 Bikini', color: 'bg-yellow-100 text-yellow-800' },
      5: { label: '🟡 Lingerie', color: 'bg-yellow-100 text-yellow-800' },
      6: { label: '🟡 Topless', color: 'bg-yellow-100 text-yellow-800' },
      7: { label: '🟠 Nude', color: 'bg-orange-100 text-orange-800' },
      8: { label: '🟠 Solo Play', color: 'bg-orange-100 text-orange-800' },
      9: { label: '🔴 Explicit', color: 'bg-red-100 text-red-800' },
      10: { label: '⚫ Hardcore', color: 'bg-gray-900 text-white' }
    }
    return badges[nivel] || badges[1]
  }

  const nivelBadge = getNivelBadge(content.nivel || 1)

  return (
    <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4 my-3 animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-sm font-bold text-blue-900">AI Suggestion</p>
            <p className="text-xs text-blue-700">
              Based on conversation context
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 text-xl"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-lg overflow-hidden border border-blue-200 mb-3">
        <div className="flex gap-3 p-3">
          
          {/* Thumbnail */}
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
            {content.media_thumb ? (
              <img
                src={content.media_thumb}
                alt={content.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                {content.file_type === 'video' ? '🎥' : '📷'}
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <span className="text-white text-2xl">🔒</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 mb-1 truncate">
              {content.title}
            </h4>
            
            {content.description && (
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                {content.description}
              </p>
            )}
            
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                {nivelBadge.label}
              </span>
              {content.type === 'session' && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                  Part {content.part_number}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {content.of_media_ids?.length || 1} media(s)
              </span>
              <span className="text-lg font-bold text-blue-600">
                ${content.final_price}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reasoning (optional) */}
      {content.ai_reasoning && (
        <div className="bg-blue-100 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">
            💡 Why AI suggests this:
          </p>
          <p className="text-xs text-blue-800">
            {content.ai_reasoning}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSend(content)}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          ✉️ Send to Fan
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
        >
          Not Now
        </button>
      </div>

      {/* Keywords hint (if available) */}
      {content.keywords && content.keywords.length > 0 && (
        <div className="mt-2 pt-2 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Matched keywords:</strong> {content.keywords.slice(0, 3).join(', ')}
          </p>
        </div>
      )}

    </div>
  )
}
