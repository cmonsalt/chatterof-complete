import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function TiersTab({ modelId }) {
  const [tierRules, setTierRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (modelId) {
      loadTierRules()
    }
  }, [modelId])

  const loadTierRules = async () => {
    try {
      const { data, error } = await supabase
        .from('tier_rules')
        .select('*')
        .eq('model_id', modelId)
        .order('min_spent', { ascending: true })

      if (error) throw error
      setTierRules(data || [])
    } catch (error) {
      console.error('Error loading tier rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTierRules = async () => {
    setSaving(true)
    setMessage(null)

    try {
      for (const tier of tierRules) {
        const { error } = await supabase
          .from('tier_rules')
          .update({
            min_spent: tier.min_spent,
            max_spent: tier.max_spent,
            price_multiplier: tier.price_multiplier
          })
          .eq('id', tier.id)

        if (error) throw error
      }

      setMessage({ type: 'success', text: '✅ Tier rules saved!' })
    } catch (error) {
      console.error('Error saving tier rules:', error)
      setMessage({ type: 'error', text: '❌ Error saving tier rules' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">💰 Tier Rules</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">How Tiers Work</h3>
        <p className="text-sm text-blue-800">
          Tiers automatically adjust pricing based on how much each fan has spent. 
          The AI uses these multipliers to offer content at different prices to different fans.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {tierRules.map((rule) => (
          <div 
            key={rule.id} 
            className="bg-white border-2 border-gray-200 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{rule.emoji}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{rule.tier_name}</h3>
                  <p className="text-sm text-gray-600">
                    ${rule.min_spent} - ${rule.max_spent === 999999 ? '∞' : rule.max_spent} spent
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600">
                  {rule.price_multiplier}x
                </div>
                <div className="text-xs text-gray-500">multiplier</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Spent ($)
                </label>
                <input
                  type="number"
                  value={rule.min_spent}
                  onChange={(e) => {
                    const updated = tierRules.map(r => 
                      r.id === rule.id ? { ...r, min_spent: parseFloat(e.target.value) } : r
                    )
                    setTierRules(updated)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Spent ($)
                </label>
                <input
                  type="number"
                  value={rule.max_spent || 999999}
                  onChange={(e) => {
                    const updated = tierRules.map(r => 
                      r.id === rule.id ? { ...r, max_spent: parseFloat(e.target.value) } : r
                    )
                    setTierRules(updated)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Price Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={rule.price_multiplier}
                  onChange={(e) => {
                    const updated = tierRules.map(r => 
                      r.id === rule.id ? { ...r, price_multiplier: parseFloat(e.target.value) } : r
                    )
                    setTierRules(updated)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Example Pricing */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2">Example Pricing:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-50 px-3 py-2 rounded">
                  <span className="text-gray-600">$10 base:</span>
                  <span className="font-bold text-gray-900 ml-1">
                    ${(10 * rule.price_multiplier).toFixed(2)}
                  </span>
                </div>
                <div className="bg-gray-50 px-3 py-2 rounded">
                  <span className="text-gray-600">$25 base:</span>
                  <span className="font-bold text-gray-900 ml-1">
                    ${(25 * rule.price_multiplier).toFixed(2)}
                  </span>
                </div>
                <div className="bg-gray-50 px-3 py-2 rounded">
                  <span className="text-gray-600">$50 base:</span>
                  <span className="font-bold text-gray-900 ml-1">
                    ${(50 * rule.price_multiplier).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSaveTierRules}
          disabled={saving}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            saving 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {saving ? '💾 Saving...' : '💾 Save Tier Rules'}
        </button>
      </div>
    </div>
  )
}
