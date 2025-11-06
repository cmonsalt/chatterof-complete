import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function VaultSetup({ modelId: propModelId }) {
  const { user, modelId: contextModelId } = useAuth();
  const modelId = propModelId || contextModelId;
  const [fans, setFans] = useState([]);
  const [selectedVaultFan, setSelectedVaultFan] = useState('');
  const [currentVaultFan, setCurrentVaultFan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ofAccountId, setOfAccountId] = useState(null);

  useEffect(() => {
    loadFansAndVaultConfig();
  }, [modelId]);

  async function loadFansAndVaultConfig() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    try {
      // Cargar account ID
      const { data: modelData } = await supabase
        .from('models')
        .select('vault_fan_id, of_account_id')
        .eq('model_id', currentModelId)
        .single();

      setOfAccountId(modelData?.of_account_id);

      // Cargar fans
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select('fan_id, name, of_username, display_name')
        .eq('model_id', currentModelId)
        .order('name');

      if (fansError) throw fansError;
      setFans(fansData || []);

      if (modelData?.vault_fan_id) {
        setSelectedVaultFan(modelData.vault_fan_id);
        const vaultFan = fansData?.find(f => f.fan_id === modelData.vault_fan_id);
        setCurrentVaultFan(vaultFan);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading vault config:', error);
      setLoading(false);
    }
  }

  async function handleSyncFans() {
    if (!ofAccountId) {
      alert('Primero conecta tu cuenta de OnlyFans');
      return;
    }

    setSyncing(true);
    try {
      const currentModelId = modelId || user?.user_metadata?.model_id;
      
      const response = await fetch('/api/onlyfans/sync-fans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: ofAccountId,
          modelId: currentModelId
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando fans');
      }

      const data = await response.json();
      
      alert(`✅ ${data.synced || 0} fans sincronizados!`);
      
      // Recargar fans
      await loadFansAndVaultConfig();
      
    } catch (error) {
      console.error('Error syncing fans:', error);
      alert('❌ Error al sincronizar fans');
    } finally {
      setSyncing(false);
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
        <span className="text-2xl">🔧</span>
        <h2 className="text-xl font-bold text-gray-800">Configurar Fan de Prueba</h2>
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
            Necesitas un fan de prueba para que tu contenido se capture automáticamente.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">📖 ¿Qué es el Fan de Prueba?</h3>
        <p className="text-sm text-gray-700 mb-3">
          Un fan de prueba es una cuenta que usas para capturar contenido. Todo lo que le envíes 
          se guardará automáticamente en tu catálogo.
        </p>
        <div className="text-sm text-gray-700 space-y-2">
          <p className="font-semibold">📋 Instrucciones:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Crea una cuenta de OnlyFans gratis (o usa una existente)</li>
            <li>Suscríbete a tu propio perfil de OnlyFans</li>
            <li>Envía un mensaje de prueba desde esa cuenta</li>
            <li>Click en "🔄 Sincronizar Fans" abajo</li>
            <li>Selecciona esa cuenta y guarda</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        {/* Botón de Sync */}
        {fans.length === 0 && (
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded mb-4">
            <p className="text-sm text-purple-800 mb-3">
              🔄 Primero sincroniza tus fans para poder seleccionar uno
            </p>
            <button
              onClick={handleSyncFans}
              disabled={syncing || !ofAccountId}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? '🔄 Sincronizando...' : '🔄 Sincronizar Fans'}
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Selecciona tu Fan de Prueba:
          </label>
          
          {fans.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-2">No tienes fans todavía</p>
              <p className="text-sm text-gray-400">
                Sigue las instrucciones arriba y luego sincroniza
              </p>
            </div>
          ) : (
            <>
              <select
                value={selectedVaultFan}
                onChange={(e) => setSelectedVaultFan(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              >
                <option value="">-- Selecciona un fan --</option>
                {fans.map((fan) => (
                  <option key={fan.fan_id} value={fan.fan_id}>
                    {fan.display_name || fan.name}
                    {fan.of_username && ` (@${fan.of_username})`}
                  </option>
                ))}
              </select>
              
              <button
                onClick={handleSyncFans}
                disabled={syncing}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {syncing ? '🔄 Sincronizando...' : '🔄 Actualizar lista de fans'}
              </button>
            </>
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
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-green-800">¡Listo!</h3>
          </div>
          <p className="text-sm text-gray-700">
            Ahora todo el contenido que envíes a <strong>{currentVaultFan.display_name || currentVaultFan.name}</strong> 
            se guardará automáticamente en tu catálogo y estará disponible en tus chats.
          </p>
        </div>
      )}
    </div>
  );
}
