import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Dominio de Google Workspace autorizado para entrar a la plataforma.
// El login solo admite cuentas @ibime.edu.mx (ver Login.jsx y
// AuthContext.jsx, donde se valida además del lado del cliente).
export const DOMINIO_PERMITIDO = 'ibime.edu.mx'

// Autoaprovisionamiento SIN Cloud Functions (plan Firebase Spark/gratis):
// cualquier correo @ibime.edu.mx que entre por primera vez se da de alta
// solo, del lado del navegador, como "colaborador" (solo consulta). Si su
// correo está en esta lista, se da de alta como "administrador" en vez de
// colaborador. Esta MISMA lista está copiada en firestore.rules (función
// correoEsAdminInicial) — si agregas o quitas un correo aquí, cámbialo
// también allá, o el navegador lo va a intentar pero las reglas lo van a
// rechazar.
export const CORREOS_ADMIN_INICIALES = [
  // 'josue.jain@ibime.edu.mx',
]

export const googleProvider = new GoogleAuthProvider()
// "hd" (hosted domain) le dice a Google que muestre solo cuentas de ese
// dominio en el selector — es una ayuda de UI, no una garantía de
// seguridad, por eso igual se valida el correo después del login.
googleProvider.setCustomParameters({ hd: DOMINIO_PERMITIDO })
