import React from 'react'
import StudentsTable from '../components/StudentsTable.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// El docente ve únicamente el grupo que tiene asignado en su perfil
// (grupoAsignado puede ser un grupo de español o de inglés, según cómo
// se haya dado de alta su cuenta).
export default function DocentePanel() {
  const { perfil } = useAuth()
  const grupo = perfil?.grupoAsignado || ''
  const tipoGrupo = perfil?.tipoGrupoAsignado || 'grupoEspanol'

  if (!grupo) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Tu cuenta de docente no tiene un grupo asignado todavía. Solicita al administrador
          que lo configure en el panel de usuarios.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-sm text-gray-500 mb-3">
        Mostrando tu grupo: <strong>{grupo}</strong> ({tipoGrupo === 'grupoIngles' ? 'inglés' : 'español'})
      </h2>
      <StudentsTable editable={false} allowComments showActions lockedGroup={{ tipo: tipoGrupo, valor: grupo }} />
    </div>
  )
}
