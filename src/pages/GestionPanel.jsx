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
import ConsultarReportes from '../components/ConsultarReportes.jsx'
import NavegacionModulos from '../components/NavegacionModulos.jsx'
import { armarCategorias } from '../utils/modulos.js'
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

  // Ids de los módulos a los que esta persona tiene acceso. "consultar"
  // se abre con su propio privilegio (consultarReportes) y, para no
  // dejar fuera a cuentas creadas antes de que existiera, también con el
  // de ver historial.
  const idsDisponibles = [
    ...(puede(PERMISOS.VER_ESTADO) ? ['estado'] : []),
    ...(puede(PERMISOS.VER_ALERTAS) ? ['alertas'] : []),
    ...(puede(PERMISOS.VER_DISPONIBILIDAD) ? ['disponibilidad'] : []),
    ...(puede(PERMISOS.CAPTURAR_RETARDOS) ? ['llegadas'] : []),
    ...(puede(PERMISOS.SALIDA_ANTICIPADA) ? ['anticipada'] : []),
    ...(puede(PERMISOS.TOMAR_ASISTENCIA) ? ['asistencia'] : []),
    ...(puede(PERMISOS.CONSULTAR_REPORTES) || puede(PERMISOS.VER_HISTORIAL) ? ['consultar'] : []),
    ...(puede(PERMISOS.VER_HISTORIAL) ? ['historial'] : []),
    ...(puede(PERMISOS.VER_FALTAS) ? ['faltas'] : []),
    ...(puede(PERMISOS.VER_ALUMNOS) ? ['alumnos'] : [])
  ]
  const categorias = armarCategorias(idsDisponibles)

  const tabActiva = tab && idsDisponibles.includes(tab) ? tab : categorias[0]?.modulos[0]?.id

  if (!categorias.length) {
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
      <NavegacionModulos categorias={categorias} activo={tabActiva} onChange={setTab} />
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
      {tabActiva === 'consultar' && <ConsultarReportes />}
      {tabActiva === 'historial' && <HistorialEventos />}
      {tabActiva === 'faltas' && <FaltasPanel />}
    </div>
  )
}
