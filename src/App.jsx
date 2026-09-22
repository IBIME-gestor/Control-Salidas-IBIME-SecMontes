import React from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Navbar from './components/Navbar.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import GestionPanel from './pages/GestionPanel.jsx'
import DocentePanel from './pages/DocentePanel.jsx'
import EstanciaPanel from './pages/EstanciaPanel.jsx'
import { esAdmin, esDocente, esEstancia } from './utils/roles.js'

export default function App() {
  const { user, perfil, cargando } = useAuth()

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  }

  if (!user) return <Login />

  if (!perfil) {
    // Justo después del primer inicio de sesión con Google, el propio
    // navegador crea el perfil de la persona (como "docente", sin grupo
    // asignado todavía) casi al instante. AuthContext escucha el documento
    // en vivo (onSnapshot), así que esta pantalla desaparece sola en cuanto
    // está listo.
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-md text-center">
          <p className="text-gray-700 mb-2">Estamos preparando tu acceso...</p>
          <p className="text-sm text-gray-500">
            Esto toma solo un instante la primera vez que entras. Si sigue igual después de
            recargar la página, pide al administrador que revise tu cuenta en el panel de Usuarios.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      {esAdmin(perfil) && <AdminPanel />}
      {!esAdmin(perfil) && esDocente(perfil) && <DocentePanel />}
      {!esAdmin(perfil) && !esDocente(perfil) && esEstancia(perfil) && <EstanciaPanel />}
      {!esAdmin(perfil) && !esDocente(perfil) && !esEstancia(perfil) && <GestionPanel />}
    </div>
  )
}
