// src/pages/AuthCallback.jsx
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ofAPI } from '../services/onlyfans-api'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { modelId } = useAuth()
  
  useEffect(() => {
    const accountId = searchParams.get('account_id')
    
    if (accountId && modelId) {
      supabase.from('models')
        .update({ of_account_id: accountId })
        .eq('model_id', modelId)
        .then(() => {
          ofAPI.fullSync(accountId).then(() => {
            navigate('/dashboard')
          })
        })
    }
  }, [])

  return <div>Conectando OnlyFans...</div>
}