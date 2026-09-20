import React, { useState } from 'react'
import StudentsTable from '../components/StudentsTable.jsx'
import EstadoHoyBoard from '../components/EstadoHoyBoard.jsx'
import HistorialEventos from '../components/HistorialEventos.jsx'
import FaltasPanel from '../components/FaltasPanel.jsx'
import TomarAsistencia from '../components/TomarAsistencia.jsx'
import CapturaLlegadasTarde from '../components/CapturaLlegadasTarde.jsx'
import SalidaAnticipada from '../components/SalidaAnticipada.jsx'
import DisponibilidadHorario from '../components/DisponibilidadHorario.jsx'
import AlertasAsistencia from '../components/AlertasAsistencia.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { tienePermiso, PERMISOS } from '../utils/roles.js'

// Panel compartido por Colaborador, Dirección, Supervisión, Recepción,
// Tutoría y Contraloría. Cada pestaña -incluidas las de solo consulta- se
// muestra únicamente si la persona tiene ese privilegio puntual prendido
// en su perfil (perfil.permisos). Un colaborador, por defecto, solo tiene
// "verAlumnos" y por lo tanto solo ve la pestaña de Alumnos (que incluye
// sus grupos); el resto de roles trae más privilegios de consulta
// prendidos de fábrica, y el administrador puede ajustar cualquiera de
// estas casillas por persona desde "Usuarios".
export default function GestionPanel() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState(null)

  const puede = (permiso) => tienePermiso(perfil, permiso)

  const tabs = [
    ...(puede(PERMISOS.VER_ESTADO) ? [{ id: 'estado', label: 'Estado de hoy' }] : []),
    ...(puede(PERMISOS.VER_ALERTAS) ? [{ id: 'alertas', label: 'Alertas' }] : []),
    ...(puede(PERMISOS.VER_DISPONIBILIDAD) ? [{ id: 'disponibilidad', label: 'Disponibilidad' }] : []),
    ...(puede(PERMISOS.CAPTURAR_RETARDOS) ? [{ id: 'llegadas', label: 'Llegadas tarde' }] : []),
    ...(puede(PERMISOS.SALIDA_ANTICIPADA) ? [{ id: 'anticipada', label: 'Salida anticipada' }] : []),
    ...(puede(PERMISOS.TOMAR_ASISTENCIA) ? [{ id: 'asistencia', label: 'Pase de lista' }] : []),
    ...(puede(PERMISOS.VER_ALUMNOS) ? [{ id: 'alumnos', label: 'Alumnos' }] : []),
    ...(puede(PERMISOS.VER_HISTORIAL) ? [{ id: 'historial', label: 'Historial' }] : []),
    ...(puede(PERMISOS.VER_FALTAS) ? [{ id: 'faltas', label: 'Faltas' }] : [])
  ]

  const tabActiva = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id

  if (!tabs.length) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          Tu cuenta todavía no tiene ningún privilegio activo. Pide al administrador que
          revise tus permisos en el panel de Usuarios.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tabActiva === t.id ? 'bg-[#10395a] text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabActiva === 'estado' && <EstadoHoyBoard />}
      {tabActiva === 'alertas' && <AlertasAsistencia />}
      {tabActiva === 'disponibilidad' && <DisponibilidadHorario />}
      {tabActiva === 'llegadas' && <CapturaLlegadasTarde />}
      {tabActiva === 'anticipada' && <SalidaAnticipada />}
      {tabActiva === 'asistencia' && <TomarAsistencia />}
      {/* editable=false siempre aquí: solo quien tiene el privilegio de
          "Editar alumnos" (por defecto, solo el administrador) puede
          editar la ficha; el resto de roles solo consultan. */}
      {tabActiva === 'alumnos' && <StudentsTable editable={false} allowComments={false} />}
      {tabActiva === 'historial' && <HistorialEventos />}
      {tabActiva === 'faltas' && <FaltasPanel />}
    </div>
  )
}
