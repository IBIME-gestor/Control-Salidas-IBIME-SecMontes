import React, { useState } from 'react'
import UploadStudents from '../components/UploadStudents.jsx'
import UploadHorarios from '../components/UploadHorarios.jsx'
import ManageUsers from '../components/ManageUsers.jsx'
import ManageExitTypes from '../components/ManageExitTypes.jsx'
import ManageSupervisores from '../components/ManageSupervisores.jsx'
import StudentsTable from '../components/StudentsTable.jsx'
import EstadoHoyBoard from '../components/EstadoHoyBoard.jsx'
import HistorialEventos from '../components/HistorialEventos.jsx'
import FaltasPanel from '../components/FaltasPanel.jsx'
import TomarAsistencia from '../components/TomarAsistencia.jsx'
import CapturaLlegadasTarde from '../components/CapturaLlegadasTarde.jsx'
import SalidaAnticipada from '../components/SalidaAnticipada.jsx'
import DisponibilidadHorario from '../components/DisponibilidadHorario.jsx'
import AlertasAsistencia from '../components/AlertasAsistencia.jsx'

const TABS = [
  { id: 'estado', label: 'Estado de hoy' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'llegadas', label: 'Llegadas tarde' },
  { id: 'anticipada', label: 'Salida anticipada' },
  { id: 'asistencia', label: 'Pase de lista' },
  { id: 'alumnos', label: 'Alumnos' },
  { id: 'historial', label: 'Historial' },
  { id: 'faltas', label: 'Faltas' },
  { id: 'carga', label: 'Cargar listado' },
  { id: 'horario', label: 'Cargar horario' },
  { id: 'tipos', label: 'Tipos de salida' },
  { id: 'supervisores', label: 'Supervisores' },
  { id: 'usuarios', label: 'Usuarios' }
]

export default function AdminPanel() {
  const [tab, setTab] = useState('estado')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t.id ? 'bg-[#10395a] text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'estado' && <EstadoHoyBoard />}
      {tab === 'alertas' && <AlertasAsistencia />}
      {tab === 'disponibilidad' && <DisponibilidadHorario />}
      {tab === 'llegadas' && <CapturaLlegadasTarde />}
      {tab === 'anticipada' && <SalidaAnticipada />}
      {tab === 'asistencia' && <TomarAsistencia />}
      {tab === 'alumnos' && <StudentsTable editable allowComments={false} />}
      {tab === 'historial' && <HistorialEventos />}
      {tab === 'faltas' && <FaltasPanel />}
      {tab === 'carga' && <UploadStudents />}
      {tab === 'horario' && <UploadHorarios />}
      {tab === 'tipos' && <ManageExitTypes />}
      {tab === 'supervisores' && <ManageSupervisores />}
      {tab === 'usuarios' && <ManageUsers />}
    </div>
  )
}
