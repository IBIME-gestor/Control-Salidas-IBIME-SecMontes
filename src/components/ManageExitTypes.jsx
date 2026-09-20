import React, { useEffect, useState } from 'react'
import { collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { CATEGORIAS_SALIDA, CATEGORIA_LABELS } from '../utils/eventos.js'

export default function ManageExitTypes() {
  const [tipos, setTipos] = useState([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [requierePase, setRequierePase] = useState(true)
  const [categoria, setCategoria] = useState('EN_AULA')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tiposSalida'), (snap) => {
      setTipos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    await addDoc(collection(db, 'tiposSalida'), {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      requierePase,
      categoria
    })
    setNombre('')
    setDescripcion('')
    setRequierePase(true)
    setCategoria('EN_AULA')
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este tipo de salida? Los alumnos que lo tengan asignado quedarán sin tipo.')) return
    await deleteDoc(doc(db, 'tiposSalida', id))
  }

  async function toggleRequierePase(id, valorActual) {
    await updateDoc(doc(db, 'tiposSalida', id), { requierePase: !valorActual })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">Tipos de salida</h2>
      <form onSubmit={agregar} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <input
          placeholder="Nombre (ej. Salida con pase)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
        />
        <input
          placeholder="Descripción (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {CATEGORIAS_SALIDA.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={requierePase} onChange={(e) => setRequierePase(e.target.checked)} />
          Requiere pase
        </label>
        <button className="md:col-span-5 bg-[#10395a] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#0c2c47]">
          Agregar tipo de salida
        </button>
      </form>

      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Nombre</th>
            <th className="p-2 text-left">Categoría</th>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-left">Requiere pase</th>
            <th className="p-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {tipos.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2 font-medium">{t.nombre}</td>
              <td className="p-2 text-gray-500">{CATEGORIA_LABELS[t.categoria] || '—'}</td>
              <td className="p-2 text-gray-500">{t.descripcion}</td>
              <td className="p-2">
                <button
                  onClick={() => toggleRequierePase(t.id, t.requierePase)}
                  className={`text-xs px-2 py-1 rounded-full ${
                    t.requierePase ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t.requierePase ? 'Sí' : 'No'}
                </button>
              </td>
              <td className="p-2">
                <button onClick={() => eliminar(t.id)} className="text-red-600 text-xs hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
