import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TransactionModal({ isOpen, onClose, fanId, modelId, fanTier, onSuccess }) {
  const [type, setType] = useState('compra')
  const [amount, setAmount] = useState('')
  const [offerId, setOfferId] = useState('')
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && modelId) {
      loadCatalog()
    }
  }, [isOpen, modelId])

  const loadCatalog = async () => {
    try {
      const { data } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('nivel', { ascending: true })
      
      setCatalog(data || [])
    } catch (error) {
      console.error('Error loading catalog:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Insert transaction
      const { error: transError } = await supabase
        .from('transactions')
        .insert({
          fan_id: fanId,
          model_id: modelId,
          offer_id: type === 'compra' ? offerId : null,
          type: type,
          amount: parseFloat(amount),
          ts: new Date().toISOString()
        })

      if (transError) throw transError

      // Update fan's spent_total and tier
      const { data: fan } = await supabase
        .from('fans')
        .select('spent_total')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .single()

      const newTotal = (fan?.spent_total || 0) + parseFloat(amount)
      
      // Calculate new tier
      let newTier = 'FREE'
      if (newTotal >= 1000) newTier = 'WHALE'
      else if (newTotal >= 200) newTier = 'VIP'

      const { error: updateError } = await supabase
        .from('fans')
        .update({ 
          spent_total: newTotal,
          tier: newTier
        })
        .eq('fan_id', fanId)
        .eq('model_id', modelId)

      if (updateError) throw updateError

      alert(`✅ Transaction saved! New total: $${newTotal}`)
      
      // Reset form
      setType('compra')
      setAmount('')
      setOfferId('')
      
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('Error saving transaction: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>💰 Register Transaction</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#999'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              required
            >
              <option value="compra">Purchase (Compra)</option>
              <option value="tip">Tip</option>
            </select>
          </div>

          {/* Content Selection (only for purchases) */}
          {type === 'compra' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                Content
              </label>
              <select
                value={offerId}
                onChange={(e) => {
                  setOfferId(e.target.value)
                  const selected = catalog.find(c => c.offer_id === e.target.value)
                  if (selected) setAmount(selected.base_price.toString())
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                required
              >
                <option value="">Select content...</option>
                {catalog.map(item => (
                  <option key={item.offer_id} value={item.offer_id}>
                    {item.titulo} - ${item.base_price}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="0.00"
              required
              min="0"
            />
          </div>

          {/* Current Tier Info */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#1e40af' }}>
              <span style={{ fontWeight: '600' }}>Current Tier:</span> {fanTier}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#2563eb' }}>
              Tiers: FREE ($0-199) | VIP ($200-999) | WHALE ($1000+)
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
