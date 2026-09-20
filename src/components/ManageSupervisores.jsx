import React, { useEffect, useState } from 'react'
import { collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { DIAS_SEMANA } from '../utils/roles.js'

export default function ManageSupervisores() {
  const [supervisores, setSupervisores] = useState([])
  const [nombre, setNombre] = useState('')
  const [guardia, setGuardia] = useState('')
  const [dias, setDias] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'supervisores'), (snap) => {
      setSupervisores(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  function toggleDiaNuevo(dia) {
    setDias((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]))
  }

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    await addDoc(collection(db, 'supervisores'), {
      nombre: nombre.trim(),
      guardia: guardia.trim(),
      dias
    })
    setNombre('')
    setGuardia('')
    setDias([])
  }

  async function toggleDiaExistente(sup, dia) {
    const nuevos = (sup.dias || []).includes(dia)
      ? sup.dias.filter((d) => d !== dia)
      : [...(sup.dias || []), dia]
    await updateDoc(doc(db, 'supervisores', sup.id), { dias: nuevos })
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este supervisor del catálogo?')) return
    await deleteDoc(doc(db, 'supervisores', id))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-4">Supervisores</h2>
      <form onSubmit={agregar} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          placeholder="Nombre del profesor/supervisor"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="Punto de guardia / ubicación"
          value={guardia}
          onChange={(e) => setGuardia(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1 items-center">
          {DIAS_SEMANA.map((dia) => (
            <button
              type="button"
              key={dia}
              onClick={() => toggleDiaNuevo(dia)}
              className={`text-[10px] px-2 py-1 rounded ${
                dias.includes(dia) ? 'bg-[#10395a] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {dia.slice(0, 3)}
            </button>
          ))}
        </div>
        <button className="md:col-span-3 bg-[#10395a] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#0c2c47]">
          Agregar supervisor
        </button>
      </form>

      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Nombre</th>
            <th className="p-2 text-left">Guardia</th>
            <th className="p-2 text-left">Días</th>
            <th className="p-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {supervisores.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2 font-medium">{s.nombre}</td>
              <td className="p-2 text-gray-500">{s.guardia}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {DIAS_SEMANA.map((dia) => (
                    <button
                      key={dia}
                      onClick={() => toggleDiaExistente(s, dia)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        (s.dias || []).includes(dia) ? 'bg-[#10395a] text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {dia.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </td>
              <td className="p-2">
                <button onClick={() => eliminar(s.id)} className="text-red-600 text-xs hover:underline">
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
