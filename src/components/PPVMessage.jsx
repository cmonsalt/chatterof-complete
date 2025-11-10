export default function PPVMessage({ message }) {
  const isPPV = message.is_ppv || message.amount > 0
  const isLocked = message.is_locked && !message.is_purchased
  const price = message.ppv_price || message.amount || 0

  if (!isPPV) return null

  // Obtener array de URLs
  const mediaUrls = message.media_urls 
    ? message.media_urls.split(',').filter(Boolean)
    : message.media_url 
    ? [message.media_url]
    : [];

  // 🔒 PPV BLOQUEADO
  if (isLocked) {
    return (
      <div className="space-y-2">
        {/* Grid de medias */}
        <div className="grid grid-cols-2 gap-2 max-w-md">
          {mediaUrls.map((url, index) => (
            <div key={index} className="relative">
              {/* Thumbnail o placeholder */}
              {message.media_thumb && index === 0 ? (
                <img 
                  src={message.media_thumb}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-purple-200 to-pink-200 rounded-lg flex items-center justify-center">
                  <div className="text-4xl">🎥</div>
                </div>
              )}
              
              {/* Blur overlay */}
              <div className="absolute inset-0 backdrop-blur-xl bg-black/40 rounded-lg"></div>
              
              {/* Badge */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  🔒 Locked
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Precio total */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold">
          <span>💰 ${price}</span>
          <span className="text-sm font-normal">• Not purchased</span>
        </div>
      </div>
    )
  }

  // 🔓 PPV DESBLOQUEADO
  return (
    <div className="space-y-2">
      {/* Badge de desbloqueado */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
        <span>✓</span>
        <span>Unlocked ${price}</span>
      </div>

      {/* Grid de medias desbloqueadas */}
      <div className="grid grid-cols-2 gap-2 max-w-md">
        {mediaUrls.map((url, index) => (
          <div key={index} className="relative">
            {message.media_type === 'video' ? (
              <video
                src={url}
                controls
                className="rounded-lg shadow-lg w-full h-32 object-cover border-2 border-green-400"
              />
            ) : (
              <img
                src={url}
                alt={`Content ${index + 1}`}
                className="rounded-lg shadow-lg w-full h-32 object-cover border-2 border-green-400"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}