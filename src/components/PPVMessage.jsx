// 🔥 COMPONENTE PPVMessage - Muestra PPV bloqueado o desbloqueado
// Ubicación: src/components/PPVMessage.jsx

export default function PPVMessage({ message }) {
  const isPPV = message.is_ppv || message.amount > 0
  const isLocked = message.is_locked && !message.is_purchased
  const price = message.ppv_price || message.amount || 0

  // Si no es PPV, no renderizar nada
  if (!isPPV) return null

  // 🔒 PPV BLOQUEADO
  if (isLocked) {
    return (
      <div className="relative inline-block">
        {/* Thumbnail preview si existe */}
        {message.media_thumb && (
          <img 
            src={message.media_thumb}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg"
          />
        )}
        
        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-xl bg-black/30 rounded-lg"></div>
        
        {/* Lock icon y precio */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="bg-white/90 rounded-full p-4 shadow-lg mb-3">
            <svg 
              className="w-12 h-12 text-gray-700" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-bold text-lg shadow-xl">
            🔒 Locked - ${price}
          </div>
          <p className="text-white text-sm mt-2 font-semibold drop-shadow-lg">
            Not purchased
          </p>
        </div>
      </div>
    )
  }

  // 🔓 PPV DESBLOQUEADO
  // Usar R2 si existe, sino media_url
  const mediaUrl = message.r2_url || message.media_url
  
  return (
    <div className="relative inline-block max-w-xs">
      {/* Badge de desbloqueado */}
      <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
        <span>✓</span>
        <span>Unlocked ${price}</span>
      </div>

      {/* Contenido desbloqueado */}
      {message.media_type === 'video' ? (
        <video
          src={mediaUrl}
          controls
          className="rounded-lg shadow-lg max-w-xs max-h-60 border-2 border-green-400"
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Unlocked content"
          className="rounded-lg shadow-lg max-w-xs max-h-60 border-2 border-green-400"
        />
      )}
    </div>
  )
}