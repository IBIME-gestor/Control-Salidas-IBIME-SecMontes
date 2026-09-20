import React, { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import { ACCIONES, fechaHoyISO } from '../utils/eventos.js'

export default function FaltasPanel() {
  const [fecha, setFecha] = useState(fechaHoyISO())
  const [faltas, setFaltas] = useState([])

  useEffect(() => {
    const q = query(
      collection(db, 'eventos'),
      where('fecha', '==', fecha),
      where('accion', '==', ACCIONES.FALTA),
      orderBy('timestampISO', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setFaltas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [fecha])

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-4">Faltas</h2>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">{faltas.length} faltas registradas</span>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Hora</th>
            <th className="p-2 text-left">Matrícula</th>
            <th className="p-2 text-left">Nombre</th>
            <th className="p-2 text-left">Grupo</th>
            <th className="p-2 text-left">Motivo</th>
            <th className="p-2 text-left">Registrado por</th>
          </tr>
        </thead>
        <tbody>
          {faltas.map((f) => (
            <tr key={f.id} className="border-t bg-red-50">
              <td className="p-2 text-gray-400">{f.hora}</td>
              <td className="p-2">{f.matricula}</td>
              <td className="p-2 font-medium">{f.nombreAlumno}</td>
              <td className="p-2">{f.grupoEspanol || f.grupoIngles}</td>
              <td className="p-2 text-gray-600">{f.motivo}</td>
              <td className="p-2 text-gray-400">{f.autorNombre}</td>
            </tr>
          ))}
          {faltas.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-gray-400">
                Sin faltas registradas para esta fecha.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
