import React, { useState } from 'react'

/**
 * Se muestra junto al alumno en la tabla de salida del docente SOLO si
 * tiene una ruta de transporte asignada (coordinador de transporte). El
 * ícono abre un detalle desplegable (para no saturar la vista) con la
 * ruta y el operador; al cerrarlo, pregunta si ya se le avisó al alumno,
 * y guarda esa confirmación para que quede junto al registro de salida.
 */
export default function TransporteAlumnoAlerta({ transporte, confirmacion, onConfirmar }) {
  const [abierto, setAbierto] = useState(false)
  const [preguntando, setPreguntando] = useState(false)

  if (!transporte) return null

  function cerrarDetalle() {
    setAbierto(false)
    setPreguntando(true)
  }

  function responder(respuesta) {
    onConfirmar(respuesta)
    setPreguntando(false)
  }

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        title="Este alumno tiene transporte asignado"
        onClick={() => setAbierto((v) => !v)}
        className={`text-sm rounded-full w-5 h-5 inline-flex items-center justify-center ${
          confirmacion === 'si'
            ? 'bg-green-100 text-green-700'
            : confirmacion === 'no'
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        🚌
      </button>

      {abierto && (
        <div className="absolute z-20 top-6 left-0 bg-white border shadow-lg rounded-lg p-3 w-56 text-left">
          <p className="text-xs text-gray-500 mb-1">Transporte asignado</p>
          <p className="text-sm font-medium text-gray-800">{transporte.rutaNombre}</p>
          <p className="text-xs text-gray-500 mb-2">Operador: {transporte.operador}</p>
          <button
            onClick={cerrarDetalle}
            className="w-full text-xs bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5"
          >
            Cerrar
          </button>
        </div>
      )}

      {preguntando && (
        <div className="absolute z-20 top-6 left-0 bg-white border shadow-lg rounded-lg p-3 w-60 text-left">
          <p className="text-xs text-gray-700 mb-2">¿El alumno tiene la información de su transporte?</p>
          <div className="flex gap-2">
            <button
              onClick={() => responder('si')}
              className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700"
            >
              Sí
            </button>
            <button
              onClick={() => responder('no')}
              className="flex-1 text-xs bg-red-600 text-white rounded-lg py-1.5 hover:bg-red-700"
            >
              No
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
