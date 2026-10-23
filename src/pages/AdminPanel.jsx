import React, { useState } from 'react'
import UploadStudents from '../components/UploadStudents.jsx'
import UploadHorarios from '../components/UploadHorarios.jsx'
import ManageUsers from '../components/ManageUsers.jsx'
import ManageExitTypes from '../components/ManageExitTypes.jsx'
import ManageSupervisores from '../components/ManageSupervisores.jsx'
import ManageEstancia from '../components/ManageEstancia.jsx'
import { TransporteContenido } from './TransportePanel.jsx'
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
import { MODULOS, armarCategorias } from '../utils/modulos.js'

const IDS_MODULOS = Object.keys(MODULOS)
const CATEGORIAS_ADMIN = armarCategorias(IDS_MODULOS)

export default function AdminPanel() {
  const [tab, setTab] = useState('estado')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <NavegacionModulos categorias={CATEGORIAS_ADMIN} activo={tab} onChange={setTab} />

      {tab === 'estado' && <EstadoHoyBoard />}
      {tab === 'alertas' && <AlertasAsistencia />}
      {tab === 'disponibilidad' && <DisponibilidadHorario />}
      {tab === 'llegadas' && <CapturaLlegadasTarde />}
      {tab === 'anticipada' && <SalidaAnticipada />}
      {tab === 'asistencia' && <TomarAsistencia />}
      {tab === 'alumnos' && <StudentsTable editable allowComments={false} />}
      {tab === 'consultar' && <ConsultarReportes />}
      {tab === 'historial' && <HistorialEventos />}
      {tab === 'faltas' && <FaltasPanel />}
      {tab === 'carga' && <UploadStudents />}
      {tab === 'horario' && <UploadHorarios />}
      {tab === 'tipos' && <ManageExitTypes />}
      {tab === 'supervisores' && <ManageSupervisores />}
      {tab === 'estancia' && <ManageEstancia />}
      {tab === 'transporte' && <TransporteContenido />}
      {tab === 'usuarios' && <ManageUsers />}
    </div>
  )
}
