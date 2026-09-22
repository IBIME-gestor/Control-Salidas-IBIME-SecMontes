import React, { useEffect, useState } from 'react'
import { horaMexicoHHMM } from './RelojMexico.jsx'
import { suscribirConfigEstancia } from '../utils/configuracion.js'
import { suscribirTodasAsignacionesEstancia, salonParaGradoHoyEntreTodas } from '../utils/estancia.js'
import { etiquetaGrado } from '../utils/grados.js'
import { nombreDiaHoy } from '../utils/eventos.js'

/**
 * A partir de la hora que configuró el administrador (panel Estancia),
 * avisa al docente que ya debe trasladar a estancia a los alumnos que le
 * queden pendientes — agrupados por grado, mencionando a qué salón le
 * toca a cada uno hoy. Es solo un aviso: el traslado lo sigue disparando
 * el propio docente con el botón "Enviar el resto a estancia".
 */
export default function AlertaHoraEstancia({ pendientes }) {
  const [config, setConfig] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const [horaActual, setHoraActual] = useState(horaMexicoHHMM())

  useEffect(() => suscribirConfigEstancia(setConfig), [])
  useEffect(() => suscribirTodasAsignacionesEstancia(setAsignaciones), [])
  useEffect(() => {
    const id = setInterval(() => setHoraActual(horaMexicoHHMM()), 15000)
    return () => clearInterval(id)
  }, [])

  const horaTraslado = config?.horaTraslado || ''
  const yaEsHora = horaTraslado && horaActual >= horaTraslado
  const dia = nombreDiaHoy()

  if (!yaEsHora || !pendientes.length) return null

  const gruposPorGrado = {}
  pendientes.forEach((f) => {
    const grado = f.alumno.grado || ''
    if (!gruposPorGrado[grado]) gruposPorGrado[grado] = new Set()
    const nombreGrupo = f.alumno.grupoEspanol || f.alumno.grupoIngles || ''
    if (nombreGrupo) gruposPorGrado[grado].add(nombreGrupo)
  })

  return (
    <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-xl p-4 mb-4">
      <p className="font-semibold mb-2">⏰ Ya es hora de trasladar alumnos a estancia ({horaTraslado})</p>
      <ul className="text-sm space-y-1 mb-2">
        {Object.entries(gruposPorGrado).map(([grado, grupos]) => {
          const salon = salonParaGradoHoyEntreTodas(asignaciones, dia, grado)
          return (
            <li key={grado}>
              Los alumnos de <strong>{etiquetaGrado(grado)}</strong>
              {grupos.size ? ` (grupo${grupos.size > 1 ? 's' : ''} ${[...grupos].join(', ')})` : ''} deberán ser
              trasladados al salón <strong>{salon || 'por confirmar'}</strong>.
            </li>
          )
        })}
      </ul>
      <p className="text-sm font-medium">No realices entregas hasta confirmar con el docente de estancia.</p>
    </div>
  )
}
