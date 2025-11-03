// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { modelId } = useAuth()
  const [status, setStatus] = useState('🔗 Conectando...')

  useEffect(() => {
    const connectAccount = async () => {
      try {
        const accountId = searchParams.get('account_id')
        
        console.log('Account ID:', accountId)
        console.log('Model ID:', modelId)
        
        if (!accountId) {
          setStatus('❌ No se recibió account_id')
          setTimeout(() => navigate('/settings'), 3000)
          return
        }

        if (!modelId) {
          setStatus('❌ No hay modelo seleccionado. Redirigiendo...')
          setTimeout(() => navigate('/dashboard'), 3000)
          return
        }

        setStatus('💾 Guardando conexión...')
        
        const { error } = await supabase
          .from('models')
          .update({ of_account_id: accountId })
          .eq('model_id', modelId)

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        setStatus('✅ ¡Conectado exitosamente!')

        setTimeout(() => {
          navigate('/settings')
        }, 2000)

      } catch (error) {
        console.error('Connection error:', error)
        setStatus('❌ Error: ' + error.message)
        setTimeout(() => navigate('/settings'), 3000)
      }
    }

    connectAccount()
  }, [searchParams, modelId, navigate])

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ fontSize: '4rem' }}>🔗</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>
        {status}
      </h2>
    </div>
  )
}