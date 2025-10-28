import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TransactionModal({ 
  isOpen, 
  onClose, 
  fanId, 
  modelId, 
  fanTier = 'FREE',
  onSuccess 
}) {
  const [activeTab, setActiveTab] = useState('compra')
  const [loading, setLoading] = useState(false)
  
  // Estados para Compra
  const [catalog, setCatalog] = useState([])
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [tierRules, setTierRules] = useState([])
  
  // Estados para Tip y Suscripción
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('locked_content')

  useEffect(() => {
    if (isOpen) {
      loadCatalog()
      loadTierRules()
    }
  }, [isOpen, modelId])

  const loadCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .or(`model_id.eq.${modelId},is_global.eq.true`)
        .order('nivel', { ascending: true })

      if (error) throw error
      setCatalog(data || [])
    } catch (error) {
      console.error('Error loading catalog:', error)
    }
  }

  const loadTierRules = async () => {
    try {
      const { data, error } = await supabase
        .from('tier_rules')
        .select('*')
        .order('min_spent', { ascending: true })

      if (error) throw error
      setTierRules(data || [])
    } catch (error) {
      console.error('Error loading tier rules:', error)
    }
  }

  const calculatePrice = (basePrice) => {
    const tier = tierRules.find(t => t.tier_name.toUpperCase() === fanTier.toUpperCase())
    if (!tier) return basePrice
    return (parseFloat(basePrice) * parseFloat(tier.price_multiplier)).toFixed(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let transactionData = {
        fan_id: fanId,
        model_id: modelId,
        type: activeTab,
        payment_method: paymentMethod,
      }

      if (activeTab === 'compra') {
        if (!selectedOffer) {
          alert('Please select content from catalog')
          setLoading(false)
          return
        }
        
        const finalPrice = calculatePrice(selectedOffer.base_price)
        transactionData.amount = finalPrice
        transactionData.offer_id = selectedOffer.offer_id
        transactionData.description = selectedOffer.title
        transactionData.notes = notes || `Purchased ${selectedOffer.title}`
        transactionData.content_sent = false
      } else {
        // Tip o Suscripción
        if (!amount || parseFloat(amount) <= 0) {
          alert('Please enter a valid amount')
          setLoading(false)
          return
        }
        
        transactionData.amount = parseFloat(amount)
        transactionData.notes = notes || `${activeTab} payment`
        transactionData.description = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} from ${fanId}`
      }

      // Insertar transacción
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert(transactionData)

      if (transactionError) throw transactionError

      // Actualizar spent_total del fan
      const { data: fanData, error: fanError } = await supabase
        .from('fans')
        .select('spent_total')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .single()

      if (!fanError && fanData) {
        const newSpentTotal = parseFloat(fanData.spent_total || 0) + parseFloat(transactionData.amount)
        
        await supabase
          .from('fans')
          .update({ 
            spent_total: newSpentTotal,
            last_update: new Date().toISOString()
          })
          .eq('fan_id', fanId)
          .eq('model_id', modelId)
      }

      alert('✅ Transaction registered successfully!')
      resetForm()
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error registering transaction:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedOffer(null)
    setAmount('')
    setNotes('')
    setPaymentMethod('locked_content')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-800">Register Transaction</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('compra')}
            className={`flex-1 py-4 font-semibold transition-all ${
              activeTab === 'compra'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💰 Purchase
          </button>
          <button
            onClick={() => setActiveTab('tip')}
            className={`flex-1 py-4 font-semibold transition-all ${
              activeTab === 'tip'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💵 Tip
          </button>
          <button
            onClick={() => setActiveTab('suscripcion')}
            className={`flex-1 py-4 font-semibold transition-all ${
              activeTab === 'suscripcion'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📺 Subscription
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* TAB: COMPRA */}
          {activeTab === 'compra' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Content from Catalog
                </label>
                {catalog.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No content available in catalog
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {catalog.map((item) => {
                      const finalPrice = calculatePrice(item.base_price)
                      return (
                        <div
                          key={item.offer_id}
                          onClick={() => setSelectedOffer(item)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedOffer?.offer_id === item.offer_id
                              ? 'border-purple-600 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-gray-800">
                                {item.title}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.description}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Level {item.nivel} • {item.tags}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                ${finalPrice}
                              </div>
                              <div className="text-xs text-gray-500">
                                Base: ${item.base_price}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedOffer && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-600">Selected:</div>
                      <div className="font-bold text-gray-800">{selectedOffer.title}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Final Price:</div>
                      <div className="text-2xl font-bold text-green-600">
                        ${calculatePrice(selectedOffer.base_price)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: TIP */}
          {activeTab === 'tip' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tip Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                  required
                />
              </div>

              {/* Quick amounts */}
              <div>
                <div className="text-sm text-gray-600 mb-2">Quick select:</div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(value.toString())}
                      className="py-2 px-4 bg-gray-100 hover:bg-purple-100 border-2 border-gray-300 hover:border-purple-500 rounded-lg font-semibold transition-all"
                    >
                      ${value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUSCRIPCION */}
          {activeTab === 'suscripcion' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subscription Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                  required
                />
              </div>

              {/* Quick amounts for subscriptions */}
              <div>
                <div className="text-sm text-gray-600 mb-2">Common subscriptions:</div>
                <div className="grid grid-cols-3 gap-2">
                  {[9.99, 19.99, 29.99].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(value.toString())}
                      className="py-2 px-4 bg-gray-100 hover:bg-purple-100 border-2 border-gray-300 hover:border-purple-500 rounded-lg font-semibold transition-all"
                    >
                      ${value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Common fields for all tabs */}
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="locked_content">Locked Content</option>
                <option value="direct_tip">Direct Tip</option>
                <option value="subscription">Subscription</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : '✅ Register Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
