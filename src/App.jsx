import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Join from './pages/Join'
import ResetPassword from './pages/ResetPassword'
import SellerSignup from './pages/SellerSignup'
import PostScreen from './pages/PostScreen'
import SobreNosotros from './pages/info/SobreNosotros'
import ComoFunciona from './pages/info/ComoFunciona'
import PreguntasFrecuentes from './pages/info/PreguntasFrecuentes'
import ComoSerVendedor from './pages/info/ComoSerVendedor'
import RequisitosVendedor from './pages/info/RequisitosVendedor'
import Terminos from './pages/info/Terminos'
import Privacidad from './pages/info/Privacidad'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'

// Layout de páginas WEB públicas: contenido + footer del sitio.
// NO envuelve /app/* (AppShell) -> el footer nunca entra en la app interna tipo TikTok.
function PublicLayout() {
  return (<><Outlet /><Footer /></>)
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Páginas WEB públicas con footer del sitio (tema oscuro). La landing integra su
              propio footer en tema claro, por eso queda fuera de este layout. */}
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Onboarding público de vendedor (sin invitación ni membresía; fuera del muro). */}
            <Route path="/vender" element={<SellerSignup />} />
            <Route path="/post/:id" element={<PostScreen />} />
            {/* Páginas informativas del sitio (contenido aprobado). */}
            <Route path="/sobre-nosotros" element={<SobreNosotros />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
            <Route path="/como-ser-vendedor" element={<ComoSerVendedor />} />
            <Route path="/requisitos-vendedor" element={<RequisitosVendedor />} />
            {/* Páginas legales (versión preliminar, revisión legal posterior). */}
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
          </Route>
          <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/app/feed" replace /></ProtectedRoute>} />
          {/* Paso 1: el shell del marketplace es público; AppShell protege las pantallas de interacción */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/feed" replace />} />
            <Route path="feed" element={null} />
            <Route path="explore" element={null} />
            <Route path="create" element={null} />
            <Route path="messages" element={null} />
            <Route path="profile" element={null} />
            <Route path="travel" element={null} />
            <Route path="realestate" element={null} />
            <Route path="nutrition" element={null} />
            <Route path="store-local" element={null} />
            <Route path="store" element={null} />
            <Route path="network" element={null} />
            <Route path="chat/:conversationId" element={null} />
            <Route path="*" element={<Navigate to="/app/feed" replace />} />
          </Route>
          {/* Catch-all raíz: cualquier URL desconocida va a la landing (nunca pantalla negra). */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}