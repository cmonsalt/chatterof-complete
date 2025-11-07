// ✅ UPLOAD CLIENT-SIDE DIRECTO A BLOB (sin pasar por API)
// Ubicación: src/components/VaultUpload.jsx

import { useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
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

    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target.result);
    reader.readAsDataURL(file);

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
    const currentModelId = modelId || user?.user_metadata?.model_id;

    try {
      // 1️⃣ Upload DIRECTO a Vercel Blob desde el cliente (sin límite)
      setProgress('☁️ Uploading to cloud storage...');

      const newBlob = await upload(selectedFile.name, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/blob/client-upload',
      });

      console.log('✅ Uploaded to Blob:', newBlob.url);

      // 2️⃣ Registrar en OnlyFans y guardar en catalog
      setProgress('📥 Registering with OnlyFans...');

      const registerResponse = await fetch('/api/onlyfans/register-blob-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          modelId: currentModelId,
          blobUrl: newBlob.url,
          filename: selectedFile.name,
          contentType: selectedFile.type,
          title,
          basePrice,
          nivel,
          tags
        })
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await registerResponse.json();
      
      setProgress(`✅ Success! Vault ID: ${data.vaultMediaId} | Credits: ${data.creditsUsed}`);
      
      setTimeout(() => {
        setSelectedFile(null);
        setFilePreview(null);
        setTitle('');
        setProgress('');
      }, 3000);

    } catch (error) {
      console.error('❌ Error:', error);
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

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-bold text-green-800 mb-1">Unlimited Size</h3>
              <p className="text-sm text-green-700">
                Upload videos of any size directly to cloud storage.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
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

          {filePreview && (
            <div className="rounded-lg overflow-hidden border-2 border-gray-200">
              {selectedFile?.type.includes('video') ? (
                <video src={filePreview} controls className="w-full max-h-64 object-contain bg-black" />
              ) : (
                <img src={filePreview} alt="Preview" className="w-full max-h-64 object-contain bg-gray-100" />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Beach Video"
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Price ($)</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Level (1-10)</label>
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
    </div>
  );
}
