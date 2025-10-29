import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [modelId, setModelId] = useState(null)
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserRole(session.user.id)
      } else {
        setRole(null)
        setModelId(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserRole = async (userId) => {
    try {
      // Cargar rol y modelos del usuario
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, model_id')
        .eq('user_id', userId)

      if (roleError) throw roleError

      if (roleData && roleData.length > 0) {
        setRole(roleData[0].role)
        
        // Si tiene modelos, cargar información de todos
        const modelIds = roleData.map(r => r.model_id).filter(Boolean)
        
        if (modelIds.length > 0) {
          const { data: modelsData, error: modelsError } = await supabase
            .from('models')
            .select('model_id, name, niche')
            .in('model_id', modelIds)

          if (!modelsError && modelsData) {
            setModels(modelsData)
            
            // Cargar modelo seleccionado del localStorage o usar el primero
            const savedModelId = localStorage.getItem('selectedModelId')
            const selectedModel = savedModelId 
              ? modelsData.find(m => m.model_id === savedModelId) || modelsData[0]
              : modelsData[0]
            
            setModelId(selectedModel.model_id)
            setCurrentModel(selectedModel)
          }
        }
      }
    } catch (err) {
      console.error('Error loading role:', err)
    } finally {
      setLoading(false)
    }
  }

  const switchModel = (modelId) => {
    const model = models.find(m => m.model_id === modelId)
    if (model) {
      setModelId(model.model_id)
      setCurrentModel(model)
      localStorage.setItem('selectedModelId', model.model_id)
    }
  }

  const signUp = async (email, password, userData) => {
    const { data, error } = await supabase.functions.invoke('auth-signup', {
      body: { email, password, ...userData }
    })

    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    role,
    modelId,
    models,
    currentModel,
    switchModel,
    loading,
    signUp,
    signIn,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
