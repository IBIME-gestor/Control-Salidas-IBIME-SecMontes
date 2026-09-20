import React, { useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * Fase 1 (sin Cloud Functions ni correo): un panel donde dirección,
 * tutoría o contraloría ven qué alumnos ya cruzaron el umbral de retardos
 * o faltas, para decidir cómo avisarle al padre (llamada, correo manual).
 *
 * Es 1 sola consulta con where() >= umbral sobre el campo contador —
 * Firestore indexa cada campo automáticamente, así que esto NUNCA escanea
 * los 650 alumnos: solo trae los que de verdad cumplen la condición.
 */
const UMBRAL_DEFAULT = 3

export default function AlertasAsistencia() {
  const [umbral, setUmbral] = useState(UMBRAL_DEFAULT)
  const [campo, setCampo] = useState('contadorRetardos')
  const [resultado, setResultado] = useState(null)
  const [consultando, setConsultando] = useState(false)

  async function consultar(e) {
    e.preventDefault()
    setConsultando(true)
    try {
      const q = query(
        collection(db, 'alumnos'),
        where(campo, '>=', Number(umbral)),
        orderBy(campo, 'desc')
      )
      const snap = await getDocs(q)
      setResultado(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setConsultando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-2">Alertas de asistencia</h2>
      <p className="text-sm text-gray-500 mb-4">
        Alumnos que ya acumularon varios retardos o faltas. Esto no le manda nada al padre
        automáticamente — es para que decidan cómo contactarlo.
      </p>

      <form onSubmit={consultar} className="flex flex-wrap items-center gap-3 mb-6">
        <select value={campo} onChange={(e) => setCampo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="contadorRetardos">Retardos acumulados</option>
          <option value="contadorFaltas">Faltas acumuladas</option>
        </select>
        <span className="text-sm text-gray-500">≥</span>
        <input
          type="number"
          min={1}
          value={umbral}
          onChange={(e) => setUmbral(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-20"
        />
        <button
          disabled={consultando}
          className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
        >
          {consultando ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {resultado && (
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Matrícula</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Tutor</th>
              <th className="p-2 text-left">Retardos</th>
              <th className="p-2 text-left">Faltas</th>
              <th className="p-2 text-left">Contacto padre</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.matricula}</td>
                <td className="p-2 font-medium">{a.nombre}</td>
                <td className="p-2">{a.tutor}</td>
                <td className="p-2 text-amber-700">{a.contadorRetardos || 0}</td>
                <td className="p-2 text-red-600">{a.contadorFaltas || 0}</td>
                <td className="p-2 text-gray-500">{a.correoPadre || a.telefonoPadre || 'Sin dato'}</td>
              </tr>
            ))}
            {resultado.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  Nadie cruza ese umbral por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
