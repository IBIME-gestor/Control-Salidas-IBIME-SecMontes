import React, { useState } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ACCIONES, ACCIONES_RAPIDAS, ACCION_LABELS, crearEvento } from '../utils/eventos.js'

// Registra un evento inmutable en la colección "eventos": es la bitácora
// del día (equivalente a las hojas "Reporte salida (dd-MM-yyyy)" del
// sistema anterior). No se edita ni se borra desde la app.
export default function RegistrarAccion({ alumno }) {
  const { perfil, user } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [motivoFalta, setMotivoFalta] = useState('')
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)

  async function registrar(accion, motivo = '') {
    setGuardando(true)
    try {
      await crearEvento({
        db,
        addDoc,
        collection,
        alumno,
        accion,
        motivo,
        autorUid: user?.uid,
        autorNombre: perfil?.nombre || user?.email
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo registrar la acción. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarFalta() {
    if (!motivoFalta.trim()) return
    await registrar(ACCIONES.FALTA, motivoFalta.trim())
    setMotivoFalta('')
    setPidiendoMotivo(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {ACCIONES_RAPIDAS.map((accion) => (
          <button
            key={accion}
            disabled={guardando}
            onClick={() => registrar(accion)}
            className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {ACCION_LABELS[accion]}
          </button>
        ))}
        <button
          disabled={guardando}
          onClick={() => setPidiendoMotivo(!pidiendoMotivo)}
          className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {ACCION_LABELS[ACCIONES.FALTA]}
        </button>
      </div>
      {pidiendoMotivo && (
        <div className="flex gap-1 mt-1">
          <input
            value={motivoFalta}
            onChange={(e) => setMotivoFalta(e.target.value)}
            placeholder="Motivo de la falta"
            className="border rounded px-2 py-1 text-xs flex-1"
          />
          <button onClick={confirmarFalta} className="text-xs bg-red-600 text-white rounded px-2 py-1">
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}
