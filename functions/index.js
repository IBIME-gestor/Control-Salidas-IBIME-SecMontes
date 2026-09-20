const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const functionsV1 = require('firebase-functions/v1')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const logger = require('firebase-functions/logger')

initializeApp()
const db = getFirestore()

// --- Alta automática de usuarios --------------------------------------
// Correos que entran como Administrador desde su PRIMER inicio de
// sesión. Edítalo aquí (y vuelve a desplegar con
// `firebase deploy --only functions`) para agregar o quitar
// administradores iniciales. Una vez dado de alta, cualquier
// administrador puede promover a alguien más desde el panel de Usuarios
// sin tocar código.
const CORREOS_ADMIN_INICIALES = [
  // 'director@ibime.edu.mx',
]

const DOMINIO_PERMITIDO = 'ibime.edu.mx'

const PERMISOS_ADMIN = {
  verAlumnos: true,
  verEstado: true,
  verAlertas: true,
  verDisponibilidad: true,
  verHistorial: true,
  verFaltas: true,
  tomarAsistencia: true,
  capturarRetardos: true,
  salidaAnticipada: true,
  editarAlumnos: true,
  gestionarTiposSalida: true,
  gestionarSupervisores: true,
  cargarListado: true,
  cargarHorario: true,
  administrarUsuarios: true
}

// Privilegios de "colaborador": solo consulta de alumnos y grupos. El
// resto queda apagado; el administrador puede prenderlos uno por uno (o
// cambiarle el rol) desde el panel de Usuarios.
const PERMISOS_COLABORADOR = {
  ...Object.fromEntries(Object.keys(PERMISOS_ADMIN).map((p) => [p, false])),
  verAlumnos: true
}

// Se dispara automáticamente cada vez que alguien inicia sesión por
// PRIMERA vez con Google (así se crea su cuenta en Firebase Auth). Usa el
// Admin SDK, así que no depende de las reglas de Firestore (una persona
// nueva no podría, por su cuenta, crear ni editar su propio documento en
// /usuarios). Si el correo ya tenía un documento (por ejemplo, porque el
// administrador lo dio de alta a mano antes de que esa persona entrara
// por primera vez), no se toca nada.
exports.altaAutomaticaUsuario = functionsV1.auth.user().onCreate(async (user) => {
  const correo = (user.email || '').toLowerCase()
  if (!correo.endsWith('@' + DOMINIO_PERMITIDO)) {
    logger.info(`Cuenta ${correo} fuera del dominio permitido; no se crea perfil.`)
    return
  }

  const ref = db.collection('usuarios').doc(correo)
  const existente = await ref.get()
  if (existente.exists) {
    logger.info(`Ya existía un perfil para ${correo}; no se sobrescribe.`)
    return
  }

  const esAdminInicial = CORREOS_ADMIN_INICIALES.map((c) => c.toLowerCase()).includes(correo)
  await ref.set({
    nombre: user.displayName || correo,
    correo,
    roles: [esAdminInicial ? 'administrador' : 'colaborador'],
    permisos: esAdminInicial ? PERMISOS_ADMIN : PERMISOS_COLABORADOR,
    grupoAsignado: '',
    tipoGrupoAsignado: '',
    tutorAsignado: ''
  })
  logger.info(`Perfil creado automáticamente para ${correo} (${esAdminInicial ? 'administrador' : 'colaborador'}).`)
})

// La API key de Resend se guarda como "secret" de Cloud Functions, nunca
// en el código ni en variables de entorno normales. Se configura UNA vez
// con: firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

// Cada cuántos retardos/faltas se manda el correo (3, 6, 9... es decir, se
// avisa cada vez que el contador vuelve a ser múltiplo de este número).
// Cambiar aquí si el colegio quiere otro umbral, sin tocar nada más.
const UMBRAL_RETARDOS = 3
const UMBRAL_FALTAS = 3

const REMITENTE = 'Control de Salidas IBIME <notificaciones@ibime.edu.mx>'

function plantillaCorreo({ nombreAlumno, tipo, contador, tutor }) {
  const etiqueta = tipo === 'retardo' ? 'retardos' : 'faltas'
  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <div style="border-top: 4px solid #e31e24; padding-top: 16px;">
      <h2 style="color: #10395a; margin-bottom: 4px;">Aviso de asistencia</h2>
      <p style="color: #6b7280; margin-top: 0;">Secundaria IBIME</p>
      <p>Le informamos que <strong>${nombreAlumno}</strong> ha acumulado
      <strong>${contador} ${etiqueta}</strong> en lo que va del periodo.</p>
      <p>Si tiene dudas, puede contactar a la tutoría del grupo${tutor ? ` (${tutor})` : ''}.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Este es un aviso automático del sistema de Control de Salidas. No responda a este correo.
      </p>
    </div>
  </div>`
}

async function enviarCorreo({ apiKey, destinatario, asunto, html }) {
  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [destinatario],
      subject: asunto,
      html
    })
  })
  if (!respuesta.ok) {
    const texto = await respuesta.text()
    throw new Error(`Resend respondió ${respuesta.status}: ${texto}`)
  }
}

// Se dispara con CADA evento nuevo en "eventos". Solo actúa si es
// FALTA o RETARDO — el resto de las acciones (salida, traslados, etc.)
// se ignoran de inmediato sin costo extra.
exports.procesarEventoAsistencia = onDocumentCreated(
  { document: 'eventos/{eventoId}', secrets: [RESEND_API_KEY], region: 'us-central1' },
  async (evento) => {
    const data = evento.data.data()
    if (!data || (data.accion !== 'FALTA' && data.accion !== 'RETARDO')) return

    const campoContador = data.accion === 'FALTA' ? 'contadorFaltas' : 'contadorRetardos'
    const umbral = data.accion === 'FALTA' ? UMBRAL_FALTAS : UMBRAL_RETARDOS
    const alumnoRef = db.collection('alumnos').doc(data.alumnoId)

    // Incrementa el contador de forma atómica y devuelve el valor nuevo.
    const nuevoValor = await db.runTransaction(async (tx) => {
      const snap = await tx.get(alumnoRef)
      const actual = (snap.data()?.[campoContador]) || 0
      const nuevo = actual + 1
      tx.update(alumnoRef, { [campoContador]: FieldValue.increment(1) })
      return nuevo
    })

    // Solo se notifica cada vez que el contador vuelve a ser múltiplo del
    // umbral (3, 6, 9...), no en cada retardo individual.
    if (nuevoValor % umbral !== 0) return

    const alumno = (await alumnoRef.get()).data()
    if (!alumno?.correoPadre) {
      logger.info(`Alumno ${data.alumnoId} llegó a ${nuevoValor} ${campoContador}, pero no tiene correoPadre registrado.`)
      return
    }

    try {
      await enviarCorreo({
        apiKey: RESEND_API_KEY.value(),
        destinatario: alumno.correoPadre,
        asunto: `Aviso de asistencia — ${alumno.nombre}`,
        html: plantillaCorreo({
          nombreAlumno: alumno.nombre,
          tipo: data.accion === 'FALTA' ? 'falta' : 'retardo',
          contador: nuevoValor,
          tutor: alumno.tutor
        })
      })
      logger.info(`Correo enviado a ${alumno.correoPadre} por ${nuevoValor} ${campoContador} de ${alumno.nombre}.`)
    } catch (err) {
      logger.error('Error al enviar correo con Resend:', err)
    }
  }
)
