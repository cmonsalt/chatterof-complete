import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function VaultInstructions({ modelId: propModelId, onGoToSetup }) {
  const { user, modelId: contextModelId } = useAuth();
  const modelId = propModelId || contextModelId;
  const [vaultFan, setVaultFan] = useState(null);
  const [catalogCount, setCatalogCount] = useState(0);

  useEffect(() => {
    loadVaultConfig();
    loadCatalogCount();
  }, []);

  async function loadVaultConfig() {
    try {
      const modelId = user?.user_metadata?.model_id;
      if (!modelId) return;

      const { data } = await supabase
        .from('models')
        .select('vault_fan_id')
        .eq('model_id', modelId)
        .single();

      if (data?.vault_fan_id) {
        const { data: fanData } = await supabase
          .from('fans')
          .select('*')
          .eq('fan_id', data.vault_fan_id)
          .eq('model_id', modelId)
          .single();

        setVaultFan(fanData);
      }
    } catch (error) {
      console.error('Error loading vault config:', error);
    }
  }

  async function loadCatalogCount() {
    try {
      const modelId = user?.user_metadata?.model_id;
      if (!modelId) return;

      const { count } = await supabase
        .from('catalog')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId);

      setCatalogCount(count || 0);
    } catch (error) {
      console.error('Error loading catalog:', error);
    }
  }

  if (!vaultFan) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center py-12">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Fan de Prueba No Configurado
          </h3>
          <p className="text-gray-600 mb-4">
            Necesitas configurar un fan de prueba para capturar contenido del vault.
          </p>
          <button
            onClick={onGoToSetup}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
          >
            Configurar Ahora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📦</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Vault Management</h2>
              <p className="text-gray-600 text-sm">Gestiona tu contenido para PPV</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-600">{catalogCount}</div>
            <div className="text-xs text-gray-500">Items en catalog</div>
          </div>
        </div>
      </div>

      {/* Fan de prueba configurado */}
      <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 font-semibold text-lg">✅ Fan de Prueba Activo</span>
        </div>
        <p className="text-gray-700">
          <span className="font-semibold">{vaultFan.display_name || vaultFan.name}</span>
          {vaultFan.of_username && ` (@${vaultFan.of_username})`}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Todo el contenido que envíes a este fan se guardará automáticamente en tu catálogo
        </p>
      </div>

      {/* Instrucciones */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">📝</span>
          <h3 className="text-xl font-bold text-gray-800">Cómo Agregar Contenido al Vault</h3>
        </div>

        <div className="space-y-6">
          {/* Opción 1 */}
          <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
            <h4 className="font-bold text-blue-900 mb-3">Opción 1: Desde OnlyFans (Recomendado)</h4>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">1.</span>
                <span>Ve a tu cuenta de <strong>OnlyFans</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">2.</span>
                <span>Sube tu foto/video al <strong>Vault</strong> (cualquier tamaño)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">3.</span>
                <span>Envía el contenido a <strong>{vaultFan.display_name || vaultFan.name}</strong> como mensaje normal</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">4.</span>
                <span>¡Listo! Aparecerá automáticamente en tu catálogo aquí</span>
              </li>
            </ol>
            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
              <p className="text-xs text-gray-600">
                💡 <strong>Tip:</strong> Puedes subir videos de cualquier tamaño sin límites
              </p>
            </div>
          </div>

          {/* Opción 2 */}
          <div className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded">
            <h4 className="font-bold text-purple-900 mb-3">Opción 2: Desde tu Feed</h4>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-purple-600">1.</span>
                <span>Publica contenido en tu <strong>Feed de OnlyFans</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-purple-600">2.</span>
                <span>Envíalo a <strong>{vaultFan.display_name || vaultFan.name}</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-purple-600">3.</span>
                <span>Se capturará automáticamente en tu catálogo</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Ventajas */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">✨</span>
          <h3 className="text-lg font-bold text-gray-800">Ventajas de este Sistema</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <span className="text-green-500 text-xl">✓</span>
            <div>
              <p className="font-semibold text-gray-800">Sin límites de tamaño</p>
              <p className="text-sm text-gray-600">Sube videos tan grandes como quieras</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 text-xl">✓</span>
            <div>
              <p className="font-semibold text-gray-800">Automático</p>
              <p className="text-sm text-gray-600">Se sincroniza solo, sin hacer nada extra</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 text-xl">✓</span>
            <div>
              <p className="font-semibold text-gray-800">Usa el uploader de OF</p>
              <p className="text-sm text-gray-600">Ya optimizado para videos grandes</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 text-xl">✓</span>
            <div>
              <p className="font-semibold text-gray-800">Sin costos extra</p>
              <p className="text-sm text-gray-600">No gasta créditos adicionales</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">❓ Preguntas Frecuentes</h3>
        <div className="space-y-3">
          <details className="group">
            <summary className="font-semibold text-gray-700 cursor-pointer hover:text-purple-600">
              ¿Cuánto tarda en aparecer en mi catálogo?
            </summary>
            <p className="text-sm text-gray-600 mt-2 pl-4">
              Entre 2-5 segundos después de enviar el mensaje. Nuestro webhook lo captura automáticamente.
            </p>
          </details>
          
          <details className="group">
            <summary className="font-semibold text-gray-700 cursor-pointer hover:text-purple-600">
              ¿Puedo subir videos de varios GB?
            </summary>
            <p className="text-sm text-gray-600 mt-2 pl-4">
              Sí, sin límites. Al usar el uploader nativo de OnlyFans, puedes subir videos tan grandes como OnlyFans lo permita.
            </p>
          </details>
          
          <details className="group">
            <summary className="font-semibold text-gray-700 cursor-pointer hover:text-purple-600">
              ¿El fan de prueba verá mi contenido?
            </summary>
            <p className="text-sm text-gray-600 mt-2 pl-4">
              Sí, pero es tu cuenta de prueba. Úsala solo para capturar contenido del vault, no es visible para otros fans.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
