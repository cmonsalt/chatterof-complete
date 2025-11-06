import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function CatalogView({ modelId: propModelId }) {
  const { user, modelId: contextModelId } = useAuth();
  const modelId = propModelId || contextModelId;
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    loadCatalog();
  }, [modelId]);

  async function loadCatalog() {
    try {
      const currentModelId = modelId || user?.user_metadata?.model_id;
      if (!currentModelId) return;

      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', currentModelId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCatalog(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading catalog:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Catálogo Vacío
        </h3>
        <p className="text-gray-600">
          Envía contenido al fan de prueba para agregarlo aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Tu Catálogo</h3>
          <p className="text-sm text-gray-600">{catalog.length} items</p>
        </div>
        <button
          onClick={loadCatalog}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold text-sm"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Grid de contenido */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {catalog.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedMedia(item)}
            className="relative group cursor-pointer bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-all"
          >
            {/* Thumbnail placeholder */}
            <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
              {item.file_type === 'video' ? (
                <div className="text-center">
                  <div className="text-4xl mb-2">🎬</div>
                  <span className="text-xs text-gray-600">Video</span>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">📸</div>
                  <span className="text-xs text-gray-600">Foto</span>
                </div>
              )}
            </div>

            {/* Info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-white text-sm font-semibold truncate">
                {item.title}
              </p>
              <p className="text-white/70 text-xs">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Hover effect */}
            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white rounded-full p-3 shadow-lg">
                  <span className="text-xl">👁️</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de vista previa */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedMedia.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedMedia.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Contenido */}
              <div className="bg-gray-100 rounded-lg p-8 mb-4 flex items-center justify-center">
                {selectedMedia.file_type === 'video' ? (
                  <div className="text-center">
                    <div className="text-6xl mb-3">🎬</div>
                    <p className="text-gray-700 font-semibold">Video</p>
                    <p className="text-sm text-gray-500 mt-2">
                      ID: {selectedMedia.of_media_id}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-6xl mb-3">📸</div>
                    <p className="text-gray-700 font-semibold">Foto</p>
                    <p className="text-sm text-gray-500 mt-2">
                      ID: {selectedMedia.of_media_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-semibold">{selectedMedia.file_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio base:</span>
                  <span className="font-semibold">${selectedMedia.base_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nivel:</span>
                  <span className="font-semibold">Tier {selectedMedia.nivel}</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMedia.of_media_id);
                    alert('ID copiado al portapapeles');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  📋 Copiar ID
                </button>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
