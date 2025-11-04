import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/Navbar'
import ConnectOnlyFans from '../components/ConnectOnlyFans'
import ConfigTab from '../components/settings/ConfigTab'
import TiersTab from '../components/settings/TiersTab'
import VaultTab from '../components/settings/VaultTab'

export default function Settings() {
  const { modelId, currentModel } = useAuth()
  const [activeTab, setActiveTab] = useState('connect')

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">
              Configure your AI model: {currentModel?.name || 'Loading...'}
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <TabButton
                  active={activeTab === 'connect'}
                  onClick={() => setActiveTab('connect')}
                  icon="🔗"
                  label="Connect"
                />
                <TabButton
                  active={activeTab === 'config'}
                  onClick={() => setActiveTab('config')}
                  icon="🤖"
                  label="AI Config"
                />
                <TabButton
                  active={activeTab === 'tiers'}
                  onClick={() => setActiveTab('tiers')}
                  icon="💰"
                  label="Tiers"
                />
                <TabButton
                  active={activeTab === 'vault'}
                  onClick={() => setActiveTab('vault')}
                  icon="🗂️"
                  label="Vault"
                />
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'connect' && <ConnectOnlyFans modelId={modelId} />}
              {activeTab === 'config' && <ConfigTab modelId={modelId} />}
              {activeTab === 'tiers' && <TiersTab modelId={modelId} />}
              {activeTab === 'vault' && <VaultTab modelId={modelId} />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Tab Button Component
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
      }`}
    >
      {icon} {label}
    </button>
  )
}
