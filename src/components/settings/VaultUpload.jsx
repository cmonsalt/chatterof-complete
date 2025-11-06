import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function VaultUpload({ modelId: propModelId }) {
  const { user, modelId: contextModelId } = useAuth();
  const modelId = propModelId || contextModelId;
  const [vaultFan, setVaultFan] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadVaultConfig();
  }, [modelId]);

  async function loadVaultConfig() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    try {
      const { data, error } = await supabase
        .from('models')
        .select('vault_fan_id, of_account_id')
        .eq('model_id', currentModelId)
        .single();

      if (error) throw error;

      if (data?.vault_fan_id) {
        // Buscar info del fan
        const { data: fanData } = await supabase
          .from('fans')
          .select('*')
          .eq('fan_id', data.vault_fan_id)
          .eq('model_id', currentModelId)
          .single();

        setVaultFan({
          fan_id: data.vault_fan_id,
          of_account_id: data.of_account_id,
          ...fanData
        });
      }
    } catch (error) {
      console.error('Error loading vault config:', error);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Sugerir título basado en nombre de archivo
    if (!title) {
      const fileName = file.name.split('.')[0];
      setTitle(fileName);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !vaultFan) {
      alert('Selecciona un archivo primero');
      return;
    }

    if (!title.trim()) {
      alert('Agrega un título al contenido');
      return;
    }

    setUploading(true);

    try {
      // 1. Subir archivo a OnlyFans CDN
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch(
        `/api/onlyfans/upload-media?accountId=${vaultFan.of_account_id}`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!uploadResponse.ok) {
        throw new Error('Error subiendo archivo a OnlyFans');
      }

      const uploadData = await uploadResponse.json();
      console.log('📤 File uploaded:', uploadData);

      // 2. Enviar mensaje al fan de prueba con el contenido
      const sendResponse = await fetch('/api/onlyfans/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: vaultFan.of_account_id,
          modelId: modelId || user?.user_metadata?.model_id,
          chatId: vaultFan.fan_id,
          text: `📸 ${title}`,  // Título como mensaje
          mediaFiles: [uploadData.prefixed_id],  // Media ID
          price: 0
        })
      });

      if (!sendResponse.ok) {
        throw new Error('Error enviando al vault');
      }

      console.log('✅ Sent to vault fan');

      // 3. El webhook capturará el mensaje y lo guardará en catalog automáticamente
      // Esperar un poco para que el webhook procese
      await new Promise(resolve => setTimeout(resolve, 2000));

      alert('✅ Contenido subido al vault! Estará disponible en el catálogo en unos segundos.');
      
      // Limpiar form
      setSelectedFile(null);
      setPreview(null);
      setTitle('');
      setDescription('');
      
    } catch (error) {
      console.error('❌ Error uploading to vault:', error);
      alert('Error subiendo contenido: ' + error.message);
    } finally {
      setUploading(false);
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
            Necesitas configurar un fan de prueba antes de subir contenido al vault.
          </p>
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
          >
            Ir a Configuración
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">📤</span>
        <h2 className="text-xl font-bold text-gray-800">Upload to Vault</h2>
      </div>

      <div className="bg-green-50 border-l-4 border-green-500 rounded p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-600 font-semibold">✅ Fan de prueba:</span>
        </div>
        <p className="text-sm text-gray-700">
          {vaultFan.display_name || vaultFan.name}
          {vaultFan.of_username && ` (@${vaultFan.of_username})`}
        </p>
      </div>

      <div className="space-y-6">
        {/* File Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📎 Seleccionar Archivo:
          </label>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formatos: JPG, PNG, MP4, MOV (max 500MB)
          </p>
        </div>

        {/* Preview */}
        {preview && (
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Vista Previa:</p>
            {selectedFile?.type.startsWith('video/') ? (
              <video
                src={preview}
                controls
                className="max-w-full max-h-64 rounded mx-auto"
              />
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-64 rounded mx-auto"
              />
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📝 Título: *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Foto sexy en bikini"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📄 Descripción (opcional):
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agrega notas sobre este contenido..."
            rows="3"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || !title.trim() || uploading}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Subiendo...
            </span>
          ) : (
            '📤 Subir al Vault'
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold text-blue-800">¿Cómo funciona?</h3>
        </div>
        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
          <li>El contenido se sube a OnlyFans CDN</li>
          <li>Se envía automáticamente al fan de prueba</li>
          <li>Nuestro webhook lo captura</li>
          <li>Se guarda en tu catálogo</li>
          <li>¡Listo para usar en chats!</li>
        </ol>
      </div>
    </div>
  );
}
