import { useState } from 'react';
import VaultSetup from './VaultSetup';
import VaultUpload from './VaultUpload';

export default function VaultTab({ modelId }) {
  const [activeSubTab, setActiveSubTab] = useState('setup');

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🗂️ Vault Management</h2>
      
      {/* Sub-tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('setup')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeSubTab === 'setup'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Setup
          </button>
          <button
            onClick={() => setActiveSubTab('upload')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeSubTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📤 Upload
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeSubTab === 'setup' && <VaultSetup modelId={modelId} />}
      {activeSubTab === 'upload' && <VaultUpload modelId={modelId} />}
    </div>
  );
}
