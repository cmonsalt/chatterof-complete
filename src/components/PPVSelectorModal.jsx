import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PPVSelectorModal({ 
  isOpen, 
  onClose, 
  modelId, 
  onSelectContent 
}) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'photo', 'video'
  const [selectedItems, setSelectedItems] = useState([]);

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
        // Sin filtro parent_type - muestra todo el contenido
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCatalog(data || []);
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

  const filteredCatalog = filter === 'all' 
    ? catalog 
    : catalog.filter(item => item.file_type === filter);

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

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Filter:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              All ({catalog.length})
            </button>
            <button
              onClick={() => setFilter('photo')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'photo'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📸 Photos ({catalog.filter(i => i.file_type === 'photo').length})
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'video'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🎥 Videos ({catalog.filter(i => i.file_type === 'video').length})
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

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-5xl mb-4">⏳</div>
              <p className="text-gray-500 font-semibold">Loading content...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-gray-500 font-semibold">No content available</p>
              <p className="text-gray-400 text-sm mt-2">
                Upload content to your vault to see it here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCatalog.map((item) => {
                const isSelected = selectedItems.find(i => i.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all ${
                      isSelected
                        ? 'ring-4 ring-green-500 shadow-xl'
                        : 'hover:shadow-lg hover:scale-105'
                    }`}
                    onClick={() => toggleSelection(item)}
                  >
                    {/* Thumbnail - REAL */}
                    <div className="aspect-square bg-gray-900 relative overflow-hidden">
                      {item.media_thumb ? (
                        <img
                          src={item.media_thumb}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Si falla, mostrar ícono
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      
                      {/* Fallback icon si no hay thumbnail */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
                        style={{ display: item.media_thumb ? 'none' : 'flex' }}
                      >
                        <span className="text-6xl">
                          {item.file_type === 'video' ? '🎥' : '📸'}
                        </span>
                      </div>

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

                      {/* Ver en Vault - Hover */}
                      <a
                        href={`https://onlyfans.com/my/vault/media/${item.of_media_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                      >
                        👁️ Ver en Vault
                      </a>
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
                      <div className="text-xs text-gray-400 mt-1">
                        ID: {item.of_media_id}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
    </div>
  );
}
