// ✅ VAULT UPLOAD - Instrucciones para upload manual
// Ubicación: src/components/VaultUpload.jsx

import { useAuth } from '../contexts/AuthContext';

export default function VaultUpload() {
  const { currentModel } = useAuth();

  async function handleSyncVault() {
    window.location.href = '/settings?tab=vault';
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          📤 Upload Content to Vault
        </h2>

        {/* Instrucciones */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">💡</span>
            <div>
              <h3 className="text-xl font-bold text-blue-900 mb-3">How to Upload Content</h3>
              <ol className="space-y-3 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[24px]">1.</span>
                  <div>
                    <span className="font-semibold">Go to OnlyFans Vault:</span>
                    <br />
                    <a 
                      href="https://onlyfans.com/my/vault" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline font-medium"
                    >
                      https://onlyfans.com/my/vault
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[24px]">2.</span>
                  <span>Upload your photos and videos there (unlimited size)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[24px]">3.</span>
                  <span>Come back here and click "Sync Vault" below</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[24px]">4.</span>
                  <span>Your content will appear in the catalog, ready to send as PPV!</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Botón de Sync */}
        <button
          onClick={handleSyncVault}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 font-bold text-lg shadow-lg flex items-center justify-center gap-3"
        >
          <span>🔄</span>
          <span>Go to Sync Vault</span>
        </button>

        {/* Ventajas */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <h3 className="font-bold text-green-800 mb-2">✅ Advantages:</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Upload videos of any size (no limits)</li>
            <li>• Content stored permanently in OnlyFans vault</li>
            <li>• Automatic backup to Cloudflare R2</li>
            <li>• Videos playable in your catalog</li>
            <li>• Ready to send as PPV instantly</li>
          </ul>
        </div>

        {/* Info técnica */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-800 mb-2">ℹ️ Technical Details:</h3>
          <p className="text-sm text-gray-600">
            When you sync, the system downloads your vault content and creates permanent copies 
            in Cloudflare R2 storage. This ensures your videos are always accessible in the catalog, 
            even if OnlyFans URLs expire.
          </p>
        </div>
      </div>
    </div>
  );
}
