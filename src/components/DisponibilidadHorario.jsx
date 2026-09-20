import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { suscribirMetaHorario } from '../utils/meta.js'

/**
 * "¿Quién está libre a esta hora?" — sin escanear la colección completa
 * de horarios: se consulta where(dia, hora) (una fila por clase, tabla
 * chica, ~1,300 filas para 43 docentes) y se resta contra el universo de
 * docentes/salones que sale de /meta/horario (1 lectura).
 *
 * Es una consulta bajo demanda (botón "Consultar"), no en vivo: el horario
 * cambia una vez por semestre, no tiene sentido dejar un listener abierto.
 */
export default function DisponibilidadHorario() {
  const [meta, setMeta] = useState({ docentes: [], salones: [], dias: [], horas: [] })
  const [dia, setDia] = useState('')
  const [hora, setHora] = useState('')
  const [resultado, setResultado] = useState(null)
  const [consultando, setConsultando] = useState(false)

  useEffect(() => {
    const unsub = suscribirMetaHorario(setMeta)
    return () => unsub()
  }, [])

  async function consultar(e) {
    e.preventDefault()
    if (!dia || !hora) return
    setConsultando(true)
    setResultado(null)
    try {
      const q = query(collection(db, 'horarios'), where('dia', '==', dia), where('hora', '==', hora))
      const snap = await getDocs(q) // consulta puntual, no listener
      const ocupados = snap.docs.map((d) => d.data())
      const docentesOcupados = new Set(ocupados.map((o) => o.docente).filter(Boolean))
      const salonesOcupados = new Set(ocupados.map((o) => o.salon).filter(Boolean))

      setResultado({
        clasesEnCurso: ocupados,
        docentesLibres: meta.docentes.filter((d) => !docentesOcupados.has(d)),
        salonesLibres: meta.salones.filter((s) => !salonesOcupados.has(s))
      })
    } catch (err) {
      console.error(err)
    } finally {
      setConsultando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-2">Disponibilidad</h2>
      <p className="text-sm text-gray-500 mb-4">
        Consulta qué profesores están libres y qué salones están vacíos en un día/hora concretos.
      </p>

      <form onSubmit={consultar} className="flex flex-wrap gap-3 mb-6">
        <select value={dia} onChange={(e) => setDia(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Día...</option>
          {meta.dias.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={hora} onChange={(e) => setHora(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Hora/periodo...</option>
          {meta.horas.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <button
          disabled={consultando || !dia || !hora}
          className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
        >
          {consultando ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {resultado && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Profesores libres ({resultado.docentesLibres.length})
            </h3>
            <ul className="text-sm divide-y border rounded-lg">
              {resultado.docentesLibres.map((d) => (
                <li key={d} className="px-3 py-1.5">{d}</li>
              ))}
              {resultado.docentesLibres.length === 0 && (
                <li className="px-3 py-1.5 text-gray-400">Nadie libre a esta hora.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Salones vacíos ({resultado.salonesLibres.length})
            </h3>
            <ul className="text-sm divide-y border rounded-lg">
              {resultado.salonesLibres.map((s) => (
                <li key={s} className="px-3 py-1.5">{s}</li>
              ))}
              {resultado.salonesLibres.length === 0 && (
                <li className="px-3 py-1.5 text-gray-400">No hay salones vacíos a esta hora.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
