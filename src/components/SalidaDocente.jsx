import React, { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getGruposAsignados } from '../utils/roles.js'
import {
  fechaHoyISO,
  nombreDiaHoy,
  ACCIONES_YA_SALIO,
  ACCION_LABELS,
  ultimoMovimientoPorAlumno
} from '../utils/eventos.js'
import { ESTADOS_ASISTENCIA } from '../utils/asistencia.js'
import { registrarSalidas, trasladarAEstancia, estadoSalidaProgramada, motivoTrasladoEstancia } from '../utils/salidas.js'

const ETIQUETA_PROGRAMACION = {
  si: { texto: 'Sale hoy', clase: 'bg-green-100 text-green-700' },
  no_aplica: { texto: 'No sale hoy', clase: 'bg-gray-100 text-gray-500' },
  sin_dias: { texto: 'Sin días asignados', clase: 'bg-amber-100 text-amber-700' },
  sin_tipo: { texto: 'Sin tipo asignado', clase: 'bg-gray-100 text-gray-400' }
}

/**
 * Flujo de salida del docente:
 *  1) Elige con qué grupo termina el día (si tiene más de uno asignado).
 *  2) Ve, para cada alumno, el tipo de salida que ya le asignó el rol
 *     correspondiente en "Alumnos" y si le toca salir hoy según sus días.
 *  3) Selecciona (checkbox) a quienes SÍ salen y da clic en "Registrar
 *     salida" — se guardan de una vez en la colección "salida" (con
 *     subcolección = la fecha de hoy, para consultarlo después) y en la
 *     bitácora de eventos.
 *  4) Al resto (los que no tienen pase o no les toca hoy) los puede
 *     enviar de un clic a Estancia — quedan marcados "En aula" hasta
 *     entonces, para que el profe de estancia los reciba desde su panel.
 */
