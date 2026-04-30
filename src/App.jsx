import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Join from './pages/Join'
import Welcome from './pages/Welcome'
import Network from './pages/Network'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/app/feed" replace /></ProtectedRoute>} />
          <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/app/feed" replace />} />
            <Route path="feed" element={null} />
            <Route path="explore" element={null} />
            <Route path="create" element={null} />
            <Route path="messages" element={null} />
            <Route path="profile" element={null} />
            <Route path="travel" element={null} />
            <Route path="candystakes" element={null} />
            <Route path="realestate" element={null} />
            <Route path="nutrition" element={null} />
            <Route path="store-local" element={null} />
            <Route path="store" element={null} />
            <Route path="network" element={null} />
            <Route path="chat/:conversationId" element={null} />
            <Route path="*" element={<Navigate to="/app/feed" replace />} />
          </Route>
          <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}