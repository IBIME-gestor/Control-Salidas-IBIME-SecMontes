import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getGruposAsignados } from '../utils/roles.js'
import { fechaHoyISO } from '../utils/eventos.js'
import {
  suscribirSeleccionDiaria,
  guardarSeleccionGrupo,
  guardarHoraAdministrativa
} from '../utils/seleccionDiaria.js'
import SeleccionGrupoDia from '../components/SeleccionGrupoDia.jsx'
import SalidaDocente from '../components/SalidaDocente.jsx'

/**
 * La primera vez que el docente entra en el día, se le pide elegir con
 * qué grupo termina (u "Hora administrativa" si no le toca ninguno). Esa
 * elección se guarda para todo el día (seleccionDiaria) y solo se vuelve
 * a preguntar si el propio docente da clic en "Cambiar selección".
 */
export default function DocentePanel() {
  const { perfil, user } = useAuth()
  const correo = perfil?.id || perfil?.correo || user?.email || ''
  const grupos = getGruposAsignados(perfil)
  const hoy = fechaHoyISO()

  const [seleccion, setSeleccion] = useState(undefined) // undefined = cargando
  const [forzarSeleccion, setForzarSeleccion] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => suscribirSeleccionDiaria(correo, hoy, setSeleccion), [correo, hoy])

  async function elegirGrupo(grupo) {
    setGuardando(true)
    try {
      await guardarSeleccionGrupo({ correo, fecha: hoy, grupoTipo: grupo.tipo, grupoValor: grupo.valor })
      setForzarSeleccion(false)
    } finally {
      setGuardando(false)
    }
  }

  async function elegirAdministrativa() {
    setGuardando(true)
    try {
      await guardarHoraAdministrativa({ correo, fecha: hoy })
      setForzarSeleccion(false)
    } finally {
      setGuardando(false)
    }
  }

  if (!grupos.length) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Tu cuenta de docente todavía no tiene ningún grupo asignado. Pide al administrador que lo
          configure en el panel de Usuarios.
        </div>
      </div>
    )
  }

  if (seleccion === undefined) {
    return <div className="p-6 max-w-3xl mx-auto text-sm text-gray-400">Cargando...</div>
  }

  if (!seleccion || forzarSeleccion) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <SeleccionGrupoDia
          grupos={grupos}
          onElegirGrupo={elegirGrupo}
          onElegirAdministrativa={elegirAdministrativa}
          guardando={guardando}
        />
      </div>
    )
  }

  if (seleccion.tipo === 'administrativa') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <p className="text-lg font-medium text-gray-700 mb-2">Hoy tienes hora administrativa</p>
          <p className="text-sm text-gray-500 mb-4">No tienes ningún grupo a tu cargo para la salida de hoy.</p>
          <button
            onClick={() => setForzarSeleccion(true)}
            className="text-sm text-[#10395a] hover:underline"
          >
            Cambiar selección
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SalidaDocente
        grupo={{ tipo: seleccion.grupoTipo, valor: seleccion.grupoValor }}
        onCambiarGrupo={() => setForzarSeleccion(true)}
      />
    </div>
  )
}
