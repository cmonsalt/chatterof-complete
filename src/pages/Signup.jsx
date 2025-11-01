import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modelName, setModelName] = useState('')
  const [ofUsername, setOfUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Crear cuenta
      const { data: authData, error: authError } = await signUp(email, password, {
        role: 'client',
        model_name: modelName
      })

      if (authError) throw authError

      const userId = authData.user?.id
      if (!userId) throw new Error('No user ID')

      // 2. Crear model_id único
      const modelId = `${ofUsername || modelName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`

      console.log('✅ Creating model with ID:', modelId)

      // 3. Crear registro en tabla models
      const { error: modelError } = await supabase
        .from('models')
        .insert({
          model_id: modelId,
          user_id: userId,
          of_username: ofUsername || modelName,
          display_name: modelName,
          created_at: new Date().toISOString()
        })

      if (modelError) {
        console.error('❌ Error creating model:', modelError)
        throw new Error('Error creating model profile')
      }

      console.log('✅ Model created successfully')

      // 4. Actualizar user metadata con model_id
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          model_id: modelId,
          model_name: modelName 
        }
      })

      if (updateError) {
        console.error('❌ Error updating metadata:', updateError)
      }

      console.log('✅ User metadata updated with model_id')
      
      alert('Account created successfully! Please sign in.')
      navigate('/login')
    } catch (err) {
      console.error('💥 Signup error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '2rem',
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            Create Account
          </h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Start managing your OnlyFans chats with AI
          </p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              At least 6 characters
            </p>
          </div>

          <div>
            <label htmlFor="modelName" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Model Display Name
            </label>
            <input
              id="modelName"
              type="text"
              required
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., Sheyla"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
          </div>

          <div>
            <label htmlFor="ofUsername" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              OnlyFans Username
            </label>
            <input
              id="ofUsername"
              type="text"
              required
              value={ofUsername}
              onChange={(e) => setOfUsername(e.target.value)}
              placeholder="e.g., sheyla_hot"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Your OnlyFans username (for extension sync)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginTop: '0.5rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <a 
            href="/login" 
            style={{ 
              fontSize: '0.875rem', 
              color: '#3b82f6',
              textDecoration: 'none'
            }}
          >
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  )
}