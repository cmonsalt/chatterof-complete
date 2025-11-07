// Crear nuevo archivo: src/components/PPVMessage.jsx

import { useState } from 'react';

export default function PPVMessage({ message, onUnlock }) {
  const [unlocking, setUnlocking] = useState(false);

  const isLocked = message.is_locked && !message.is_purchased;
  const price = message.ppv_price || message.amount || 0;

  if (!isLocked) {
    // Contenido desbloqueado - mostrar normal
    return (
      <div className="mt-2">
        {message.media_type === 'video' ? (
          <video
            src={message.media_url}
            controls
            className="rounded-lg max-w-full"
          />
        ) : (
          <img
            src={message.media_url || message.media_thumb}
            alt="Media"
            className="rounded-lg max-w-full"
          />
        )}
        <div className="mt-1 text-xs text-green-600 font-semibold">
          ✅ Purchased for ${price}
        </div>
      </div>
    );
  }

  // Contenido BLOQUEADO
  return (
    <div className="mt-2 relative">
      {/* Blur Preview */}
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
        {message.media_thumb ? (
          <img
            src={message.media_thumb}
            alt="Locked content"
            className="w-full blur-xl opacity-50"
            style={{ filter: 'blur(20px)' }}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-purple-200 to-pink-200" />
        )}

        {/* Lock Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40">
          <div className="text-6xl mb-2">🔒</div>
          <div className="bg-white px-6 py-3 rounded-full shadow-lg">
            <div className="text-2xl font-bold text-purple-600">
              ${price}
            </div>
          </div>
          <div className="text-white text-sm mt-3 font-semibold">
            {message.file_type === 'video' ? '🎥 Video' : '📸 Photo'} • Locked
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 text-xs text-gray-600 italic">
        💳 Waiting for fan to unlock this content
      </div>
    </div>
  );
}
