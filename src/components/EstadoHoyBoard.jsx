import React, { useEffect, useMemo, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import { ACCIONES, ACCION_LABELS, fechaHoyISO, CATEGORIA_LABELS } from '../utils/eventos.js'

// Reconstruye, para cada alumno, su último evento del día (excluyendo
// FALTA, igual que el sistema anterior lo separaba en su propia hoja).
// Es el equivalente a obtenerEstadoHoy() del Apps Script.
export default function EstadoHoyBoard() {
  const [eventos, setEventos] = useState([])
  const [tiposSalida, setTiposSalida] = useState([])
  const [filtroTutor, setFiltroTutor] = useState('')
  const [filtroGrupoEsp, setFiltroGrupoEsp] = useState('')
  const [filtroGrupoIng, setFiltroGrupoIng] = useState('')
  const hoy = fechaHoyISO()

  useEffect(() => {
    const q = query(collection(db, 'eventos'), where('fecha', '==', hoy), orderBy('timestampISO', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    const unsub2 = onSnapshot(collection(db, 'tiposSalida'), (snap) => {
      setTiposSalida(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => {
      unsub()
      unsub2()
    }
  }, [hoy])

  const estadoPorAlumno = useMemo(() => {
    const mapa = {}
    eventos
      .filter((e) => e.accion !== ACCIONES.FALTA)
      .forEach((e) => {
        mapa[e.alumnoId] = e // como vienen ordenados asc, el último gana
      })
    return Object.values(mapa)
  }, [eventos])

  const tutores = useMemo(() => [...new Set(estadoPorAlumno.map((e) => e.tutor).filter(Boolean))].sort(), [estadoPorAlumno])
  const gruposEsp = useMemo(() => [...new Set(estadoPorAlumno.map((e) => e.grupoEspanol).filter(Boolean))].sort(), [estadoPorAlumno])
  const gruposIng = useMemo(() => [...new Set(estadoPorAlumno.map((e) => e.grupoIngles).filter(Boolean))].sort(), [estadoPorAlumno])

  const filtrados = estadoPorAlumno.filter((e) => {
    if (filtroTutor && e.tutor !== filtroTutor) return false
    if (filtroGrupoEsp && e.grupoEspanol !== filtroGrupoEsp) return false
    if (filtroGrupoIng && e.grupoIngles !== filtroGrupoIng) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Estado de hoy ({hoy})</h2>
        <span className="text-xs text-gray-400">Se actualiza en vivo</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroTutor} onChange={(e) => setFiltroTutor(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tutores</option>
          {tutores.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroGrupoEsp} onChange={(e) => setFiltroGrupoEsp(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los grupos de español</option>
          {gruposEsp.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filtroGrupoIng} onChange={(e) => setFiltroGrupoIng(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los grupos de inglés</option>
          {gruposIng.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtrados.length} con evento hoy</span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Matrícula</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Tutor</th>
              <th className="p-2 text-left">Último estado</th>
              <th className="p-2 text-left">Tipo de salida</th>
              <th className="p-2 text-left">Hora</th>
              <th className="p-2 text-left">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.alumnoId} className="border-t">
                <td className="p-2">{e.matricula}</td>
                <td className="p-2 font-medium">{e.nombreAlumno}</td>
                <td className="p-2">{e.tutor}</td>
                <td className="p-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {ACCION_LABELS[e.accion]}
                  </span>
                </td>
                <td className="p-2 text-gray-500">
                  {(() => {
                    const t = tiposSalida.find((ts) => ts.id === e.tipoSalidaId)
                    return t ? `${t.nombre} (${CATEGORIA_LABELS[t.categoria] || '—'})` : '—'
                  })()}
                </td>
                <td className="p-2 text-gray-400">{e.hora}</td>
                <td className="p-2 text-gray-400">{e.autorNombre}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-400">
                  Todavía no hay eventos registrados hoy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