export default function SalidaDocente() {
  const { perfil, user } = useAuth()
  const grupos = getGruposAsignados(perfil)
  const [grupoIdx, setGrupoIdx] = useState(0)
  const grupo = grupos[grupoIdx] || null

  const [alumnos, setAlumnos] = useState([])
  const [tiposSalida, setTiposSalida] = useState([])
  const [asistenciaHoy, setAsistenciaHoy] = useState({})
  const [eventosHoy, setEventosHoy] = useState({})
  const [seleccion, setSeleccion] = useState(new Set())
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const hoy = fechaHoyISO()
  const dia = nombreDiaHoy()

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tiposSalida'), (snap) => {
      setTiposSalida(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    setSeleccion(new Set())
    setMensaje('')
    if (!grupo) {
      setAlumnos([])
      return
    }
    const q = query(collection(db, 'alumnos'), where(grupo.tipo, '==', grupo.valor), orderBy('nombre'))
    const unsub = onSnapshot(q, (snap) => setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return () => unsub()
  }, [grupo?.tipo, grupo?.valor])

  useEffect(() => {
    if (!grupo) {
      setAsistenciaHoy({})
      return
    }
    const q = query(collection(db, 'asistencia'), where('fecha', '==', hoy), where(grupo.tipo, '==', grupo.valor))
    const unsub = onSnapshot(q, (snap) => {
      const mapa = {}
      snap.docs.forEach((d) => (mapa[d.data().alumnoId] = d.data().estado))
      setAsistenciaHoy(mapa)
    })
    return () => unsub()
  }, [grupo?.tipo, grupo?.valor, hoy])

  useEffect(() => {
    if (!grupo) {
      setEventosHoy({})
      return
    }
    const q = query(
      collection(db, 'eventos'),
      where('fecha', '==', hoy),
      where(grupo.tipo, '==', grupo.valor),
      orderBy('timestampISO', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setEventosHoy(ultimoMovimientoPorAlumno(snap.docs.map((d) => d.data())))
    })
    return () => unsub()
  }, [grupo?.tipo, grupo?.valor, hoy])

  const filas = useMemo(() => {
    return alumnos.map((a) => {
      const tipo = tiposSalida.find((t) => t.id === a.tipoSalidaId) || null
      const estadoAsistencia = asistenciaHoy[a.id] || ESTADOS_ASISTENCIA.PRESENTE
      const ausente = estadoAsistencia === ESTADOS_ASISTENCIA.AUSENTE
      const ultimoEvento = eventosHoy[a.id]
      const yaSalio = ultimoEvento && ACCIONES_YA_SALIO.includes(ultimoEvento.accion)
      const yaEnMovimiento = !!ultimoEvento // ya tiene traslado/entrega/salida hoy
      const descartado = ausente || yaSalio
      const programacion = estadoSalidaProgramada(a, tipo, dia)
      return { alumno: a, tipo, ausente, ultimoEvento, yaSalio, yaEnMovimiento, descartado, programacion }
    })
  }, [alumnos, tiposSalida, asistenciaHoy, eventosHoy, dia])

  const seleccionables = filas.filter((f) => !f.descartado && !f.yaEnMovimiento)
  const pendientesParaEstancia = seleccionables.filter((f) => !seleccion.has(f.alumno.id))

  function toggleSeleccion(id) {
    setSeleccion((prev) => {
      const set = new Set(prev)
      set.has(id) ? set.delete(id) : set.add(id)
      return set
    })
  }

  function toggleTodos() {
    if (seleccion.size === seleccionables.length) {
      setSeleccion(new Set())
    } else {
      setSeleccion(new Set(seleccionables.map((f) => f.alumno.id)))
    }
  }

  async function registrarSeleccionados() {
    const elegidos = seleccionables.filter((f) => seleccion.has(f.alumno.id)).map((f) => f.alumno)
    if (!elegidos.length) return
    setGuardando(true)
    try {
      await registrarSalidas({
        alumnos: elegidos,
        tiposSalida,
        grupoDocente: grupo,
        autor: { uid: user?.uid, nombre: perfil?.nombre || user?.email, correo: perfil?.id || user?.email }
      })
      setMensaje(`Salida registrada para ${elegidos.length} alumno(s).`)
      setSeleccion(new Set())
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al registrar la salida. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function enviarRestoAEstancia() {
    if (!pendientesParaEstancia.length) return
    if (!confirm(`¿Enviar a estancia a los ${pendientesParaEstancia.length} alumno(s) restantes (sin pase o no seleccionados)?`)) return
    setGuardando(true)
    try {
      await trasladarAEstancia({
        items: pendientesParaEstancia.map((f) => ({
          alumno: f.alumno,
          motivo: motivoTrasladoEstancia(f.tipo, f.programacion)
        })),
        grupoDocente: grupo,
        autor: { uid: user?.uid, nombre: perfil?.nombre || user?.email, correo: perfil?.id || user?.email }
      })
      setMensaje(`${pendientesParaEstancia.length} alumno(s) enviados a estancia.`)
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al enviar a estancia. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (!grupos.length) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
        Tu cuenta de docente todavía no tiene ningún grupo asignado. Pide al administrador que lo
        configure en el panel de Usuarios.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="font-semibold text-gray-800">Salida ({hoy})</h2>
        {grupos.length > 1 && (
          <select
            value={grupoIdx}
            onChange={(e) => setGrupoIdx(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {grupos.map((g, i) => (
              <option key={`${g.tipo}-${g.valor}`} value={i}>
                {g.valor} ({g.tipo === 'grupoIngles' ? 'inglés' : 'español'})
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Elige con qué grupo terminas el día. Marca a los alumnos que sí van saliendo y da clic en
        "Registrar salida"; al resto (sin pase o que no les toca hoy) puedes enviarlos a estancia con
        un solo clic.
      </p>

      {grupo && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <button onClick={toggleTodos} className="text-xs text-[#10395a] hover:underline">
              {seleccion.size === seleccionables.length && seleccionables.length > 0 ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
            <span className="text-sm text-gray-500">{seleccion.size} seleccionado(s) de {seleccionables.length} disponibles</span>
          </div>

          <div className="overflow-auto mb-4">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2 text-left">Matrícula</th>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-left">Tipo de salida</th>
                  <th className="p-2 text-left">Programación</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const prog = ETIQUETA_PROGRAMACION[f.programacion]
                  return (
                    <tr key={f.alumno.id} className={`border-t ${f.descartado || f.yaEnMovimiento ? 'bg-gray-50 text-gray-400' : ''}`}>
                      <td className="p-2">
                        {!f.descartado && !f.yaEnMovimiento && (
                          <input
                            type="checkbox"
                            checked={seleccion.has(f.alumno.id)}
                            onChange={() => toggleSeleccion(f.alumno.id)}
                          />
                        )}
                      </td>
                      <td className="p-2">{f.alumno.matricula}</td>
                      <td className="p-2 font-medium">{f.alumno.nombre}</td>
                      <td className="p-2">{f.tipo?.nombre || 'Sin asignar'}</td>
                      <td className="p-2">
                        <span className={`text-[10px] px-2 py-1 rounded-full ${prog.clase}`}>{prog.texto}</span>
                      </td>
                      <td className="p-2">
                        {f.ausente ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-600">Ausente</span>
                        ) : f.ultimoEvento ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                            {ACCION_LABELS[f.ultimoEvento.accion]} ({f.ultimoEvento.hora?.slice(0, 5)})
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">En aula</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!filas.length && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-400">No hay alumnos en este grupo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={registrarSeleccionados}
              disabled={guardando || seleccion.size === 0}
              className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : `Registrar salida (${seleccion.size})`}
            </button>
            <button
              onClick={enviarRestoAEstancia}
              disabled={guardando || pendientesParaEstancia.length === 0}
              className="bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              Enviar el resto a estancia ({pendientesParaEstancia.length})
            </button>
          </div>

          {mensaje && <p className="text-sm text-blue-700 mt-3">{mensaje}</p>}
        </>
      )}
    </div>
  )
}
