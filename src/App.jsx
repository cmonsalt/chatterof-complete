import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ChatView from './pages/ChatView'
import Settings from './pages/Settings'
import ChatterMode from './pages/ChatterMode'  // ✅ Cambiado
import AuthCallback from './pages/AuthCallback'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/chat/:fanId" element={
            <ProtectedRoute>
              <ChatView />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />

          {/* ✅ ChatterMode con y sin fanId */}
          <Route path="/chatter" element={
            <ProtectedRoute>
              <ChatterMode />
            </ProtectedRoute>
          } />

          <Route path="/chatter/:fanId" element={
            <ProtectedRoute>
              <ChatterMode />
            </ProtectedRoute>
          } />

          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App