import { useState } from 'react';

export default function AISuggestionModal({ 
  isOpen, 
  onClose,
  suggestion, // { message, lockedText, recommendedPPV }
  onAccept,
  onEdit
}) {
  const [editedMessage, setEditedMessage] = useState(suggestion?.message || '');
  const [editedLockedText, setEditedLockedText] = useState(suggestion?.lockedText || '');

  if (!isOpen || !suggestion) return null;

  const handleSendAll = () => {
    onAccept({
      message: editedMessage,
      lockedText: editedLockedText,
      ppv: suggestion.recommendedPPV
    });
    onClose();
  };

  const handleEditPPV = () => {
    onEdit({
      message: editedMessage,
      lockedText: editedLockedText
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">🤖 AI Suggestion</h2>
              <p className="text-purple-100 text-sm mt-1">
                Review and send AI-generated response
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
          
          {/* Suggested Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💬 Suggested Message
            </label>
            <textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Recommended PPV */}
          {suggestion.recommendedPPV && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                🎁 Recommended PPV
              </h3>
              
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  {suggestion.recommendedPPV.medias_info && suggestion.recommendedPPV.medias_info.length > 1 ? (
                    <div className="grid grid-cols-2 gap-1 w-24">
                      {suggestion.recommendedPPV.medias_info.slice(0, 4).map((media, idx) => (
                        <div key={idx} className="aspect-square rounded overflow-hidden">
                          <img
                            src={media.media_thumb}
                            alt={`Media ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <img
                      src={suggestion.recommendedPPV.media_thumb}
                      alt={suggestion.recommendedPPV.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">
                    {suggestion.recommendedPPV.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {suggestion.recommendedPPV.description || 
                     `Part ${suggestion.recommendedPPV.step_number}`}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                      Level {suggestion.recommendedPPV.nivel}/10
                    </span>
                    <span className="text-lg font-bold text-purple-600">
                      ${suggestion.recommendedPPV.base_price}
                    </span>
                  </div>
                </div>
              </div>

              {/* Locked Text */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔓 Locked Text (Tease)
                </label>
                <input
                  type="text"
                  value={editedLockedText}
                  onChange={(e) => setEditedLockedText(e.target.value)}
                  placeholder="e.g., Unlock to see me play 💦"
                  className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text appears before fan unlocks the content
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
          >
            ❌ Reject
          </button>
          
          {suggestion.recommendedPPV && (
            <button
              onClick={handleEditPPV}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
            >
              ✏️ Edit Content
            </button>
          )}
          
          <button
            onClick={handleSendAll}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            ✅ Send All
          </button>
        </div>

      </div>
    </div>
  );
}
