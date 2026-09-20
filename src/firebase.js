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

export const googleProvider = new GoogleAuthProvider()
// "hd" (hosted domain) le dice a Google que muestre solo cuentas de ese
// dominio en el selector — es una ayuda de UI, no una garantía de
// seguridad, por eso igual se valida el correo después del login.
googleProvider.setCustomParameters({ hd: DOMINIO_PERMITIDO })
