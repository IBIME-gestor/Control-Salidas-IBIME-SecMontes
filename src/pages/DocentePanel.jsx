import React from 'react'
import SalidaDocente from '../components/SalidaDocente.jsx'

// El docente elige, entre su(s) grupo(s) asignado(s), con cuál termina el
// día y registra ahí la salida (ver SalidaDocente.jsx).
export default function DocentePanel() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SalidaDocente />
    </div>
  )
}
