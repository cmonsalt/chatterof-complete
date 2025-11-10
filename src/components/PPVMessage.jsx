export default function PPVMessage({ message }) {
  const isPPV = message.is_ppv || message.amount > 0
  const isLocked = message.is_locked && !message.is_purchased
  const price = message.ppv_price || message.amount || 0

  if (!isPPV) return null

  // Obtener arrays
  const mediaUrls = message.media_urls?.split(',').filter(Boolean) || [];
  const metadata = typeof message.ppv_metadata === 'string' 
  ? JSON.parse(message.ppv_metadata)
  : message.ppv_metadata || {};
  const previewIds = metadata.preview_media_ids || [];
  const allIds = metadata.all_media_ids || [];

  // 🔒 PPV BLOQUEADO
  if (isLocked) {
    return (
      <div className="space-y-2">
        {/* Grid de medias */}
        <div className="grid grid-cols-2 gap-2 max-w-md">
          {mediaUrls.map((url, index) => {
            const mediaId = allIds[index];
            const isPreview = previewIds.includes(mediaId);
            
            return (
              <div key={index} className="relative">
                <img 
                  src={url}
                  alt={isPreview ? "Free preview" : "Locked"}
                  className="w-full h-32 object-cover rounded-lg"
                />
                
                {/* Si NO es preview, blur + lock */}
                {!isPreview && (
                  <>
                    <div className="absolute inset-0 backdrop-blur-xl bg-black/40 rounded-lg"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        🔒 Locked
                      </div>
                    </div>
                  </>
                )}
                
                {/* Si es preview, badge verde */}
                {isPreview && (
                  <div className="absolute top-1 right-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                    ✓ FREE
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Precio */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold">
          <span>💰 ${price}</span>
          <span className="text-sm font-normal">• Not purchased</span>
        </div>
      </div>
    )
  }

  // 🔓 PPV DESBLOQUEADO - Todo visible
  return (
    <div className="space-y-2">
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
        <span>✓ Unlocked ${price}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-md">
        {mediaUrls.map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`Content ${index + 1}`}
            className="rounded-lg w-full h-32 object-cover border-2 border-green-400"
          />
        ))}
      </div>
    </div>
  )
}