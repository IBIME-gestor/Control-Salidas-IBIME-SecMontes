import React, { useEffect, useState } from 'react'

const ZONA_MEXICO = 'America/Mexico_City'

const formatoHora = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA_MEXICO,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
})

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA_MEXICO,
  weekday: 'short',
  day: '2-digit',
  month: 'short'
})

// Hora "de pared" en México (HH:MM, 24h) para comparar contra la hora
// configurada de traslado a estancia — sin depender de la zona horaria
// de la computadora de quien esté usando la app.
export function horaMexicoHHMM(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_MEXICO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(fecha)
  const h = partes.find((p) => p.type === 'hour').value
  const m = partes.find((p) => p.type === 'minute').value
  return `${h}:${m}`
}

export default function RelojMexico({ compacto = false }) {
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (compacto) {
    return (
      <span className="text-xs text-gray-400 tabular-nums" title="Hora de México">
        {formatoHora.format(ahora)}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatoHora.format(ahora)}</span>
      <span className="text-[10px] text-gray-400 capitalize">{formatoFecha.format(ahora)} · CDMX</span>
    </div>
  )
}
