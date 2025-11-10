import { useState, useCallback, useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

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

  const showLocked = isLocked && !isFromModel;

  // Carousel setup
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
    })
  }, [emblaApi])

  return (
    <div className="space-y-2 max-w-md">
      {/* Carousel */}
      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaRef}>
          <div className="flex">
            {mediaUrls.map((url, index) => {
              const mediaId = allIds[index];
              const isPreview = previewIds.includes(mediaId);
              const isVideo = url.includes('.mp4');
              
              return (
                <div key={index} className="flex-[0_0_100%] min-w-0 relative">
                  {/* Mostrar media */}
                  {isVideo ? (
                    <video 
                      src={url}
                      className="w-full h-64 object-cover rounded-lg"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img 
                      src={url}
                      alt={`Content ${index + 1}`}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  )}
                  
                  {/* Blur solo si es fan y no ha pagado */}
                  {showLocked && !isPreview && (
                    <>
                      <div className="absolute inset-0 backdrop-blur-xl bg-black/40 rounded-lg"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-5xl">🔒</div>
                      </div>
                    </>
                  )}
                  
                  {/* Indicador de preview */}
                  {isPreview && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      ⭐ Preview
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Botones de navegación */}
        {mediaUrls.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
              disabled={selectedIndex === 0}
            >
              ←
            </button>
            <button
              onClick={scrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
              disabled={selectedIndex === mediaUrls.length - 1}
            >
              →
            </button>
          </>
        )}

        {/* Indicadores de página */}
        {mediaUrls.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {mediaUrls.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === selectedIndex 
                    ? 'w-6 bg-blue-500' 
                    : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Badge global de estado */}
      {showLocked ? (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold">
          <span>💰 ${price}</span>
          <span className="text-sm font-normal">• Not purchased</span>
        </div>
      ) : isFromModel && isLocked ? (
        <div className="bg-orange-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold text-sm">
          <span>🔒 Locked</span>
          <span className="font-normal">• ${price} • Waiting payment</span>
        </div>
      ) : isFromModel ? (
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold text-sm">
          <span>✅ Unlocked</span>
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

