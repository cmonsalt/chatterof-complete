import { useState } from 'react'
import InboxView from './InboxView'
import CatalogView from '../CatalogView'
import VaultSetup from './VaultSetup'
import VaultInstructions from './VaultInstructions'

export default function VaultTab({ modelId }) {
  const [activeTab, setActiveTab] = useState('instructions')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🗂️ Vault Management</h2>
      
      {/* Main Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeTab === 'instructions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📝 Instructions
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeTab === 'inbox'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📥 Inbox
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeTab === 'catalog'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Catalog
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`pb-3 px-2 border-b-2 transition-colors font-semibold ${
              activeTab === 'setup'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Setup
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'instructions' && (
        <VaultInstructions 
          modelId={modelId} 
          onGoToSetup={() => setActiveTab('setup')} 
        />
      )}
      
      {activeTab === 'inbox' && (
        <InboxView 
          key={`inbox-${refreshKey}`}
          modelId={modelId}
        />
      )}
      
      {activeTab === 'catalog' && (
        <CatalogView 
          key={`catalog-${refreshKey}`}
          modelId={modelId}
        />
      )}
      
      {activeTab === 'setup' && (
        <VaultSetup modelId={modelId} />
      )}

    </div>
  )
}
