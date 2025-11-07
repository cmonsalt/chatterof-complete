import { useState } from 'react'

export default function PPVSendModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  content, 
  fanName,
  fanTier = 0,
  sending = false 
}) {
  const [message, setMessage] = useState('')

  if (!isOpen || !content) return null

  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: '🆓', label: 'Free', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: '🎁', label: 'VIP', color: 'bg-blue-100 text-blue-700' },
      2: { emoji: '🐋', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
    }
    return tiers[tier] || tiers[0]
  }

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

  const tierBadge = getTierBadge(fanTier)
  const nivelBadge = getNivelBadge(content.nivel || 1)

  const handleSend = () => {
    onConfirm({
      ...content,
      custom_message: message
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">📤 Send PPV Content</h2>
              <p className="text-sm text-green-100 mt-1">
                Preview and confirm before sending
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              disabled={sending}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          
          {/* Fan Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              📤 Sending to:
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{fanName}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierBadge.color}`}>
                {tierBadge.emoji} {tierBadge.label}
              </span>
            </div>
          </div>

          {/* Content Card */}
          <div className="border-2 border-purple-200 rounded-lg overflow-hidden">
            
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-100">
              {content.media_thumb ? (
                <img
                  src={content.media_thumb}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">
                  {content.file_type === 'video' ? '🎥' : '📷'}
                </div>
              )}
              
              {/* Lock overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-6xl mb-2">🔒</div>
                  <p className="text-lg font-bold">Locked Content</p>
                  <p className="text-sm">Fan will see this thumbnail</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {content.title}
                  </h3>
                  {content.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {content.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                      {nivelBadge.label}
                    </span>
                    {content.type === 'session' && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                        📁 Part {content.part_number}
                      </span>
                    )}
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                      {content.of_media_ids?.length || 1} media(s)
                    </span>
                  </div>
                </div>
                
                {/* Price */}
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-500 mb-1">Price for fan:</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${content.final_price}
                  </p>
                  {content.base_price !== content.final_price && (
                    <p className="text-xs text-gray-500">
                      Base: ${content.base_price}
                    </p>
                  )}
                </div>
              </div>

              {/* Keywords (if single) */}
              {content.keywords && content.keywords.length > 0 && (
                <div className="border-t border-purple-200 pt-3 mt-3">
                  <p className="text-xs text-gray-600 mb-2">Keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {content.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💬 Message (optional):
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to go with the content..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows="3"
              disabled={sending}
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: "here's that special content you asked for 😘"
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-2">ℹ️ What fan will see:</p>
            <div className="text-sm text-yellow-800 space-y-1">
              <p>• <strong>Thumbnail</strong> visible for free</p>
              <p>• <strong>Content locked</strong> until they pay ${content.final_price}</p>
              <p>• <strong>Your message</strong> {message ? 'with your custom text' : '(if you add one)'}</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            disabled={sending}
          >
            {sending ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Sending...
              </>
            ) : (
              <>✉️ Send PPV (${ content.final_price})</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
