import React, { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import { ACCIONES, ACCION_LABELS, fechaHoyISO } from '../utils/eventos.js'

// Consulta la bitácora completa de una fecha (todas las acciones, en el
// orden en que ocurrieron). No se puede editar ni borrar desde aquí:
// es el registro histórico auditable.
export default function HistorialEventos() {
  const [fecha, setFecha] = useState(fechaHoyISO())
  const [eventos, setEventos] = useState([])
  const [incluirFaltas, setIncluirFaltas] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'eventos'), where('fecha', '==', fecha), orderBy('timestampISO', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [fecha])

  const filtrados = incluirFaltas ? eventos : eventos.filter((e) => e.accion !== ACCIONES.FALTA)

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-4">Historial de eventos</h2>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={incluirFaltas} onChange={(e) => setIncluirFaltas(e.target.checked)} />
          Incluir faltas
        </label>
        <span className="text-sm text-gray-500">{filtrados.length} eventos</span>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Hora</th>
              <th className="p-2 text-left">Matrícula</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Grupo</th>
              <th className="p-2 text-left">Acción</th>
              <th className="p-2 text-left">Motivo</th>
              <th className="p-2 text-left">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.id} className={`border-t ${e.accion === ACCIONES.FALTA ? 'bg-red-50' : ''}`}>
                <td className="p-2 text-gray-400">{e.hora}</td>
                <td className="p-2">{e.matricula}</td>
                <td className="p-2 font-medium">{e.nombreAlumno}</td>
                <td className="p-2">{e.grupoEspanol || e.grupoIngles}</td>
                <td className="p-2">{ACCION_LABELS[e.accion] || e.accion}</td>
                <td className="p-2 text-gray-500">{e.motivo}</td>
                <td className="p-2 text-gray-400">{e.autorNombre}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-400">
                  Sin eventos para esta fecha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
