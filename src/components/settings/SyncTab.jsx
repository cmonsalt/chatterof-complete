import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'  

export default function SyncTab({ modelId }) {
  const { user } = useAuth()
  const [syncing, setSyncing] = useState({
    fans: false,
    chats: false,
    transactions: false
  })
  const [results, setResults] = useState({})

  async function handleSyncFans() {
    setSyncing(prev => ({ ...prev, fans: true }))
    try {
      // Get account_id from models
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single()

      if (!model?.of_account_id) {
        throw new Error('Account not connected')
      }

      const response = await fetch('/api/onlyfans/sync-fans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,
          modelId: modelId,
          offset: 0
        })
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Sync failed')

      setResults(prev => ({ ...prev, fans: data }))
      alert(`✅ Synced ${data.synced} fans!`)
    } catch (error) {
      console.error('Sync fans error:', error)
      alert('❌ Error: ' + error.message)
    } finally {
      setSyncing(prev => ({ ...prev, fans: false }))
    }
  }

  async function handleSyncChats() {
    setSyncing(prev => ({ ...prev, chats: true }))
    try {
      // Get account_id from models
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single()

      if (!model?.of_account_id) {
        throw new Error('Account not connected')
      }

      const response = await fetch('/api/onlyfans/sync-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,
          modelId: modelId
        })
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Sync failed')

      setResults(prev => ({ ...prev, chats: data }))
      alert(`✅ Synced ${data.syncedMessages} messages from ${data.syncedFans} fans!`)
    } catch (error) {
      console.error('Sync chats error:', error)
      alert('❌ Error: ' + error.message)
    } finally {
      setSyncing(prev => ({ ...prev, chats: false }))
    }
  }

  async function handleSyncTransactions() {
    setSyncing(prev => ({ ...prev, transactions: true }))
    try {
      // Get account_id from models
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single()

      if (!model?.of_account_id) {
        throw new Error('Account not connected')
      }

      const response = await fetch('/api/onlyfans/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,
          modelId: modelId
        })
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Sync failed')

      setResults(prev => ({ ...prev, transactions: data }))
      alert(`✅ Synced ${data.synced} transactions (${data.skipped} already existed)!`)
    } catch (error) {
      console.error('Sync transactions error:', error)
      alert('❌ Error: ' + error.message)
    } finally {
      setSyncing(prev => ({ ...prev, transactions: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sync Data</h2>
        <p className="text-gray-600">
          Manually sync data from OnlyFans to recover any missed information from webhook failures.
        </p>
      </div>

      {/* Sync Fans */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">👥 Sync Fans</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sync subscriber list and update fan information (name, spent total, subscription status).
            </p>
            {results.fans && (
              <div className="text-sm text-gray-500">
                Last sync: {results.fans.synced} fans synced
              </div>
            )}
          </div>
          <button
            onClick={handleSyncFans}
            disabled={syncing.fans}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
          >
            {syncing.fans ? '⏳ Syncing...' : '🔄 Sync Fans'}
          </button>
        </div>
      </div>

      {/* Sync Chats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">💬 Sync Chats</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sync chat messages from all fans to recover any missed conversations.
            </p>
            {results.chats && (
              <div className="text-sm text-gray-500">
                Last sync: {results.chats.syncedMessages} messages from {results.chats.syncedFans} fans
              </div>
            )}
          </div>
          <button
            onClick={handleSyncChats}
            disabled={syncing.chats}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
          >
            {syncing.chats ? '⏳ Syncing...' : '🔄 Sync Chats'}
          </button>
        </div>
      </div>

      {/* Sync Transactions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">💰 Sync Transactions</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sync transaction history (tips, PPV purchases, subscriptions) to recover missed revenue data.
            </p>
            {results.transactions && (
              <div className="text-sm text-gray-500">
                Last sync: {results.transactions.synced} new transactions
              </div>
            )}
          </div>
          <button
            onClick={handleSyncTransactions}
            disabled={syncing.transactions}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
          >
            {syncing.transactions ? '⏳ Syncing...' : '🔄 Sync Transactions'}
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-semibold text-yellow-800 mb-1">Note</h4>
            <p className="text-sm text-yellow-700">
              Sync operations use API credits. Only use when you notice missing data.
              Most data is automatically captured via webhooks.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
