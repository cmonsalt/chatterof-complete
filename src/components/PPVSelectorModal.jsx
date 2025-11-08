import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PPVSelectorModal({ 
  isOpen, 
  onClose, 
  modelId, 
  onSelectContent 
}) {
  const [catalog, setCatalog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sessions', 'singles'
  const [selectedItems, setSelectedItems] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  useEffect(() => {
    if (isOpen && modelId) {
      loadCatalog();
    }
  }, [isOpen, modelId]);

  async function loadCatalog() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const allContent = data || [];
      
      // Crear mapa de medias para acceso rápido
      const allMediasMap = new Map();
      allContent.forEach(item => {
        if (item.of_media_id) {
          allMediasMap.set(item.of_media_id, item);
        }
      });
      
      // INBOX: Todo sin session_id y sin is_single
      const inboxItems = allContent.filter(item => !item.session_id && !item.is_single);
      
      // SESSIONS: Agrupar por session_id
      const sessionsMap = new Map();
      allContent
        .filter(item => item.session_id && item.step_number !== null)
        .forEach(item => {
          if (!sessionsMap.has(item.session_id)) {
            sessionsMap.set(item.session_id, {
              session_id: item.session_id,
              session_name: item.session_name,
              session_description: item.session_description,
              parts: []
            });
          }
          
          // Cargar info de todos los medias del bundle
          const mediasInfo = [];
          if (item.of_media_ids && item.of_media_ids.length > 0) {
            item.of_media_ids.forEach(mediaId => {
              const mediaInfo = allMediasMap.get(mediaId);
              if (mediaInfo) {
                mediasInfo.push({
                  of_media_id: mediaInfo.of_media_id,
                  media_thumb: mediaInfo.media_thumb,
                  media_url: mediaInfo.media_url,
                  r2_url: mediaInfo.r2_url,
                  file_type: mediaInfo.file_type
                });
              }
            });
          }
          
          sessionsMap.get(item.session_id).parts.push({
            ...item,
            medias_info: mediasInfo
          });
        });
      
      // Ordenar parts por step_number
      sessionsMap.forEach(session => {
        session.parts.sort((a, b) => a.step_number - b.step_number);
      });
      
      // SINGLES: Items marcados como is_single
      const singlesItems = allContent.filter(item => item.is_single);
      
      setCatalog(inboxItems);
      setSessions(Array.from(sessionsMap.values()));
      setSingles(singlesItems);
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(item) {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  }

  function handleConfirm() {
    if (selectedItems.length === 0) return;
    onSelectContent(selectedItems);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">💰 Select PPV Content</h2>
              <p className="text-purple-100 text-sm mt-1">
                Choose content to send as Pay-Per-View
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

        {/* Tabs */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'inbox'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📥 Inbox ({catalog.length})
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'sessions'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📁 Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('singles')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'singles'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              💎 Singles ({singles.length})
            </button>
          </div>

          {selectedItems.length > 0 && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-green-700">
                ✅ {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-5xl mb-4">⏳</div>
              <p className="text-gray-500 font-semibold">Loading content...</p>
            </div>
          ) : (
            <>
              {/* TAB: INBOX */}
              {activeTab === 'inbox' && (
                catalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-5xl mb-4">📭</div>
                    <p className="text-gray-500 font-semibold">Inbox is empty</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Content will appear here until you organize it into Sessions/Singles
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {catalog.map((item) => (
                      <ContentCard 
                        key={item.id} 
                        item={item} 
                        isSelected={!!selectedItems.find(i => i.id === item.id)}
                        onToggle={() => toggleSelection(item)}
                        onPreview={() => setPreviewItem(item)}
                      />
                    ))}
                  </div>
                )
              )}

              {/* TAB: SESSIONS */}
              {activeTab === 'sessions' && (
                sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-5xl mb-4">📁</div>
                    <p className="text-gray-500 font-semibold">No sessions yet</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Create sessions in Settings → Vault → Catalog
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div key={session.session_id} className="border-2 border-purple-200 rounded-xl p-4 bg-white">
                        <h3 className="text-lg font-bold text-purple-600 mb-3">
                          📦 {session.session_name}
                        </h3>
                        <div className="space-y-2">
                          {session.parts.map((part) => {
                            const isSelected = !!selectedItems.find(i => i.id === part.id);
                            return (
                              <div 
                                key={part.id}
                                onClick={() => toggleSelection(part)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-green-50 border-2 border-green-500' 
                                    : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                              >
                                {/* Thumbnails */}
                                <div className="flex gap-1 flex-shrink-0">
                                  {part.medias_info && part.medias_info.length > 1 ? (
                                    // Múltiples medias - grid pequeño
                                    <div className="grid grid-cols-2 gap-1 w-16">
                                      {part.medias_info.slice(0, 4).map((media, idx) => (
                                        <div
                                          key={idx}
                                          className="w-full aspect-square rounded overflow-hidden"
                                        >
                                          <img
                                            src={media.media_thumb}
                                            alt={`Media ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    // Solo 1 media
                                    <img 
                                      src={part.media_thumb || '/placeholder.png'} 
                                      alt={part.title}
                                      className="w-16 h-16 object-cover rounded-lg"
                                    />
                                  )}
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-800">
                                      Part {part.step_number}
                                      {part.step_number === 0 && ' (FREE)'}
                                    </span>
                                    {isSelected && (
                                      <span className="text-green-600 font-bold">✓</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{part.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500">Level {part.nivel}/10</span>
                                    <span className="text-sm font-bold text-purple-600">${part.base_price}</span>
                                  </div>
                                </div>

                                {/* Preview button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewItem(part);
                                  }}
                                  className="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-200"
                                >
                                  👁️ Preview
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* TAB: SINGLES */}
              {activeTab === 'singles' && (
                singles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-5xl mb-4">💎</div>
                    <p className="text-gray-500 font-semibold">No singles yet</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Mark content as Singles from Inbox for quick direct sales
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {singles.map((item) => (
                      <ContentCard 
                        key={item.id} 
                        item={item} 
                        isSelected={!!selectedItems.find(i => i.id === item.id)}
                        onToggle={() => toggleSelection(item)}
                        onPreview={() => setPreviewItem(item)}
                      />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue with {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <PreviewModal 
          item={previewItem} 
          onClose={() => setPreviewItem(null)}
          isSelected={!!selectedItems.find(i => i.id === previewItem.id)}
          onToggle={() => toggleSelection(previewItem)}
        />
      )}
    </div>
  );
}

// Component: Content Card (for Inbox and Singles)
function ContentCard({ item, isSelected, onToggle, onPreview }) {
  return (
    <div
      className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all ${
        isSelected
          ? 'ring-4 ring-green-500 shadow-xl'
          : 'hover:shadow-lg hover:scale-105'
      }`}
      onClick={onToggle}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-900 relative overflow-hidden">
        {item.media_thumb ? (
          <img
            src={item.media_thumb}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <span className="text-6xl">
              {item.file_type === 'video' ? '🎥' : '📸'}
            </span>
          </div>
        )}

        {/* Video Play Icon */}
        {item.file_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black bg-opacity-60 rounded-full w-16 h-16 flex items-center justify-center">
              <span className="text-white text-3xl">▶️</span>
            </div>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-bold">
          {item.file_type === 'video' ? '🎥 VIDEO' : '📸 PHOTO'}
        </div>

        {/* Selected Badge */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
            <span className="text-xl">✓</span>
          </div>
        )}

        {/* Preview Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-lg"
        >
          {item.file_type === 'video' ? '▶️ Play' : '👁️ View'}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 bg-white">
        <h3 className="font-semibold text-sm text-gray-800 truncate">
          {item.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            Level {item.nivel}/10
          </span>
          <span className="text-sm font-bold text-purple-600">
            ${item.base_price}
          </span>
        </div>
      </div>
    </div>
  );
}

// Component: Preview Modal
function PreviewModal({ item, onClose, isSelected, onToggle }) {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-auto w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-500 to-pink-500">
          <div>
            <h3 className="text-xl font-bold text-white">{item.title}</h3>
            <p className="text-purple-100 text-sm">
              {item.file_type === 'video' ? '🎥 Video' : '📸 Photo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Media Content */}
        <div className="p-4 bg-black">
          {item.file_type === 'video' ? (
            <video
              src={item.r2_url || item.media_url}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          ) : (
            <img
              src={item.r2_url || item.media_url || item.media_thumb}
              alt={item.title}
              className="w-full rounded-lg"
            />
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-2 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              <strong>Type:</strong> {item.file_type}
            </span>
            <span className="text-lg font-bold text-purple-600">
              ${item.base_price}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            <strong>Level:</strong> {item.nivel}/10
          </p>
          <p className="text-xs text-gray-400">
            <strong>Media ID:</strong> {item.of_media_id}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all"
          >
            Close
          </button>
          <button
            onClick={() => {
              onToggle();
              onClose();
            }}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold transition-all"
          >
            {isSelected ? '✓ Selected' : 'Select for PPV'}
          </button>
        </div>
      </div>
    </div>
  );
}
