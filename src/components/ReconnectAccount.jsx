import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ReconnectAccount({ modelId, onSuccess }) {
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleReconnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Update account_id in DB
      const { error: updateError } = await supabase
        .from('models')
        .update({ 
          of_account_id: accountId.trim(),
          connection_status: 'connected',
          last_connection_check: new Date().toISOString()
        })
        .eq('model_id', modelId)

      if (updateError) throw updateError

      // Success!
      if (onSuccess) onSuccess(accountId.trim())

    } catch (err) {
      console.error('Reconnect error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        🔄 Reconnect OnlyFans Account
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Instructions:</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Go to <a href="https://app.onlyfansapi.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">OnlyFansAPI Dashboard</a></li>
          <li>Click on your account</li>
          <li>Click "Update Credentials" and enter your new password</li>
          <li>Copy the <strong>Account ID</strong> (starts with "acct_")</li>
          <li>Paste it below and click Reconnect</li>
        </ol>
      </div>

      <form onSubmit={handleReconnect} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OnlyFans Account ID
          </label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="acct_xxxxxxxxxxxxxxxxxxxx"
            required
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Example: acct_4612ab92081c4610a2be707d59206869
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !accountId.trim()}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '⏳ Reconnecting...' : '🔄 Reconnect Account'}
        </button>
      </form>
    </div>
  )
}
