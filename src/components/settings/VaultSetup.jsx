import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function VaultSetup({ modelId: propModelId }) {
  const { user, modelId: contextModelId } = useAuth();
  const modelId = propModelId || contextModelId;
  const [fans, setFans] = useState([]);
  const [selectedVaultFan, setSelectedVaultFan] = useState('');
  const [currentVaultFan, setCurrentVaultFan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFansAndVaultConfig();
  }, [modelId]);

  async function loadFansAndVaultConfig() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    try {
      // Cargar fans
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select('fan_id, name, of_username, display_name')
        .eq('model_id', currentModelId)
        .order('name');

      if (fansError) throw fansError;
      setFans(fansData || []);

      // Cargar configuración actual del vault
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('vault_fan_id')
        .eq('model_id', currentModelId)
        .single();

      if (modelError) throw modelError;

      if (modelData?.vault_fan_id) {
        setSelectedVaultFan(modelData.vault_fan_id);
        const vaultFan = fansData.find(f => f.fan_id === modelData.vault_fan_id);
        setCurrentVaultFan(vaultFan);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading vault config:', error);
      setLoading(false);
    }
  }

  async function handleSaveVaultFan() {
    if (!selectedVaultFan) {
      alert('Por favor selecciona un fan de prueba');
      return;
    }

    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('models')
        .update({ vault_fan_id: selectedVaultFan })
        .eq('model_id', currentModelId);

      if (error) throw error;

      const vaultFan = fans.find(f => f.fan_id === selectedVaultFan);
      setCurrentVaultFan(vaultFan);
      alert('✅ Fan de prueba configurado correctamente!');
    } catch (error) {
      console.error('Error saving vault fan:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📸</span>
        <h2 className="text-xl font-bold text-gray-800">Vault Configuration</h2>
      </div>

      {currentVaultFan ? (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 font-semibold">✅ Fan de prueba configurado:</span>
          </div>
          <div className="text-sm text-gray-700">
            <strong>{currentVaultFan.display_name || currentVaultFan.name}</strong>
            {currentVaultFan.of_username && (
              <span className="text-gray-500"> (@{currentVaultFan.of_username})</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-600 font-semibold">⚠️ No has configurado un fan de prueba</span>
          </div>
          <p className="text-sm text-gray-700">
            Necesitas un fan de prueba para subir contenido a tu vault.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">📖 ¿Qué es el Fan de Prueba?</h3>
        <p className="text-sm text-gray-700 mb-3">
          Para subir contenido a tu vault, necesitas enviar mensajes a una cuenta de prueba. 
          Este contenido se guardará automáticamente en tu catálogo para usarlo después.
        </p>
        <div className="text-sm text-gray-700 space-y-2">
          <p className="font-semibold">📋 Instrucciones:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Crea una cuenta de OnlyFans gratis (o usa una existente)</li>
            <li>Suscríbete a tu propio perfil de OnlyFans</li>
            <li>Envía un mensaje de prueba desde esa cuenta</li>
            <li>Espera unos segundos y recarga esta página</li>
            <li>Selecciona esa cuenta aquí abajo</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Selecciona tu Fan de Prueba:
          </label>
          
          {fans.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-2">No tienes fans todavía</p>
              <p className="text-sm text-gray-400">
                Sigue las instrucciones arriba para crear tu cuenta de prueba
              </p>
            </div>
          ) : (
            <select
              value={selectedVaultFan}
              onChange={(e) => setSelectedVaultFan(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Selecciona un fan --</option>
              {fans.map((fan) => (
                <option key={fan.fan_id} value={fan.fan_id}>
                  {fan.display_name || fan.name}
                  {fan.of_username && ` (@${fan.of_username})`}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={handleSaveVaultFan}
          disabled={!selectedVaultFan || saving}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? '💾 Guardando...' : '💾 Guardar Configuración'}
        </button>
      </div>

      {currentVaultFan && (
        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <h3 className="font-semibold text-purple-800">Siguiente paso:</h3>
          </div>
          <p className="text-sm text-gray-700">
            Ahora puedes ir a la pestaña <strong>"Vault"</strong> para subir contenido. 
            Todo lo que subas estará disponible en el catálogo para usar en tus chats.
          </p>
        </div>
      )}
    </div>
  );
}
