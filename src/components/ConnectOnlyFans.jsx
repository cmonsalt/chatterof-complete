// src/components/ConnectOnlyFans.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SetupProgress from './SetupProgress'

export default function ConnectOnlyFans({ modelId, onSuccess }) {
  const [step, setStep] = useState('email') // email, polling, twofa, setup, success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [accountId, setAccountId] = useState(null)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: ''
  })

  // Step 1: Start authentication (via backend)
  const handleSubmitCredentials = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onlyfans/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      if (data.attempt_id) {
        setAttemptId(data.attempt_id)
        setStep('polling')
        pollAuthStatus(data.attempt_id)
      } else if (data.account_id) {
        setAccountId(data.account_id)
        await saveAccountId(data.account_id)
        setLoading(false)
      } else {
        throw new Error('No attempt_id or account_id in response')
      }

    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Step 2: Poll authentication status (via backend)
  const pollAuthStatus = async (id) => {
    try {
      const response = await fetch(`/api/onlyfans/check-auth-status?attemptId=${id}`)
      const data = await response.json()

      if (data.twoFactorPending) {
        setStep('twofa')
        setLoading(false)
        return
      }

      if (data.completed && data.account_id) {
        setAccountId(data.account_id)
        await saveAccountId(data.account_id)
        setLoading(false)
        return
      }

      if (data.status === 'pending' || data.status === 'authenticating') {
        setTimeout(() => pollAuthStatus(id), 2000)
        return
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setTimeout(() => pollAuthStatus(id), 2000)

    } catch (err) {
      console.error('Poll error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Step 3: Submit 2FA code (via backend)
  const handleSubmit2FA = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onlyfans/submit-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attemptId: attemptId,
          code: formData.twoFactorCode
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid 2FA code')
      }

      setStep('polling')
      pollAuthStatus(attemptId)

    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Step 4: Save account_id and trigger setup
  const saveAccountId = async (accId) => {
    try {
      const { error } = await supabase
        .from('models')
        .update({ 
          of_account_id: accId,
          connection_status: 'connected'
        })
        .eq('model_id', modelId)

      if (error) throw error

      setAccountId(accId)
      setStep('setup')

    } catch (err) {
      setError('Error saving connection: ' + err.message)
    }
  }

  const handleSetupComplete = () => {
    setStep('success')
    if (onSuccess) onSuccess(accountId)
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Email & Password */}
      {step === 'email' && (
        <form onSubmit={handleSubmitCredentials}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Connect OnlyFans Account
          </h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              OnlyFans Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              OnlyFans Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Connecting...' : 'Connect Account'}
          </button>

          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem' }}>
            🔒 Your credentials are encrypted and never stored in our database
          </p>
        </form>
      )}

      {/* Step 2: Polling */}
      {step === 'polling' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            Authenticating...
          </p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            This may take a few seconds
          </p>
        </div>
      )}

      {/* Step 3: 2FA Required */}
      {step === 'twofa' && (
        <form onSubmit={handleSubmit2FA}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Two-Factor Authentication
          </h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Enter 6-digit code from your authenticator app
            </label>
            <input
              type="text"
              value={formData.twoFactorCode}
              onChange={(e) => setFormData({ ...formData, twoFactorCode: e.target.value })}
              required
              maxLength={6}
              pattern="[0-9]{6}"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '0.5rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>
      )}

      {/* Step 4: Setup Progress */}
      {step === 'setup' && (
        <SetupProgress 
          modelId={modelId}
          accountId={accountId}
          onComplete={handleSetupComplete}
        />
      )}

      {/* Step 5: Success */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Setup Complete!
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Your account is ready to use
          </p>
        </div>
      )}
    </div>
  )
}
