export default function PPVMessage({ message }) {
  const isPPV = message.is_ppv || message.amount > 0
  const isLocked = message.is_locked && !message.is_purchased
  const price = message.ppv_price || message.amount || 0
  const isFromModel = message.from === 'model'

  if (!isPPV) return null

  // Obtener arrays
  const mediaUrls = message.media_urls?.split(',').filter(Boolean) || [];
  const metadata = typeof message.ppv_metadata === 'string' 
    ? JSON.parse(message.ppv_metadata)
    : message.ppv_metadata || {};
  const previewIds = metadata.preview_media_ids || [];
  const allIds = metadata.all_media_ids || [];

  // Para el chatter: siempre mostrar todo claro
  // Para el fan: depende si compró
  const showLocked = isLocked && !isFromModel;

  return (
    <div className="space-y-2">
      {/* Carousel de medias */}
      <div className="grid grid-cols-2 gap-2 max-w-md">
        {mediaUrls.map((url, index) => {
          const mediaId = allIds[index];
          const isPreview = previewIds.includes(mediaId);
          const isVideo = url.includes('.mp4');
          
          return (
            <div key={index} className="relative">
              {/* Mostrar media */}
              {isVideo ? (
                <video 
                  src={url}
                  className="w-full h-32 object-cover rounded-lg"
                  controls
                  preload="metadata"
                />
              ) : (
                <img 
                  src={url}
                  alt={`Content ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              )}
              
              {/* Blur solo si es fan y no ha pagado */}
              {showLocked && !isPreview && (
                <>
                  <div className="absolute inset-0 backdrop-blur-xl bg-black/40 rounded-lg"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-4xl">🔒</div>
                  </div>
                </>
              )}
              
              {/* Indicador de preview (⭐) */}
              {isPreview && (
                <div className="absolute top-1 left-1 bg-yellow-400 text-white px-2 py-1 rounded-full text-xs font-bold">
                  ⭐ Preview
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Badge global de estado */}
      {showLocked ? (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold">
          <span>💰 ${price}</span>
          <span className="text-sm font-normal">• Not purchased</span>
        </div>
      ) : isFromModel ? (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold text-sm">
          <span>📤 Sent PPV</span>
          <span className="font-normal">• ${price}</span>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
          <span>✓ Unlocked ${price}</span>
        </div>
      )}
    </div>
  )
}