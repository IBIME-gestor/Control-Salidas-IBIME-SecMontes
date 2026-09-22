import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import {
  suscribirRutas,
  guardarRuta,
  eliminarRuta,
  suscribirTransporteAlumnos,
  asignarTransporte,
  quitarTransporte
} from '../utils/transporte.js'

function BuscarAlumno() {
  const [matricula, setMatricula] = useState('')
  const [alumno, setAlumno] = useState(undefined) // undefined = sin buscar, null = no encontrado
  const [rutas, setRutas] = useState([])
  const [asignaciones, setAsignaciones] = useState({})
  const [rutaSeleccionada, setRutaSeleccionada] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [buscando, setBuscando] = useState(false)

  useEffect(() => suscribirRutas(setRutas), [])
  useEffect(() => suscribirTransporteAlumnos(setAsignaciones), [])

  async function buscar(e) {
    e.preventDefault()
    const m = matricula.trim()
    if (!m) return
    setBuscando(true)
    setMensaje('')
    try {
      const snap = await getDoc(doc(db, 'alumnos', m))
      setAlumno(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      const actual = asignaciones[m]
      setRutaSeleccionada(actual?.rutaId || '')
    } catch (err) {
      console.error(err)
      setMensaje('Error al buscar: ' + (err.code || err.message))
    } finally {
      setBuscando(false)
    }
  }

  async function guardar() {
    const ruta = rutas.find((r) => r.id === rutaSeleccionada)
    if (!ruta || !alumno) return
    try {
      await asignarTransporte({ alumno, ruta })
      setMensaje(`Transporte asignado: ${alumno.nombre} → ${ruta.nombre} (${ruta.operador}).`)
    } catch (err) {
      console.error(err)
      setMensaje('Error al guardar: ' + (err.code || err.message))
    }
  }

  async function quitar() {
    if (!alumno) return
    await quitarTransporte(alumno.id)
    setRutaSeleccionada('')
    setMensaje('Transporte retirado de este alumno.')
  }

  const asignacionActual = alumno ? asignaciones[alumno.id] : null

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-2">Buscar alumno por matrícula</h2>
      <form onSubmit={buscar} className="flex gap-2 mb-4">
        <input
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          placeholder="Matrícula"
          className="border rounded-lg px-3 py-2 text-sm flex-1"
        />
        <button
          disabled={buscando}
          className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {alumno === null && <p className="text-sm text-red-600">No se encontró ningún alumno con esa matrícula.</p>}

      {alumno && (
        <div className="border rounded-xl p-4 space-y-3">
          <div>
            <p className="font-medium text-gray-800">{alumno.nombre}</p>
            <p className="text-xs text-gray-500">
              Matrícula {alumno.matricula} · {alumno.grupoEspanol || 's/grupo esp.'} /{' '}
              {alumno.grupoIngles || 's/grupo ing.'}
            </p>
          </div>

          {asignacionActual && (
            <p className="text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-2">
              Ruta actual: <strong>{asignacionActual.rutaNombre}</strong> · Operador:{' '}
              <strong>{asignacionActual.operador}</strong>
            </p>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={rutaSeleccionada}
              onChange={(e) => setRutaSeleccionada(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecciona una ruta...</option>
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} — {r.operador}
                </option>
              ))}
            </select>
            <button
              onClick={guardar}
              disabled={!rutaSeleccionada}
              className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
            >
              Guardar asignación
            </button>
            {asignacionActual && (
              <button onClick={quitar} className="text-red-600 text-sm hover:underline">
                Quitar transporte
              </button>
            )}
          </div>
        </div>
      )}

      {mensaje && <p className="text-sm text-blue-700 mt-3">{mensaje}</p>}
    </div>
  )
}

function CatalogoRutas() {
  const [rutas, setRutas] = useState([])
  const [nombre, setNombre] = useState('')
  const [operador, setOperador] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [edicion, setEdicion] = useState({ nombre: '', operador: '' })

  useEffect(() => suscribirRutas(setRutas), [])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim() || !operador.trim()) return
    await guardarRuta({ nombre, operador })
    setNombre('')
    setOperador('')
  }

  async function guardarCambios(id) {
    await guardarRuta({ id, ...edicion })
    setEditandoId(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-2">Rutas de transporte</h2>
      <p className="text-xs text-gray-500 mb-4">Da de alta cada ruta con su operador para poder asignarlas a los alumnos.</p>

      <form onSubmit={agregar} className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Nombre de la ruta (ej. Ruta 4 - Norte)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <input
          placeholder="Operador"
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
        />
        <button className="bg-[#10395a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0c2c47]">
          Agregar ruta
        </button>
      </form>

      <div className="space-y-2">
        {rutas.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
            {editandoId === r.id ? (
              <div className="flex flex-1 gap-2">
                <input
                  value={edicion.nombre}
                  onChange={(e) => setEdicion((p) => ({ ...p, nombre: e.target.value }))}
                  className="border rounded-lg px-2 py-1 text-sm flex-1"
                />
                <input
                  value={edicion.operador}
                  onChange={(e) => setEdicion((p) => ({ ...p, operador: e.target.value }))}
                  className="border rounded-lg px-2 py-1 text-sm flex-1"
                />
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-800 text-sm">{r.nombre}</p>
                <p className="text-xs text-gray-500">Operador: {r.operador}</p>
              </div>
            )}
            <div className="flex gap-3 shrink-0">
              {editandoId === r.id ? (
                <button onClick={() => guardarCambios(r.id)} className="text-green-700 text-xs hover:underline">
                  Guardar
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditandoId(r.id)
                    setEdicion({ nombre: r.nombre, operador: r.operador })
                  }}
                  className="text-[#10395a] text-xs hover:underline"
                >
                  Editar
                </button>
              )}
              <button onClick={() => eliminarRuta(r.id)} className="text-red-600 text-xs hover:underline">
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {!rutas.length && <p className="text-sm text-gray-400 text-center py-4">Sin rutas dadas de alta todavía.</p>}
      </div>
    </div>
  )
}

// Contenido sin el contenedor de página (padding/max-width): se usa así
// dentro de AdminPanel, que ya trae su propio contenedor, para que el
// administrador también tenga acceso directo a esta función sin
// necesidad de que le den aparte el rol "Transporte".
export function TransporteContenido() {
  return (
    <div className="max-w-4xl">
      <BuscarAlumno />
      <CatalogoRutas />
    </div>
  )
}

// Página completa, con su propio contenedor: la usa App.jsx para quien
// tiene el rol "Transporte" como panel único.
export default function TransportePanel() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <TransporteContenido />
    </div>
  )
}
