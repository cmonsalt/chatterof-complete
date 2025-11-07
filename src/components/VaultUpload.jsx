// ✅ VAULT UPLOAD SIMPLIFICADO - Upload directo a OnlyFans
// Ubicación: src/components/VaultUpload.jsx (REEMPLAZAR)

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function VaultUpload() {
  const { user, modelId } = useAuth();
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [title, setTitle] = useState('');
  const [basePrice, setBasePrice] = useState(10);
  const [nivel, setNivel] = useState(5);
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [accountId, setAccountId] = useState(null);

  useEffect(() => {
    loadAccountId();
  }, [modelId]);

  async function loadAccountId() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    const { data } = await supabase
      .from('models')
      .select('of_account_id')
      .eq('model_id', currentModelId)
      .single();

    if (data?.of_account_id) {
      setAccountId(data.of_account_id);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target.result);
    reader.readAsDataURL(file);

    // Auto-fill title
    if (!title) {
      setTitle(file.name.split('.')[0]);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !accountId) {
      alert('Missing file or account configuration');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setUploading(true);
    setProgress('📤 Uploading to OnlyFans vault...');

    try {
      const currentModelId = modelId || user?.user_metadata?.model_id;

      // Crear FormData
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('accountId', accountId);
      formData.append('modelId', currentModelId);
      formData.append('title', title);
      formData.append('basePrice', basePrice.toString());
      formData.append('nivel', nivel.toString());
      formData.append('tags', tags);

      // Upload usando Vercel Blob (sin límite de tamaño)
      const response = await fetch('/api/onlyfans/upload-with-blob', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      
      const fileSizeMB = data.fileSizeMB || 0;
      const creditsUsed = data.creditsUsed || 1;
      
      setProgress(`✅ Success! Vault ID: ${data.vaultMediaId} | Size: ${fileSizeMB}MB | Credits: ${creditsUsed}`);
      
      // Reset form
      setTimeout(() => {
        setSelectedFile(null);
        setFilePreview(null);
        setTitle('');
        setBasePrice(10);
        setNivel(5);
        setTags('');
        setProgress('');
      }, 4000);

    } catch (error) {
      console.error('❌ Upload error:', error);
      setProgress(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          📤 Upload to Vault
        </h2>

        {/* Cost Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h3 className="font-bold text-yellow-800 mb-1">Cost: 1 credit per 6MB</h3>
              <p className="text-sm text-yellow-700">
                Files upload to OnlyFans CDN + backup to Cloudflare R2.
                <br />
                Example: 100MB video = ~17 credits
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Media
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
          </div>

          {/* Preview */}
          {filePreview && (
            <div className="rounded-lg overflow-hidden border-2 border-gray-200">
              {selectedFile?.type.includes('video') ? (
                <video
                  src={filePreview}
                  controls
                  className="w-full max-h-64 object-contain bg-black"
                />
              ) : (
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain bg-gray-100"
                />
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Beach Video, Sexy Outfit, etc."
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Price & Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Base Price ($)
              </label>
              <input
                type="number"
                min="1"
                value={basePrice}
                onChange={(e) => setBasePrice(parseInt(e.target.value) || 10)}
                disabled={uploading}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Level (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={nivel}
                onChange={(e) => setNivel(parseInt(e.target.value) || 5)}
                disabled={uploading}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tags (optional)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., beach, bikini, teasing"
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !title.trim() || uploading}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>Upload to Vault</span>
              </>
            )}
          </button>

          {/* Progress */}
          {progress && (
            <div className={`p-4 rounded-lg ${
              progress.includes('✅') 
                ? 'bg-green-50 border border-green-200 text-green-700'
                : progress.includes('❌')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
            }`}>
              <p className="text-sm font-semibold">{progress}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-800 mb-2">ℹ️ How it works:</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>File uploads to OnlyFans CDN (1 credit per 6MB)</li>
          <li>Automatic backup to Cloudflare R2 (free storage)</li>
          <li>Content saved to your OnlyFans vault</li>
          <li>Permanent vault ID added to catalog</li>
          <li>Ready to send as PPV!</li>
        </ol>
      </div>
    </div>
  );
}
