import { useState } from 'react';
import VaultSetup from './VaultSetup';
import VaultInstructions from './VaultInstructions';
import CatalogViewComplete from './CatalogView-COMPLETE';

export default function VaultTab({ modelId }) {
  const [activeSubTab, setActiveSubTab] = useState('instructions');

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🗂️ Vault Management</h2>
      
      {/* Sub-tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('instructions')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeSubTab === 'instructions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📝 Instructions
          </button>
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeSubTab === 'catalog'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Catalog
          </button>
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
        </nav>
      </div>

      {/* Content */}
      {activeSubTab === 'instructions' && (
        <VaultInstructions 
          modelId={modelId} 
          onGoToSetup={() => setActiveSubTab('setup')} 
        />
      )}
      {activeSubTab === 'catalog' && <CatalogViewComplete modelId={modelId} />}
      {activeSubTab === 'setup' && <VaultSetup modelId={modelId} />}
    </div>
  );
}
