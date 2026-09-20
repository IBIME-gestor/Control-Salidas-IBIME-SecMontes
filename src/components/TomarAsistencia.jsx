import React, { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where, orderBy, setDoc, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { esAdmin } from '../utils/roles.js'
import { suscribirMetaFiltros } from '../utils/meta.js'
import { ESTADOS_ASISTENCIA, ESTADO_LABELS, ESTADO_COLORES, idAsistencia } from '../utils/asistencia.js'
import { ACCIONES, crearEvento, fechaHoyISO } from '../utils/eventos.js'

/**
 * Pase de lista diario.
 *
 * IMPORTANTE (lecturas): nunca se carga la colección completa de alumnos.
 * Se consulta únicamente where('tutor', '==', tutorActivo), lo que trae
 * solo los ~20-30 alumnos de ese tutor. Igual para "asistencia": se
 * consulta where('fecha','==', hoy) AND where('tutor','==', tutorActivo).
 *
 * Por defecto, si un alumno no tiene registro de asistencia hoy se asume
 * "presente" (no se escribe nada) — el tutor solo marca las excepciones:
 * ausente, o retardo (que normalmente ya viene capturado por recepción/
 * supervisión desde el módulo de "Llegadas tarde" y aparece aquí solo).
 */
export default function TomarAsistencia() {
  const { perfil, user } = useAuth()
  // Solo admin puede elegir a cualquier tutor (para apoyar/revisar);
  // tutoría siempre trabaja con su propio grupo (perfil.tutorAsignado).
  const esGestion = esAdmin(perfil)

  const [meta, setMeta] = useState({ tutores: [] })
  const [alumnos, setAlumnos] = useState([])
  const [asistenciaHoy, setAsistenciaHoy] = useState({})
  const [tutorSeleccionado, setTutorSeleccionado] = useState('')
  const [horaLlegada, setHoraLlegada] = useState({})
  const fecha = fechaHoyISO()

  const tutorActivo = esGestion ? tutorSeleccionado : perfil?.tutorAsignado || ''

  useEffect(() => {
    if (esGestion) {
      const unsub = suscribirMetaFiltros(setMeta)
      return () => unsub()
    }
  }, [esGestion])

  useEffect(() => {
    if (!tutorActivo) {
      setAlumnos([])
      return
    }
    const q = query(collection(db, 'alumnos'), where('tutor', '==', tutorActivo), orderBy('nombre'))
    const unsub = onSnapshot(q, (snap) => setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return () => unsub()
  }, [tutorActivo])

  useEffect(() => {
    if (!tutorActivo) {
      setAsistenciaHoy({})
      return
    }
    const q = query(collection(db, 'asistencia'), where('fecha', '==', fecha), where('tutor', '==', tutorActivo))
    const unsub = onSnapshot(q, (snap) => {
      const mapa = {}
      snap.docs.forEach((d) => {
        mapa[d.data().alumnoId] = { id: d.id, ...d.data() }
      })
      setAsistenciaHoy(mapa)
    })
    return () => unsub()
  }, [tutorActivo, fecha])

  async function marcar(alumno, estadoNuevo, horaLlegadaValor = '') {
    const ref = doc(db, 'asistencia', idAsistencia(fecha, alumno.id))
    await setDoc(ref, {
      alumnoId: alumno.id,
      matricula: alumno.matricula,
      nombreAlumno: alumno.nombre,
      tutor: alumno.tutor || '',
      grupoEspanol: alumno.grupoEspanol || '',
      grupoIngles: alumno.grupoIngles || '',
      fecha,
      estado: estadoNuevo,
      horaLlegada: estadoNuevo === ESTADOS_ASISTENCIA.RETARDO ? horaLlegadaValor : '',
      registradoPorUid: user?.uid || null,
      registradoPorNombre: perfil?.nombre || user?.email || '',
      actualizadoEn: serverTimestamp()
    })

    // Nutre la base de control de salidas: una falta o un retardo en el
    // pase de lista también queda como evento en el historial general, y
    // suma al contador acumulado del alumno (para alertas/notificaciones).
    if (estadoNuevo === ESTADOS_ASISTENCIA.AUSENTE) {
      await crearEvento({
        db, addDoc, collection, alumno,
        accion: ACCIONES.FALTA,
        motivo: 'Registrada en el pase de lista',
        autorUid: user?.uid,
        autorNombre: perfil?.nombre || user?.email
      })
      // El contador y la notificación al padre los maneja una Cloud
      // Function al detectar este evento — así nunca se cuenta doble
      // sin importar desde qué pantalla se originó.
    } else if (estadoNuevo === ESTADOS_ASISTENCIA.RETARDO) {
      await crearEvento({
        db, addDoc, collection, alumno,
        accion: ACCIONES.RETARDO,
        motivo: horaLlegadaValor ? `Llegó a las ${horaLlegadaValor}` : 'Llegada tarde',
        autorUid: user?.uid,
        autorNombre: perfil?.nombre || user?.email
      })
    }
  }

  if (!esGestion && !perfil?.tutorAsignado) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
        Tu cuenta de tutoría no tiene un tutor asignado todavía. Pide al administrador que lo
        configure en el panel de usuarios (debe coincidir exactamente con el campo "tutor" del
        listado de alumnos).
      </div>
    )
  }

  const totalAusentes = Object.values(asistenciaHoy).filter((a) => a.estado === ESTADOS_ASISTENCIA.AUSENTE).length
  const totalRetardos = Object.values(asistenciaHoy).filter((a) => a.estado === ESTADOS_ASISTENCIA.RETARDO).length

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-semibold text-gray-800">Pase de lista ({fecha})</h2>
        {esGestion && (
          <select
            value={tutorSeleccionado}
            onChange={(e) => setTutorSeleccionado(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecciona un tutor</option>
            {meta.tutores.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {!tutorActivo && esGestion && (
        <p className="text-sm text-gray-400 text-center py-6">Elige un tutor para ver y tomar su lista.</p>
      )}

      {tutorActivo && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            Todos parten de "Presente" salvo que marques lo contrario. Si recepción ya capturó un
            retardo esta mañana, aparecerá reflejado automáticamente aquí.
            {(totalAusentes > 0 || totalRetardos > 0) && (
              <> · <span className="text-red-600">{totalAusentes} ausentes</span> · <span className="text-amber-600">{totalRetardos} con retardo</span></>
            )}
          </p>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Matrícula</th>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-left">Estado</th>
                  <th className="p-2 text-left">Hora de llegada</th>
                  <th className="p-2 text-left">Marcar</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => {
                  const registro = asistenciaHoy[a.id]
                  const estadoActual = registro?.estado || ESTADOS_ASISTENCIA.PRESENTE
                  return (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">{a.matricula}</td>
                      <td className="p-2 font-medium">{a.nombre}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${ESTADO_COLORES[estadoActual]}`}>
                          {ESTADO_LABELS[estadoActual]}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">{registro?.horaLlegada || '—'}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            onClick={() => marcar(a, ESTADOS_ASISTENCIA.PRESENTE)}
                            className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100"
                          >
                            Presente
                          </button>
                          <button
                            onClick={() => marcar(a, ESTADOS_ASISTENCIA.AUSENTE)}
                            className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Ausente
                          </button>
                          <input
                            type="time"
                            value={horaLlegada[a.id] || ''}
                            onChange={(e) => setHoraLlegada((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            className="border rounded px-1 py-0.5 text-[10px]"
                          />
                          <button
                            onClick={() => marcar(a, ESTADOS_ASISTENCIA.RETARDO, horaLlegada[a.id] || '')}
                            className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                          >
                            Retardo
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {alumnos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-400">
                      No hay alumnos registrados con este tutor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
