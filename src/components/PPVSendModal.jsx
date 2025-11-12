import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PPVSendModal({ 
  isOpen, 
  onClose, 
  selectedContent,
  fanTier = 0,
  fanId,
  modelId,
  onSendPPV,
  aiSuggestion = null  // ← NUEVO PROP
}) {
  const [tiers, setTiers] = useState([]);
  const [message, setMessage] = useState('');
  const [lockedText, setLockedText] = useState('');
  const [previewMediaIds, setPreviewMediaIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [customPrice, setCustomPrice] = useState(null);

  // ← NUEVO: Auto-rellenar cuando viene de IA
  useEffect(() => {
    if (aiSuggestion) {
      if (aiSuggestion.message) {
        setMessage(aiSuggestion.message);
      }
      if (aiSuggestion.teaseText) {
        setLockedText(aiSuggestion.teaseText);
      }
    } else {
      // Limpiar si no hay sugerencia de IA
      setMessage('');
      setLockedText('');
    }
  }, [aiSuggestion]);

  useEffect(() => {
    if (isOpen && modelId) {
      loadTiers();
    }
  }, [isOpen, modelId]);

  async function loadTiers() {
    try {
      const { data, error } = await supabase
        .from('tier_rules')
        .select('*')
        .eq('model_id', modelId)
        .order('min_spent', { ascending: true });
      
      if (error) throw error;
      setTiers(data || []);
    } catch (error) {
      console.error('Error loading tiers:', error);
      // Fallback a tiers por defecto
      setTiers([
        { tier_number: 0, tier_name: 'FREE', multiplier: 1.0, emoji: '🆓' },
        { tier_number: 1, tier_name: 'VIP', multiplier: 1.2, emoji: '💎' },
        { tier_number: 2, tier_name: 'WHALE', multiplier: 1.5, emoji: '🐋' }
      ]);
    }
  }

  function calculatePrice() {
    if (!selectedContent || selectedContent.length === 0) return 0;
    
    const basePrice = selectedContent.reduce((sum, item) => sum + (item.base_price || 0), 0);
    const currentTier = tiers.find(t => t.tier_number === fanTier) || tiers[0];
    const multiplier = currentTier?.multiplier || 1.0;
    
    return customPrice !== null ? customPrice : Math.round(basePrice * multiplier);
  }

async function handleSend() {
  if (!message.trim()) {
    alert('Please write a message to send with the PPV');
    return;
  }

  setSending(true);
  try {
    const price = calculatePrice();
    const mediaFiles = selectedContent.map(item => item.of_media_id);

    const ppvData = {
      text: message,
      mediaFiles,
      price,
      lockedText: lockedText.trim() || undefined,
      previewMediaIds: previewMediaIds.length > 0 ? previewMediaIds : undefined,
      catalogIds: selectedContent.map(item => item.id)
    };

    console.log('📤 Sending PPV data:', ppvData);  // ← DEBUG

    await onSendPPV(ppvData);
    onClose();
  } catch (error) {
    console.error('Error sending PPV:', error);
    alert('Error sending PPV: ' + error.message);
  } finally {
    setSending(false);
  }
}

  function togglePreview(mediaId) {
    setPreviewMediaIds(prev => {
      if (prev.includes(mediaId)) {
        return prev.filter(id => id !== mediaId);
      } else {
        return [...prev, mediaId];
      }
    });
  }

  if (!isOpen || !selectedContent || selectedContent.length === 0) return null;

  const finalPrice = calculatePrice();
  const currentTier = tiers.find(t => t.tier_number === fanTier) || tiers[0];
  const baseTotal = selectedContent.reduce((sum, item) => sum + (item.base_price || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">💰 Send PPV Content</h2>
              <p className="text-green-100 text-sm mt-1">
                Review and send Pay-Per-View content to fan
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Selected Content Preview */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              📦 Selected Content ({selectedContent.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {selectedContent.map((item) => {
                const isPreview = previewMediaIds.includes(item.of_media_id);
                return (
                  <div
                    key={item.id}
                    className={`relative rounded-lg overflow-hidden border-2 ${
                      isPreview ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="aspect-square bg-gray-200">
                      {item.media_thumb ? (
                        <img
                          src={item.media_thumb}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-400">
                          <span className="text-4xl">
                            {item.file_type === 'video' ? '🎥' : '📸'}
                          </span>
                        </div>
                      )}
                      
                      {/* Preview Badge */}
                      {isPreview && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                          FREE
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Base: ${item.base_price}
                      </p>
                      
                      {/* Checkbox para marcar como preview */}
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPreview}
                          onChange={() => togglePreview(item.of_media_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">Free preview</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">💵 Pricing</h3>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Base Price Total:</span>
                <span className="font-bold text-gray-800">${baseTotal}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Fan Tier:</span>
                <span className="font-semibold">
                  {currentTier?.emoji} {currentTier?.tier_name} (x{currentTier?.multiplier})
                </span>
              </div>
              
              <div className="pt-2 border-t border-green-300 flex items-center justify-between">
                <span className="font-bold text-gray-800">Final Price:</span>
                <span className="text-2xl font-bold text-green-600">${finalPrice}</span>
              </div>
            </div>

            {/* Custom Price Override */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💰 Custom Price (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={customPrice !== null ? customPrice : ''}
                onChange={(e) => setCustomPrice(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder={`Default: $${finalPrice}`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💬 Message to Fan
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Baby I have something special for you..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
            {aiSuggestion && (
              <p className="text-xs text-purple-600 mt-1">
                ✨ Pre-filled by AI
              </p>
            )}
          </div>

          {/* Locked Text (Tease) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🔓 Locked Text (Optional Tease)
            </label>
            <input
              type="text"
              value={lockedText}
              onChange={(e) => setLockedText(e.target.value)}
              placeholder="e.g., Unlock to see me play 💦"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This text appears before fan unlocks the content
            </p>
            {aiSuggestion && aiSuggestion.teaseText && (
              <p className="text-xs text-purple-600 mt-1">
                ✨ Pre-filled by AI
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 transition-all"
          >
            {sending ? '⏳ Sending...' : `📤 Send PPV for $${finalPrice}`}
          </button>
        </div>

      </div>
    </div>
  );
}
