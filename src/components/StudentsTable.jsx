import React, { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { DIAS_SEMANA } from '../utils/roles.js'
import { useAuth } from '../context/AuthContext.jsx'
import { suscribirMetaFiltros } from '../utils/meta.js'
import { fechaHoyISO, ACCIONES_YA_SALIO, ACCION_LABELS } from '../utils/eventos.js'
import { ESTADOS_ASISTENCIA } from '../utils/asistencia.js'
import RegistrarAccion from './RegistrarAccion.jsx'

/**
 * Tabla de alumnos reutilizable.
 *
 * IMPORTANTE (lecturas de Firestore): esta tabla NUNCA carga la colección
 * completa de "alumnos" (puede tener 650+ documentos por plantel). Solo
 * consulta cuando hay un filtro activo (tutor, grupo español o grupo
 * inglés) o un lockedGroup fijo, usando where() para traer únicamente los
 * documentos que coinciden (normalmente 20-30). Las opciones de los
 * selectores salen de /meta/filtros (1 sola lectura), no de escanear
 * alumnos.
 *
 * - editable: permite asignar tipo de salida + días (dirección/supervisión/tutoría/admin)
 * - allowComments: permite dejar comentarios/observaciones (docentes)
 * - showActions: muestra botones para registrar eventos del día (docentes);
 *   además, si el alumno está "ausente" hoy o ya tuvo una salida (normal o
 *   anticipada), se descartan (deshabilitan) sus acciones de salida.
 * - lockedGroup: { tipo: 'grupoEspanol'|'grupoIngles', valor } fija el filtro (para docentes)
 */
export default function StudentsTable({ editable = false, allowComments = false, showActions = false, lockedGroup = null }) {
  const { perfil } = useAuth()
  const [meta, setMeta] = useState({ tutores: [], gruposEspanol: [], gruposIngles: [] })
  const [alumnos, setAlumnos] = useState([])
  const [tiposSalida, setTiposSalida] = useState([])
  const [asistenciaHoy, setAsistenciaHoy] = useState({})
  const [eventosHoy, setEventosHoy] = useState({})
  const [filtroTutor, setFiltroTutor] = useState('')
  const [filtroGrupoEsp, setFiltroGrupoEsp] = useState(lockedGroup?.tipo === 'grupoEspanol' ? lockedGroup.valor : '')
  const [filtroGrupoIng, setFiltroGrupoIng] = useState(lockedGroup?.tipo === 'grupoIngles' ? lockedGroup.valor : '')
  const [comentarioAbierto, setComentarioAbierto] = useState(null)
  const [textoComentario, setTextoComentario] = useState('')
  const hoy = fechaHoyISO()

  // Filtro efectivo: exactamente uno activo a la vez.
  const filtroActivo = lockedGroup
    ? { campo: lockedGroup.tipo, valor: lockedGroup.valor }
    : filtroTutor
    ? { campo: 'tutor', valor: filtroTutor }
    : filtroGrupoEsp
    ? { campo: 'grupoEspanol', valor: filtroGrupoEsp }
    : filtroGrupoIng
    ? { campo: 'grupoIngles', valor: filtroGrupoIng }
    : null

  useEffect(() => {
    const unsub = suscribirMetaFiltros(setMeta)
    const unsubTipos = onSnapshot(collection(db, 'tiposSalida'), (snap) => {
      setTiposSalida(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => {
      unsub()
      unsubTipos()
    }
  }, [])

  // Solo se consulta "alumnos" cuando hay un filtro concreto: trae nada más
  // los documentos de ese tutor/grupo (decenas, no cientos).
  useEffect(() => {
    if (!filtroActivo) {
      setAlumnos([])
      return
    }
    const q = query(
      collection(db, 'alumnos'),
      where(filtroActivo.campo, '==', filtroActivo.valor),
      orderBy('nombre')
    )
    const unsub = onSnapshot(q, (snap) => {
      setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [filtroActivo?.campo, filtroActivo?.valor])

  // Asistencia de hoy, acotada al mismo filtro (mismo campo/valor), para
  // saber quién está "ausente" y descartar sus acciones de salida.
  useEffect(() => {
    if (!showActions || !filtroActivo) {
      setAsistenciaHoy({})
      return
    }
    const q = query(
      collection(db, 'asistencia'),
      where('fecha', '==', hoy),
      where(filtroActivo.campo, '==', filtroActivo.valor)
    )
    const unsub = onSnapshot(q, (snap) => {
      const mapa = {}
      snap.docs.forEach((d) => {
        mapa[d.data().alumnoId] = d.data().estado
      })
      setAsistenciaHoy(mapa)
    })
    return () => unsub()
  }, [showActions, filtroActivo?.campo, filtroActivo?.valor, hoy])

  // Eventos de hoy, acotados al mismo filtro, para saber si el alumno ya
  // tuvo una salida (normal o anticipada) y descartarlo de acciones
  // repetidas. Nos quedamos con el último evento por alumno.
  useEffect(() => {
    if (!showActions || !filtroActivo) {
      setEventosHoy({})
      return
    }
    const q = query(
      collection(db, 'eventos'),
      where('fecha', '==', hoy),
      where(filtroActivo.campo, '==', filtroActivo.valor),
      orderBy('timestampISO', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const mapa = {}
      snap.docs.forEach((d) => {
        mapa[d.data().alumnoId] = d.data() // el último gana (orden asc)
      })
      setEventosHoy(mapa)
    })
    return () => unsub()
  }, [showActions, filtroActivo?.campo, filtroActivo?.valor, hoy])

  async function asignarTipoSalida(alumnoId, tipoSalidaId) {
    await updateDoc(doc(db, 'alumnos', alumnoId), { tipoSalidaId: tipoSalidaId || null })
  }

  async function toggleDia(alumno, dia) {
    const diasActuales = alumno.diasSalida || []
    const nuevos = diasActuales.includes(dia)
      ? diasActuales.filter((d) => d !== dia)
      : [...diasActuales, dia]
    await updateDoc(doc(db, 'alumnos', alumno.id), { diasSalida: nuevos })
  }

  async function enviarComentario(alumnoId) {
    if (!textoComentario.trim()) return
    await addDoc(collection(db, 'alumnos', alumnoId, 'comentarios'), {
      texto: textoComentario.trim(),
      autorNombre: perfil?.nombre || 'Docente',
      autorCorreo: perfil?.id || null,
      fecha: new Date().toISOString()
    })
    setTextoComentario('')
    setComentarioAbierto(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-wrap gap-3 mb-4">
        {!lockedGroup && (
          <>
            <select
              value={filtroTutor}
              onChange={(e) => {
                setFiltroTutor(e.target.value)
                setFiltroGrupoEsp('')
                setFiltroGrupoIng('')
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Filtrar por tutor...</option>
              {meta.tutores.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filtroGrupoEsp}
              onChange={(e) => {
                setFiltroGrupoEsp(e.target.value)
                setFiltroTutor('')
                setFiltroGrupoIng('')
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Filtrar por grupo de español...</option>
              {meta.gruposEspanol.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={filtroGrupoIng}
              onChange={(e) => {
                setFiltroGrupoIng(e.target.value)
                setFiltroTutor('')
                setFiltroGrupoEsp('')
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Filtrar por grupo de inglés...</option>
              {meta.gruposIngles.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </>
        )}
        <span className="text-sm text-gray-500 self-center">
          {filtroActivo ? `${alumnos.length} alumnos` : ''}
        </span>
      </div>

      {!filtroActivo && (
        <p className="text-sm text-gray-400 py-6 text-center">
          Elige un tutor, grupo de español o grupo de inglés para ver la lista (así evitamos leer
          a todos los alumnos del plantel de una sola vez).
        </p>
      )}

      {filtroActivo && (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Matrícula</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Tutor</th>
                <th className="p-2 text-left">Gpo. Esp.</th>
                <th className="p-2 text-left">Gpo. Ing.</th>
                <th className="p-2 text-left">Tipo de salida</th>
                <th className="p-2 text-left">Días</th>
                {showActions && <th className="p-2 text-left">Asistencia / Registrar</th>}
                {allowComments && <th className="p-2 text-left">Observaciones</th>}
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => {
                // Por defecto, si no hay registro de asistencia hoy, se
                // asume "presente" (así el tutor no tiene que marcar a
                // todos uno por uno, solo las excepciones).
                const estadoAsistencia = asistenciaHoy[a.id] || ESTADOS_ASISTENCIA.PRESENTE
                const ausente = estadoAsistencia === ESTADOS_ASISTENCIA.AUSENTE
                const ultimoEvento = eventosHoy[a.id]
                const yaSalio = ultimoEvento && ACCIONES_YA_SALIO.includes(ultimoEvento.accion)
                const descartado = ausente || yaSalio
                return (
                  <React.Fragment key={a.id}>
                    <tr className={`border-t align-top ${descartado ? 'bg-gray-50 text-gray-400' : ''}`}>
                      <td className="p-2">{a.matricula}</td>
                      <td className="p-2 font-medium">{a.nombre}</td>
                      <td className="p-2">{a.tutor}</td>
                      <td className="p-2">{a.grupoEspanol}</td>
                      <td className="p-2">{a.grupoIngles}</td>
                      <td className="p-2">
                        {editable ? (
                          <select
                            value={a.tipoSalidaId || ''}
                            onChange={(e) => asignarTipoSalida(a.id, e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                          >
                            <option value="">Sin asignar</option>
                            {tiposSalida.map((t) => (
                              <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          tiposSalida.find((t) => t.id === a.tipoSalidaId)?.nombre || 'Sin asignar'
                        )}
                      </td>
                      <td className="p-2">
                        {editable ? (
                          <div className="flex flex-wrap gap-1">
                            {DIAS_SEMANA.map((dia) => (
                              <button
                                key={dia}
                                onClick={() => toggleDia(a, dia)}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  (a.diasSalida || []).includes(dia)
                                    ? 'bg-[#10395a] text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {dia.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          (a.diasSalida || []).join(', ') || '—'
                        )}
                      </td>
                      {showActions && (
                        <td className="p-2">
                          {ausente ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-600">
                              Ausente — sin acciones de salida
                            </span>
                          ) : yaSalio ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                              {ACCION_LABELS[ultimoEvento.accion]} ({ultimoEvento.hora?.slice(0, 5)}) — ya no está en el plantel
                            </span>
                          ) : (
                            <RegistrarAccion alumno={a} />
                          )}
                        </td>
                      )}
                      {allowComments && (
                        <td className="p-2">
                          <button
                            onClick={() => setComentarioAbierto(comentarioAbierto === a.id ? null : a.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Comentar
                          </button>
                        </td>
                      )}
                    </tr>
                    {allowComments && comentarioAbierto === a.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={9} className="p-3">
                          <textarea
                            value={textoComentario}
                            onChange={(e) => setTextoComentario(e.target.value)}
                            placeholder={`Observación sobre ${a.nombre}...`}
                            className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                            rows={2}
                          />
                          <button
                            onClick={() => enviarComentario(a.id)}
                            className="bg-[#10395a] text-white text-xs rounded-lg px-3 py-1.5"
                          >
                            Guardar observación
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
