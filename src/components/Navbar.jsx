import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS, getRoles } from '../utils/roles.js'
import RelojMexico from './RelojMexico.jsx'

export default function Navbar() {
  const { perfil, user, signOut } = useAuth()
  const etiquetaRoles = getRoles(perfil)
    .map((r) => ROLE_LABELS[r] || r)
    .join(' / ') || 'Sin rol asignado'
  return (
    <div className="bg-white border-b-2 border-[#e31e24] px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <img src="/logo-ibime.webp" alt="IBIME" className="h-8 w-auto" />
        <div>
          <h1 className="font-bold text-[#10395a] leading-tight">Control de Salidas</h1>
          <p className="text-xs text-gray-500">
            {perfil?.nombre || user?.email} · {etiquetaRoles}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <RelojMexico />
        <button
          onClick={signOut}
          className="text-sm text-gray-600 hover:text-[#e31e24] border rounded-lg px-3 py-1.5"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

