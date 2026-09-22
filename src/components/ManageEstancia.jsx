import React, { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db, DOMINIO_PERMITIDO } from '../firebase.js'
import { DIAS_SEMANA } from '../utils/roles.js'
import { GRADOS, etiquetaGrado } from '../utils/grados.js'
import { COLECCION_ASIGNACIONES_ESTANCIA } from '../utils/estancia.js'

function nuevoIdTurno() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function turnoVacio() {
  return { id: nuevoIdTurno(), dias: [], salon: '', grados: [] }
}

function FormTurno({ turno, onChange, onEliminar }) {
  function toggleDia(dia) {
    const dias = turno.dias.includes(dia) ? turno.dias.filter((d) => d !== dia) : [...turno.dias, dia]
    onChange({ ...turno, dias })
  }
  function toggleGrado(grado) {
    const grados = turno.grados.includes(grado)
      ? turno.grados.filter((g) => g !== grado)
      : [...turno.grados, grado]
    onChange({ ...turno, grados })
  }
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex flex-wrap gap-1">
        {DIAS_SEMANA.map((dia) => (
          <button
            type="button"
            key={dia}
            onClick={() => toggleDia(dia)}
            className={`text-[10px] px-2 py-1 rounded ${
              turno.dias.includes(dia) ? 'bg-[#10395a] text-white' : 'bg-white border text-gray-500'
            }`}
          >
            {dia.slice(0, 3)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <input
          placeholder="Salón (ej. Salón 3)"
          value={turno.salon}
          onChange={(e) => onChange({ ...turno, salon: e.target.value })}
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[140px]"
        />
        <div className="flex gap-1">
          {GRADOS.map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => toggleGrado(g)}
              className={`text-xs px-2 py-1 rounded-full ${
                turno.grados.includes(g) ? 'bg-[#e31e24] text-white' : 'bg-white border text-gray-500'
              }`}
            >
              {etiquetaGrado(g)}
            </button>
          ))}
        </div>
        <button type="button" onClick={onEliminar} className="text-red-600 text-xs hover:underline ml-auto">
          Quitar turno
        </button>
      </div>
    </div>
  )
}

