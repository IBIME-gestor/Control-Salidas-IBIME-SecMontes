import React, { useState } from 'react'
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ESTADOS_ASISTENCIA, idAsistencia } from '../utils/asistencia.js'
import { ACCIONES, crearEvento, fechaHoyISO } from '../utils/eventos.js'

/**
 * Pensado para el personal en la entrada (recepción/supervisión) a partir
 * de las 7:10 am: captura la matrícula de quien llega tarde y queda
 * registrado de inmediato.
 *
 * IMPORTANTE (lecturas): como el ID de cada alumno en Firestore ES su
 * matrícula, buscar a un alumno por matrícula es 1 sola lectura por doc.id
 * (getDoc), nunca una consulta sobre toda la colección.
 */
export default function CapturaLlegadasTarde() {
  const { perfil, user } = useAuth()
  const [matricula, setMatricula] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [capturados, setCapturados] = useState([]) // solo en memoria de esta sesión

  async function capturar(e) {
    e.preventDefault()
    const mat = matricula.trim()
    if (!mat) return
    setBuscando(true)
    setMensaje('')
    try {
      const ref = doc(db, 'alumnos', mat)
      const snap = await getDoc(ref) // 1 lectura
      if (!snap.exists()) {
        setMensaje(`No se encontró ningún alumno con matrícula "${mat}".`)
        setBuscando(false)
        return
      }
      const alumno = { id: snap.id, ...snap.data() }
      const fecha = fechaHoyISO()
      const hora = new Date().toTimeString().slice(0, 5)

      await setDoc(doc(db, 'asistencia', idAsistencia(fecha, alumno.id)), {
        alumnoId: alumno.id,
        matricula: alumno.matricula,
        nombreAlumno: alumno.nombre,
        tutor: alumno.tutor || '',
        grupoEspanol: alumno.grupoEspanol || '',
        grupoIngles: alumno.grupoIngles || '',
        fecha,
        estado: ESTADOS_ASISTENCIA.RETARDO,
        horaLlegada: hora,
        registradoPorUid: user?.uid || null,
        registradoPorNombre: perfil?.nombre || user?.email || '',
        actualizadoEn: serverTimestamp()
      })

      await crearEvento({
        db, addDoc, collection, alumno,
        accion: ACCIONES.RETARDO,
        motivo: `Llegó a las ${hora} (capturado en recepción)`,
        autorUid: user?.uid,
        autorNombre: perfil?.nombre || user?.email
      })
      // El contador y la notificación al padre los maneja una Cloud
      // Function al detectar este evento.

      setCapturados((prev) => [{ matricula: alumno.matricula, nombre: alumno.nombre, hora }, ...prev].slice(0, 30))
      setMensaje(`Retardo registrado: ${alumno.nombre} (${hora}).`)
      setMatricula('')
    } catch (err) {
      console.error(err)
      setMensaje('Ocurrió un error al registrar. Intenta de nuevo.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-2">Llegadas tarde</h2>
      <p className="text-sm text-gray-500 mb-4">
        Captura la matrícula de cada alumno que llega después de las 7:00 am. Queda registrado de
        inmediato y su tutor lo verá reflejado en su pase de lista, sin duplicar el registro.
      </p>
      <form onSubmit={capturar} className="flex gap-2 mb-4">
        <input
          autoFocus
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          placeholder="Escanea o escribe la matrícula..."
          className="border rounded-lg px-3 py-2 text-sm flex-1"
        />
        <button
          disabled={buscando}
          className="bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          Registrar retardo
        </button>
      </form>
      {mensaje && <p className="text-sm text-blue-700 mb-4">{mensaje}</p>}

      {capturados.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">Capturados en esta sesión</h3>
          <ul className="text-sm divide-y">
            {capturados.map((c, i) => (
              <li key={i} className="py-1.5 flex justify-between">
                <span>{c.nombre} <span className="text-gray-400">({c.matricula})</span></span>
                <span className="text-amber-700">{c.hora}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
