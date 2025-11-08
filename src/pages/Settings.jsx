import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ConnectOnlyFans from '../components/ConnectOnlyFans'
import ReconnectAccount from '../components/ReconnectAccount'
import ConfigTab from '../components/settings/ConfigTab'
import TiersTab from '../components/settings/TiersTab'
import VaultTab from '../components/settings/VaultTab'


export default function Settings() {
  const { modelId, currentModel } = useAuth()
  const [activeTab, setActiveTab] = useState('connect')
  const [isConnected, setIsConnected] = useState(false)
  const [accountId, setAccountId] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [checkingConnection, setCheckingConnection] = useState(true)

  useEffect(() => {
    if (modelId) {
      checkConnection()
    }
  }, [modelId])

  const checkConnection = async () => {
    try {
      const { data } = await supabase
        .from('models')
        .select('of_account_id, connection_status')
        .eq('model_id', modelId)
        .single()
      
      if (data?.of_account_id) {
        setIsConnected(true)
        setAccountId(data.of_account_id)
        setConnectionStatus(data.connection_status || 'connected')
      }
    } catch (error) {
      console.log('No OF connection')
    } finally {
      setCheckingConnection(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect OnlyFans? You will need to reconnect.')) return
    
    try {
      await supabase
        .from('models')
        .update({ 
          of_account_id: null,
          connection_status: 'disconnected'
        })
        .eq('model_id', modelId)
      
      setIsConnected(false)
      setAccountId(null)
      setConnectionStatus('disconnected')
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

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
                {/* ✅ NUEVO TAB */}
                <TabButton
                  active={activeTab === 'upload'}
                  onClick={() => setActiveTab('upload')}
                  icon="📤"
                  label="Upload"
                />
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'connect' && (
                checkingConnection ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : isConnected && connectionStatus === 'connected' ? (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">🔗 OnlyFans Connection</h2>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-green-50 border-2 border-green-500 rounded-lg p-6">
                        <p className="text-lg font-semibold text-green-900 mb-2">
                          ✅ Connected to OnlyFans
                        </p>
                        <p className="text-sm text-green-700">
                          Account ID: {accountId}
                        </p>
                      </div>
                      <button 
                        onClick={handleDisconnect}
                        className="px-6 py-3 border-2 border-red-500 text-red-500 bg-white rounded-lg font-semibold hover:bg-red-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isConnected && connectionStatus === 'disconnected' ? (
                  <div>
                    <ReconnectAccount 
                      modelId={modelId}
                      onSuccess={(accId) => {
                        setAccountId(accId)
                        setConnectionStatus('connected')
                        checkConnection()
                      }}
                    />
                  </div>
                ) : (
                  <ConnectOnlyFans 
                    modelId={modelId}
                    onSuccess={(accId) => {
                      setIsConnected(true)
                      setAccountId(accId)
                      setConnectionStatus('connected')
                    }}
                  />
                )
              )}
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