export default function ManageEstancia() {
  const [asignaciones, setAsignaciones] = useState([])
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [turnos, setTurnos] = useState([turnoVacio()])
  const [estado, setEstado] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [edicion, setEdicion] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLECCION_ASIGNACIONES_ESTANCIA), (snap) => {
      setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  function agregarTurno() {
    setTurnos((prev) => [...prev, turnoVacio()])
  }

  async function guardar(e) {
    e.preventDefault()
    const correoNormalizado = correo.trim().toLowerCase()
    if (!correoNormalizado.endsWith('@' + DOMINIO_PERMITIDO)) {
      setEstado(`El correo debe ser de dominio @${DOMINIO_PERMITIDO}.`)
      return
    }
    const turnosValidos = turnos.filter((t) => t.dias.length && t.salon.trim() && t.grados.length)
    if (!turnosValidos.length) {
      setEstado('Agrega al menos un turno con días, salón y grado.')
      return
    }
    setEstado('Guardando...')
    try {
      await setDoc(doc(db, COLECCION_ASIGNACIONES_ESTANCIA, correoNormalizado), {
        correo: correoNormalizado,
        nombre: nombre.trim(),
        turnos: turnosValidos
      })
      setEstado(`${correoNormalizado} guardado. Recuerda también darle el rol "Estancia" en Usuarios.`)
      setCorreo('')
      setNombre('')
      setTurnos([turnoVacio()])
    } catch (err) {
      console.error(err)
      setEstado('Error al guardar: ' + (err.code || err.message))
    }
  }

  function empezarEdicion(a) {
    setEditandoId(a.id)
    setEdicion({ nombre: a.nombre || '', turnos: (a.turnos || []).map((t) => ({ ...t })) })
  }

  async function guardarEdicion(id) {
    const turnosValidos = edicion.turnos.filter((t) => t.dias.length && t.salon.trim() && t.grados.length)
    try {
      await setDoc(
        doc(db, COLECCION_ASIGNACIONES_ESTANCIA, id),
        { nombre: edicion.nombre.trim(), turnos: turnosValidos },
        { merge: true }
      )
      setEditandoId(null)
      setEdicion(null)
    } catch (err) {
      console.error(err)
      alert('Error al guardar: ' + (err.code || err.message))
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Quitar la asignación de estancia de esta persona?')) return
    await deleteDoc(doc(db, COLECCION_ASIGNACIONES_ESTANCIA, id))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-2">Estancia</h2>
      <p className="text-xs text-gray-500 mb-4">
        Define, por correo, qué días, en qué salón y para qué grado(s) recibe alumnos cada profe de
        estancia. Un mismo profe puede tener varios turnos (por ejemplo, distinto salón o grado según
        el día). No olvides además darle el rol <strong>Estancia</strong> a esa persona desde
        "Usuarios" para que le aparezca su panel.
      </p>

      <form onSubmit={guardar} className="border rounded-xl p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            type="email"
            placeholder={`correo@${DOMINIO_PERMITIDO}`}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Nombre (opcional, solo para identificarlo aquí)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          {turnos.map((t, i) => (
            <FormTurno
              key={t.id}
              turno={t}
              onChange={(nuevo) => setTurnos((prev) => prev.map((x, idx) => (idx === i ? nuevo : x)))}
              onEliminar={() => setTurnos((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
        <button type="button" onClick={agregarTurno} className="text-xs text-[#10395a] hover:underline">
          + Agregar otro turno
        </button>

        <button className="block bg-[#10395a] text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-[#0c2c47]">
          Guardar asignación
        </button>
      </form>

      {estado && <p className="text-sm text-blue-700 mb-4">{estado}</p>}

      <div className="space-y-3">
        {asignaciones.map((a) => (
          <div key={a.id} className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-gray-800">{a.nombre || a.id}</p>
                <p className="text-xs text-gray-500">{a.correo || a.id}</p>
              </div>
              <div className="flex gap-3">
                {editandoId === a.id ? (
                  <button onClick={() => setEditandoId(null)} className="text-gray-500 text-xs hover:underline">
                    Cerrar
                  </button>
                ) : (
                  <button onClick={() => empezarEdicion(a)} className="text-[#10395a] text-xs hover:underline">
                    Editar
                  </button>
                )}
                <button onClick={() => eliminar(a.id)} className="text-red-600 text-xs hover:underline">
                  Eliminar
                </button>
              </div>
            </div>

            {editandoId !== a.id ? (
              <ul className="text-xs text-gray-600 space-y-1">
                {(a.turnos || []).map((t, i) => (
                  <li key={t.id || i}>
                    {(t.dias || []).join(', ')} · Salón: {t.salon} · Grado(s):{' '}
                    {(t.grados || []).map(etiquetaGrado).join(', ')}
                  </li>
                ))}
                {!(a.turnos || []).length && <li className="text-gray-400">Sin turnos configurados.</li>}
              </ul>
            ) : (
              <div className="space-y-2">
                <input
                  placeholder="Nombre"
                  value={edicion.nombre}
                  onChange={(e) => setEdicion((p) => ({ ...p, nombre: e.target.value }))}
                  className="border rounded-lg px-3 py-1.5 text-sm w-full"
                />
                {edicion.turnos.map((t, i) => (
                  <FormTurno
                    key={t.id || i}
                    turno={t}
                    onChange={(nuevo) =>
                      setEdicion((p) => ({ ...p, turnos: p.turnos.map((x, idx) => (idx === i ? nuevo : x)) }))
                    }
                    onEliminar={() => setEdicion((p) => ({ ...p, turnos: p.turnos.filter((_, idx) => idx !== i) }))}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setEdicion((p) => ({ ...p, turnos: [...p.turnos, turnoVacio()] }))}
                  className="text-xs text-[#10395a] hover:underline"
                >
                  + Agregar otro turno
                </button>
                <button
                  onClick={() => guardarEdicion(a.id)}
                  className="block bg-[#10395a] text-white rounded-lg py-1.5 px-4 text-xs font-medium hover:bg-[#0c2c47]"
                >
                  Guardar cambios
                </button>
              </div>
            )}
          </div>
        ))}
        {!asignaciones.length && <p className="text-sm text-gray-400 text-center py-4">Sin profes de estancia asignados todavía.</p>}
      </div>
    </div>
  )
}
