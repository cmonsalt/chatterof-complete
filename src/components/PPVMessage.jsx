// 🔥 COMPONENTE PPVMessage - Muestra PPV bloqueado o desbloqueado
// Ubicación: src/components/PPVMessage.jsx (CREAR NUEVO ARCHIVO)

export default function PPVMessage({ message }) {
  const isPPV = message.is_ppv || message.amount > 0
  const isLocked = message.is_locked && !message.is_purchased
  const price = message.ppv_price || message.amount || 0

  // Si no es PPV, no renderizar nada (ChatView manejará el renderizado normal)
  if (!isPPV) return null

  // 🔒 PPV BLOQUEADO (fan no ha pagado)
  if (isLocked) {
    return (
      <div className="relative inline-block">
        {/* Contenido difuminado */}
        <div className="relative overflow-hidden rounded-lg bg-gray-200 max-w-xs">
          {/* Placeholder basado en tipo de media */}
          {message.media_type === 'video' ? (
            <div className="w-full h-48 bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
              <div className="text-6xl">🎥</div>
            </div>
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-blue-200 to-purple-200 flex items-center justify-center">
              <div className="text-6xl">📸</div>
            </div>
          )}
          
          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-xl bg-black/30"></div>
          
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
              Fan needs to unlock
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 🔓 PPV DESBLOQUEADO (fan ya pagó)
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
          src={message.media_url}
          controls
          className="rounded-lg shadow-lg max-w-xs max-h-60 border-2 border-green-400"
          onError={(e) => {
            console.error('Video failed to load');
            e.target.outerHTML = `
              <div class="flex flex-col items-center justify-center h-60 w-full bg-gray-100 rounded-lg border-2 border-red-300">
                <div class="text-5xl mb-3">❌</div>
                <p class="font-semibold text-gray-700">Video URL expired</p>
                <p class="text-sm text-gray-500 mt-1">OnlyFans URLs expire after 24h</p>
                <p class="text-xs text-gray-400 mt-2">Contact support to refresh</p>
              </div>
            `;
          }}
        />
      ) : (
        <img
          src={message.media_url}
          alt="Unlocked content"
          className="rounded-lg shadow-lg max-w-xs max-h-60 border-2 border-green-400"
          onError={(e) => {
            console.error('Image failed to load');
            e.target.outerHTML = `
              <div class="flex flex-col items-center justify-center h-60 w-full bg-gray-100 rounded-lg border-2 border-red-300">
                <div class="text-5xl mb-3">❌</div>
                <p class="font-semibold text-gray-700">Image URL expired</p>
                <p class="text-sm text-gray-500 mt-1">OnlyFans URLs expire after 24h</p>
                <p class="text-xs text-gray-400 mt-2">Contact support to refresh</p>
              </div>
            `;
          }}
        />
      )}
    </div>
  )
}
