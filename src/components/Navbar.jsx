import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationBell from '../components/NotificationBell'

export default function Navbar() {
  const { user, models, currentModel, switchModel, signOut } = useAuth()
  const navigate = useNavigate()
  const [showModelSelector, setShowModelSelector] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelSelector(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleModelSwitch = (modelId) => {
    switchModel(modelId)
    setShowModelSelector(false)
    navigate('/dashboard')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-3 md:px-8 py-3 mb-4 md:mb-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
        <h1
          onClick={() => navigate('/dashboard')}
          className="text-lg md:text-2xl font-bold cursor-pointer text-blue-500"
        >
          ChatterOF 🔔
        </h1>

        <div className="flex gap-1 md:gap-3 items-center">
          {/* Notification Bell */}
          <NotificationBell />

          {/* Chatter Mode Button */}
          <button
            onClick={() => navigate('/chatter')}
            className="hidden md:flex px-3 md:px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg text-sm font-semibold items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <span>💬</span>
            <span>Chatter Mode</span>
          </button>

          {/* Model Selector */}
          {models.length > 0 && (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 px-2 md:px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm"
              >
                <span className="hidden md:inline">💎</span>
                <span className="truncate max-w-[80px] md:max-w-none">
                  {currentModel?.name || 'Select Model'}
                </span>
                <span className="text-xs">▼</span>
              </button>

              {/* Dropdown */}
              {showModelSelector && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] z-50">
                  <div className="p-2">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-600 border-b border-gray-200">
                      SELECT MODEL
                    </div>
                    {models.map((model) => (
                      <button
                        key={model.model_id}
                        onClick={() => handleModelSwitch(model.model_id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm mt-1 transition-colors ${
                          currentModel?.model_id === model.model_id
                            ? 'bg-gray-100 font-semibold text-blue-500'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {currentModel?.model_id === model.model_id && <span>✓</span>}
                          <div>
                            <div>{model.name}</div>
                            {model.niche && (
                              <div className="text-xs text-gray-400">
                                {model.niche}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email - solo desktop */}
          <span className="hidden lg:inline text-gray-600 text-sm">
            {user?.email}
          </span>

          {/* Settings - solo desktop */}
          <button
            onClick={() => navigate('/settings')}
            className="hidden md:block px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Settings
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
          >
            <span className="hidden md:inline">Sign Out</span>
            <span className="md:hidden">🚪</span>
          </button>
        </div>
      </div>
    </nav>
  )
}