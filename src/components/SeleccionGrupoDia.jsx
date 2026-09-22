import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'

function ListadoGrupo({ grupo }) {
  const [alumnos, setAlumnos] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'alumnos'), where(grupo.tipo, '==', grupo.valor), orderBy('nombre'))
    const unsub = onSnapshot(q, (snap) => setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return () => unsub()
  }, [grupo.tipo, grupo.valor])

  if (alumnos === null) return <p className="text-xs text-gray-400 py-2">Cargando listado...</p>

  return (
    <ul className="text-xs text-gray-600 max-h-48 overflow-auto divide-y">
      {alumnos.map((a) => (
        <li key={a.id} className="py-1 flex justify-between">
          <span>{a.nombre}</span>
          <span className="text-gray-400">{a.matricula}</span>
        </li>
      ))}
      {!alumnos.length && <li className="text-gray-400 py-1">Sin alumnos en este grupo.</li>}
    </ul>
  )
}

/**
 * Se muestra la primera vez que el docente entra en el día: debe elegir
 * con qué grupo termina hoy (viendo el listado de ese grupo, español o
 * inglés, para confirmar que es el correcto), o marcar "Hora
 * administrativa" si ese día no tiene grupo a su cargo a la salida.
 */
export default function SeleccionGrupoDia({ grupos, onElegirGrupo, onElegirAdministrativa, guardando }) {
  const [expandido, setExpandido] = useState(null)

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
      <h2 className="font-semibold text-gray-800 mb-1">¿Con qué grupo terminas hoy?</h2>
      <p className="text-xs text-gray-500 mb-4">
        Elige el grupo con el que vas a registrar la salida el día de hoy. Puedes revisar su listado antes de
        confirmar. Si hoy tienes hora libre y no te toca ningún grupo a la salida, marca "Hora administrativa".
      </p>

      <div className="space-y-3 mb-4">
        {grupos.map((g, i) => {
          const abierto = expandido === i
          return (
            <div key={`${g.tipo}-${g.valor}`} className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-gray-800">{g.valor}</p>
                  <p className="text-xs text-gray-500">{g.tipo === 'grupoIngles' ? 'Grupo de inglés' : 'Grupo de español'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandido(abierto ? null : i)}
                    className="text-xs text-[#10395a] hover:underline px-2"
                  >
                    {abierto ? 'Ocultar listado' : 'Ver listado'}
                  </button>
                  <button
                    onClick={() => onElegirGrupo(g)}
                    disabled={guardando}
                    className="bg-[#10395a] text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#0c2c47] disabled:opacity-50"
                  >
                    Terminar con este grupo
                  </button>
                </div>
              </div>
              {abierto && (
                <div className="border-t bg-gray-50 px-3">
                  <ListadoGrupo grupo={g} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={onElegirAdministrativa}
        disabled={guardando}
        className="w-full border-2 border-amber-400 text-amber-700 rounded-xl py-3 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
      >
        Hoy tengo hora administrativa (sin grupo a la salida)
      </button>
    </div>
  )
}
