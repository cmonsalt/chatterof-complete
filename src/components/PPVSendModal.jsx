import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PPVSendModal({ 
  isOpen, 
  onClose, 
  selectedContent,
  fanTier = 0,
  fanId,
  modelId,
  onSendPPV 
}) {
  const [tiers, setTiers] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [customPrice, setCustomPrice] = useState(null);

  useEffect(() => {
    if (isOpen && modelId) {
      loadTiers();
    }
  }, [isOpen, modelId]);

  async function loadTiers() {
    try {
      const { data, error } = await supabase
        .from('tiers')
        .select('*')
        .eq('model_id', modelId)
        .order('tier_number', { ascending: true });
      
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

      await onSendPPV({
        text: message,
        mediaFiles,
        price
      });

      onClose();
    } catch (error) {
      console.error('Error sending PPV:', error);
      alert('Error sending PPV: ' + error.message);
    } finally {
      setSending(false);
    }
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
              {selectedContent.map((item) => (
                <div
                  key={item.id}
                  className="relative rounded-lg overflow-hidden border-2 border-gray-200"
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
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Base: ${item.base_price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">💵 Pricing</h3>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Base Price Total:</span>
                <span className="font-semibold text-gray-800">${baseTotal}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Fan Tier:</span>
                <span className="font-semibold text-gray-800">
                  {currentTier?.emoji} {currentTier?.tier_name} ({currentTier?.multiplier}x)
                </span>
              </div>
              
              <div className="border-t border-green-300 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">Final Price:</span>
                  <span className="font-bold text-2xl text-green-600">
                    ${finalPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* All Tier Prices */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Prices by tier:</p>
              <div className="flex items-center gap-3">
                {tiers.map((tier) => {
                  const tierPrice = Math.round(baseTotal * tier.multiplier);
                  const isCurrent = tier.tier_number === fanTier;
                  return (
                    <div
                      key={tier.tier_number}
                      className={`flex-1 text-center p-2 rounded-lg ${
                        isCurrent
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="text-lg">{tier.emoji}</div>
                      <div className={`text-xs font-semibold ${
                        isCurrent ? 'text-green-700' : 'text-gray-600'
                      }`}>
                        {tier.tier_name}
                      </div>
                      <div className={`text-sm font-bold ${
                        isCurrent ? 'text-green-600' : 'text-gray-700'
                      }`}>
                        ${tierPrice}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Price Override */}
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={customPrice !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCustomPrice(finalPrice);
                    } else {
                      setCustomPrice(null);
                    }
                  }}
                  className="rounded"
                />
                <span className="font-semibold">Override with custom price</span>
              </label>
              {customPrice !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-lg font-bold text-gray-800 mb-2">
              💬 Message to Fan
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a teasing message to send with the PPV content..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Tip: Be flirty and create anticipation to increase purchase rate
            </p>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  Content will be locked until fan pays
                </p>
                <p className="text-xs text-yellow-700">
                  The fan will need to pay ${finalPrice} to unlock and view this content.
                  Make sure your message creates enough desire to drive the purchase!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {sending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>💰</span>
                  <span>Send PPV for ${finalPrice}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
