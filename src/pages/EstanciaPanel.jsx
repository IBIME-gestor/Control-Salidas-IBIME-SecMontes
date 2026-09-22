import React, { useEffect, useMemo, useState } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { suscribirAsignacionEstancia, turnosDeHoy, gradosDeHoy, salonParaGradoHoy } from '../utils/estancia.js'
import { etiquetaGrado } from '../utils/grados.js'
import {
  ACCIONES,
  fechaHoyISO,
  nombreDiaHoy,
  ultimoMovimientoPorAlumno,
  alumnoDesdeEvento
} from '../utils/eventos.js'
import { recibirEnEstancia } from '../utils/salidas.js'

/**
 * El profe de estancia no navega todo el plantel: solo ve, para el/los
 * turno(s) que le tocan HOY (día, salón, grado — asignados por el
 * administrador en "Estancia"), a los alumnos que un docente ya marcó
 * "Traslado a estancia" y que todavía no han sido entregados.
 */
export default function EstanciaPanel() {
  const { perfil, user } = useAuth()
  const correo = perfil?.id || perfil?.correo || ''
  const [asignacion, setAsignacion] = useState(null)
  const [eventosHoy, setEventosHoy] = useState([])
  const [seleccion, setSeleccion] = useState(new Set())
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const hoy = fechaHoyISO()
  const dia = nombreDiaHoy()

  useEffect(() => suscribirAsignacionEstancia(correo, setAsignacion), [correo])

  useEffect(() => {
    const q = query(collection(db, 'eventos'), where('fecha', '==', hoy), orderBy('timestampISO', 'asc'))
    const unsub = onSnapshot(q, (snap) => setEventosHoy(snap.docs.map((d) => d.data())))
    return () => unsub()
  }, [hoy])

  const turnosHoy = turnosDeHoy(asignacion, dia)
  const gradosHoy = gradosDeHoy(asignacion, dia)

  const movimientos = useMemo(() => ultimoMovimientoPorAlumno(eventosHoy), [eventosHoy])

  const pendientes = useMemo(() => {
    return Object.values(movimientos)
      .filter((e) => e.accion === ACCIONES.TRASLADO_ESTANCIA && gradosHoy.includes(e.grado))
      .sort((a, b) => (a.nombreAlumno || '').localeCompare(b.nombreAlumno || ''))
  }, [movimientos, gradosHoy])

  const recibidosHoy = useMemo(() => {
    return Object.values(movimientos)
      .filter((e) => e.accion === ACCIONES.ENTREGADO_ESTANCIA && gradosHoy.includes(e.grado))
      .sort((a, b) => (b.timestampISO || '').localeCompare(a.timestampISO || ''))
  }, [movimientos, gradosHoy])

  function toggleSeleccion(id) {
    setSeleccion((prev) => {
      const set = new Set(prev)
      set.has(id) ? set.delete(id) : set.add(id)
      return set
    })
  }

  function toggleTodos() {
    if (seleccion.size === pendientes.length) {
      setSeleccion(new Set())
    } else {
      setSeleccion(new Set(pendientes.map((e) => e.alumnoId)))
    }
  }

  async function recibirSeleccionados() {
    const elegidos = pendientes.filter((e) => seleccion.has(e.alumnoId))
    if (!elegidos.length) return
    setGuardando(true)
    try {
      await recibirEnEstancia({
        items: elegidos.map((e) => ({
          alumno: alumnoDesdeEvento(e),
          salon: salonParaGradoHoy(asignacion, dia, e.grado)
        })),
        autor: { uid: user?.uid, nombre: perfil?.nombre || user?.email, correo }
      })
      setMensaje(`${elegidos.length} alumno(s) recibido(s) en estancia.`)
      setSeleccion(new Set())
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al registrar la recepción. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (!asignacion || !turnosHoy.length) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          {!asignacion
            ? 'Tu cuenta de estancia todavía no tiene ningún turno asignado. Pide al administrador que lo configure en el panel de "Estancia".'
            : `Hoy (${dia}) no tienes ningún turno de estancia asignado.`}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">Estancia · {dia} ({hoy})</h2>
        <p className="text-xs text-gray-500 mb-4">
          {turnosHoy.map((t) => `${t.salon} — ${t.grados.map(etiquetaGrado).join(', ')}`).join(' · ')}
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button onClick={toggleTodos} className="text-xs text-[#10395a] hover:underline">
            {seleccion.size === pendientes.length && pendientes.length > 0 ? 'Quitar selección' : 'Seleccionar todos'}
          </button>
          <span className="text-sm text-gray-500">{seleccion.size} seleccionado(s) de {pendientes.length} por recibir</span>
        </div>

        <div className="overflow-auto mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2"></th>
                <th className="p-2 text-left">Matrícula</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Grado</th>
                <th className="p-2 text-left">Grupo</th>
                <th className="p-2 text-left">Motivo del traslado</th>
                <th className="p-2 text-left">Enviado</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((e) => (
                <tr key={e.alumnoId} className="border-t">
                  <td className="p-2">
                    <input type="checkbox" checked={seleccion.has(e.alumnoId)} onChange={() => toggleSeleccion(e.alumnoId)} />
                  </td>
                  <td className="p-2">{e.matricula}</td>
                  <td className="p-2 font-medium">{e.nombreAlumno}</td>
                  <td className="p-2">{etiquetaGrado(e.grado)}</td>
                  <td className="p-2">{e.grupoEspanol || e.grupoIngles}</td>
                  <td className="p-2 text-gray-500">{e.motivo}</td>
                  <td className="p-2 text-gray-400">{e.hora?.slice(0, 5)}</td>
                </tr>
              ))}
              {!pendientes.length && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-400">No hay alumnos pendientes por recibir.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={recibirSeleccionados}
          disabled={guardando || seleccion.size === 0}
          className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : `Recibir en estancia (${seleccion.size})`}
        </button>
        {mensaje && <p className="text-sm text-blue-700 mt-3">{mensaje}</p>}
      </div>

      {recibidosHoy.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Ya recibidos hoy ({recibidosHoy.length})</h3>
          <ul className="text-sm divide-y">
            {recibidosHoy.map((e) => (
              <li key={e.alumnoId} className="py-1.5 flex justify-between">
                <span>{e.nombreAlumno} <span className="text-gray-400">({e.matricula})</span></span>
                <span className="text-gray-500">{e.salonEstancia} · {e.hora?.slice(0, 5)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
