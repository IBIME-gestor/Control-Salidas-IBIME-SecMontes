import React, { useState } from 'react'
import { doc, getDoc, collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ACCIONES, crearEvento, fechaHoyISO } from '../utils/eventos.js'

/**
 * Pase de salida anticipada: para cuando el padre/tutor recoge al alumno
 * antes del horario normal (ej. la 1:00 pm en vez de las 3:30 pm).
 *
 * Flujo: se busca al alumno por matrícula (1 sola lectura, el ID del
 * documento es la matrícula), se captura quién lo recoge y el motivo, la
 * fecha/hora se toman automáticamente del reloj del dispositivo, y al
 * guardar queda un evento SALIDA_ANTICIPADA en la misma bitácora que usa
 * todo el control de salidas. Ese mismo evento es lo que hace que, más
 * tarde, el docente ya NO vea botones de acción para este alumno en la
 * salida normal de las 3:30 (ver StudentsTable / RegistrarAccion).
 */
export default function SalidaAnticipada() {
  const { perfil, user } = useAuth()
  const [matricula, setMatricula] = useState('')
  const [alumno, setAlumno] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [personaRecoge, setPersonaRecoge] = useState('')
  const [motivo, setMotivo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [registradas, setRegistradas] = useState([]) // solo en memoria de esta sesión

  async function buscar(e) {
    e.preventDefault()
    const mat = matricula.trim()
    if (!mat) return
    setBuscando(true)
    setMensaje('')
    setAlumno(null)
    try {
      const snap = await getDoc(doc(db, 'alumnos', mat)) // 1 lectura
      if (!snap.exists()) {
        setMensaje(`No se encontró ningún alumno con matrícula "${mat}".`)
        return
      }
      setAlumno({ id: snap.id, ...snap.data() })
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al buscar. Intenta de nuevo.')
    } finally {
      setBuscando(false)
    }
  }

  async function otorgar(e) {
    e.preventDefault()
    if (!alumno || !personaRecoge.trim() || !motivo.trim()) return
    setGuardando(true)
    try {
      const ahora = new Date()
      await crearEvento({
        db,
        addDoc,
        collection,
        alumno,
        accion: ACCIONES.SALIDA_ANTICIPADA,
        motivo: motivo.trim(),
        autorUid: user?.uid,
        autorNombre: perfil?.nombre || user?.email,
        extra: { personaRecoge: personaRecoge.trim() }
      })
      setRegistradas((prev) => [
        {
          matricula: alumno.matricula,
          nombre: alumno.nombre,
          personaRecoge: personaRecoge.trim(),
          motivo: motivo.trim(),
          hora: ahora.toTimeString().slice(0, 5)
        },
        ...prev
      ].slice(0, 30))
      setMensaje(`Salida anticipada registrada: ${alumno.nombre}.`)
      setAlumno(null)
      setMatricula('')
      setPersonaRecoge('')
      setMotivo('')
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const ahora = new Date()

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-2">Salida anticipada</h2>
      <p className="text-sm text-gray-500 mb-4">
        Para cuando un padre o tutor recoge al alumno antes del horario normal de salida. Queda
        registrado de inmediato y el alumno se descarta automáticamente de la salida normal que
        haría su docente más tarde.
      </p>

      {!alumno && (
        <form onSubmit={buscar} className="flex gap-2 mb-4">
          <input
            autoFocus
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="Escanea o escribe la matrícula..."
            className="border rounded-lg px-3 py-2 text-sm flex-1"
          />
          <button
            disabled={buscando}
            className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
          >
            Buscar
          </button>
        </form>
      )}

      {alumno && (
        <form onSubmit={otorgar} className="border rounded-xl p-4 mb-4 bg-blue-50/40">
          <div className="mb-3">
            <p className="font-medium text-gray-800">{alumno.nombre}</p>
            <p className="text-xs text-gray-500">
              Matrícula {alumno.matricula} · Tutor: {alumno.tutor || '—'} · Grupo esp.: {alumno.grupoEspanol || '—'} · Grupo ing.: {alumno.grupoIngles || '—'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Persona que recoge</label>
              <input
                required
                value={personaRecoge}
                onChange={(e) => setPersonaRecoge(e.target.value)}
                placeholder="Nombre de quien recoge al alumno"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha y hora (automático)</label>
              <input
                disabled
                value={`${fechaHoyISO()} · ${ahora.toTimeString().slice(0, 5)}`}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de la salida</label>
            <input
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Cita médica, trámite familiar..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Otorgar salida anticipada'}
            </button>
            <button
              type="button"
              onClick={() => setAlumno(null)}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mensaje && <p className="text-sm text-blue-700 mb-4">{mensaje}</p>}

      {registradas.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">Otorgadas en esta sesión</h3>
          <ul className="text-sm divide-y">
            {registradas.map((r, i) => (
              <li key={i} className="py-1.5">
                <div className="flex justify-between">
                  <span className="font-medium">{r.nombre} <span className="text-gray-400 font-normal">({r.matricula})</span></span>
                  <span className="text-blue-700">{r.hora}</span>
                </div>
                <p className="text-xs text-gray-500">Recoge: {r.personaRecoge} · Motivo: {r.motivo}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
