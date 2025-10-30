import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ChatView from './pages/ChatView'
import Settings from './pages/Settings'
import ChatterDashboard from './pages/ChatterDashboard'
import ChatViewEnhanced from './pages/ChatViewEnhanced'

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

          {/* NUEVAS RUTAS - Chatter System */}
          <Route path="/chatter" element={
            <ProtectedRoute>
              <ChatterDashboard />
            </ProtectedRoute>
          } />

          <Route path="/chat-enhanced/:fanId" element={
            <ProtectedRoute>
              <ChatViewEnhanced />
            </ProtectedRoute>
          } />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
