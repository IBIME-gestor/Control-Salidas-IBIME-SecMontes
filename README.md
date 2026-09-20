# Control de Salidas · IBIME Secundaria

App web para gestionar el control de salidas de alumnos (matrícula, nombre, correo,
grupo de español, grupo de inglés, tutor, tipo de salida y días), con 7 roles:
administrador, dirección, supervisión, recepción, tutoría, contraloría y docentes.

Todo se ejecuta y se publica en línea: GitHub Actions compila y despliega
automáticamente a Firebase Hosting cada vez que hagas push a `main`. No necesitas
instalar Node, Firebase CLI ni nada en tu computadora.

El acceso es con **cuenta de Google del colegio (@ibime.edu.mx)** — sin
contraseñas propias de la plataforma.

## Identidad visual

La app usa el logo y los colores de IBIME (`public/logo-ibime.webp`, rojo
`#e31e24` y azul marino `#10395a`) en el login, la barra superior y los
botones principales. Si cambian el logo, basta con reemplazar ese archivo
manteniendo el mismo nombre.

## Modelo de roles y privilegios

Un usuario puede tener **uno o varios roles a la vez** (por ejemplo,
Tutoría + Recepción). Cada rol trae, de fábrica, un paquete de
**privilegios** (qué pestañas ve y en cuáles puede escribir), pero el
administrador puede después prender o apagar cada privilegio de forma
individual para una persona en particular desde el panel "Usuarios" —
sin quedar atado a lo que ese rol trae por defecto.

| Rol | Privilegios por defecto |
|---|---|
| **Administrador** | Todos, siempre — incluye administrar usuarios, catálogos, listado de alumnos y tipo de salida |
| **Colaborador** (rol por defecto al entrar por primera vez) | Solo ver alumnos y grupos |
| **Dirección** | Ver estado de hoy, alertas, disponibilidad, historial, faltas y alumnos |
| **Contraloría** | Igual que Dirección |
| **Recepción** | Igual que Dirección, más capturar llegadas tarde y otorgar salidas anticipadas |
| **Supervisión** | Igual que Recepción |
| **Tutoría** | Igual que Dirección, más tomar el pase de lista de sus propios alumnos |
| **Docente** | Panel aparte: ve y opera únicamente su grupo asignado (salida, traslados, entregas, falta, observaciones) — no usa el sistema de privilegios |

Docente sigue siendo un caso aparte por diseño: su panel está pensado para
operar solo su propio grupo al momento de la salida, no para navegar todo
el plantel.

## Acceso con Google (@ibime.edu.mx)

No hay contraseñas de la plataforma: cada persona entra con su cuenta de
Google del colegio. Ya no hace falta darla de alta a mano de antemano: en
cuanto entra por primera vez, una Cloud Function le crea su perfil sola —
como **Administrador** si su correo está en `CORREOS_ADMIN_INICIALES`
(ver "Paso 6" abajo), o como **Colaborador** (solo consulta de alumnos y
grupos) en cualquier otro caso. Desde el panel de Usuarios, el
administrador entra a esa persona en cualquier momento y le ajusta el
rol/roles y cada privilegio puntual.

La app valida que el correo termine en `@ibime.edu.mx`; si alguien intenta
entrar con una cuenta de otro dominio, se le cierra la sesión de inmediato
con un mensaje. Como refuerzo adicional (recomendado, no obligatorio),
en Google Cloud Console puedes configurar la pantalla de consentimiento
OAuth de este proyecto como **"Interna"** si tu organización de Google
Workspace lo permite, para que Google ni siquiera muestre el selector a
cuentas fuera del dominio.

## Flujo operativo del día (bitácora en vivo)

Además de la configuración (alumnos, roles, catálogos), la app lleva el
registro operativo real del día:

- **Estado de hoy**: tablero en vivo con el último evento de cada alumno
  (salida, salida anticipada, traslado a estancia, entregado en estancia,
  traslado a supervisión, entregado en supervisión), filtrable por tutor o
  grupo.
- **Historial**: bitácora completa por fecha, con hora exacta y quién
  registró cada evento — es el registro auditable, no se puede editar ni
  borrar (salvo el administrador, para corregir un error puntual).
- **Faltas**: reporte separado por fecha, con motivo y quién la registró.
- **Supervisores**: catálogo de quién cubre la guardia cada día de la
  semana y en qué punto (lo administra solo el administrador).
- Los **tipos de salida** incluyen una categoría fija (Transporte, Comedor,
  Taller, Nivelación, Gimnasio, Caso especial, En aula, Sin registro) para
  mantener un orden y clasificación operativa consistente.

## Pase de lista diario (tutoría)

Cada cuenta de **tutoría** tiene asignado un tutor (nombre exacto del campo
"tutor" del listado, configurado por el administrador en "Usuarios"). Desde
la pestaña **Pase de lista**:

- Todos los alumnos parten de **Presente** por default (no se escribe nada
  para ellos); el tutor solo marca las excepciones: **Ausente**, o
  **Retardo** con hora de llegada.
- Si recepción/supervisión ya capturó el retardo de un alumno desde
  "Llegadas tarde", el tutor lo ve reflejado automáticamente al pasar
  lista, sin que nadie tenga que capturarlo dos veces.
- El registro se puede corregir a lo largo de la mañana según van llegando
  los alumnos tarde.
- El administrador ve la misma pantalla con un selector para elegir
  cualquier tutor, para apoyar o revisar.
- Cada vez que se marca **Ausente** o **Retardo**, además de guardarse en
  `asistencia`, se crea automáticamente un evento (`FALTA` o `RETARDO`) en
  la misma bitácora de `eventos`. Así el pase de lista **nutre
  directamente** el panel de Faltas y el Historial general.

## Llegadas tarde (recepción / supervisión)

Pensado para el personal que recibe a los alumnos en la entrada a partir de
las 7:10 am: la pestaña **Llegadas tarde** (recepción, supervisión y
administrador) tiene un solo campo para escribir o escanear la matrícula.
Al confirmar, se busca al alumno por su matrícula (que es también el ID del
documento en Firestore, así que es una sola lectura por captura) y se
registra su retardo de inmediato. Ese mismo registro es el que después ve
el tutor en su pase de lista, sin que tenga que volver a capturarlo.

## Salida anticipada (antes del horario normal)

Cuando un padre o tutor recoge al alumno antes del horario normal (por
ejemplo, a la 1:00 pm en vez de las 3:30 pm), **recepción, supervisión o
administrador** otorgan el pase desde la pestaña **Salida anticipada**.
Dirección, contraloría, tutoría y docentes NO la otorgan.

- Se busca al alumno por matrícula (1 sola lectura).
- Se captura el **nombre de quien lo recoge** y el **motivo**.
- La fecha y hora se toman automáticamente del reloj, no se capturan a mano.
- Al guardar, queda un evento `SALIDA_ANTICIPADA` en la misma bitácora de
  `eventos`. Esto es lo que hace que, a la hora de la salida normal, el
  docente ya **no vea botones de acción** para ese alumno — su fila muestra
  la etiqueta "Salida anticipada (hora) — ya no está en el plantel" en vez
  de los botones de Salida/Traslado/Entrega.
- Las reglas de seguridad (`firestore.rules`) impiden que cualquier otro
  rol cree un evento `SALIDA_ANTICIPADA` aunque lo intente forzar desde la
  app: la validación real ocurre en el servidor, no solo en la interfaz.

## Descarte automático en la salida normal

Cuando un docente abre su grupo para registrar salidas, un alumno queda
descartado (sin botones de acción, solo una etiqueta) si:

- está marcado **Ausente** hoy (por el pase de lista o por recepción), o
- ya tuvo una **salida** o **salida anticipada** hoy.

El resto de los alumnos (presentes, con retardo, o solo trasladados a
estancia/supervisión) conservan sus botones normales de Salida / Traslado /
Entrega.

## Contadores, alertas y correo automático de retardos/faltas

Cada alumno tiene dos contadores acumulados en su propia ficha
(`contadorRetardos`, `contadorFaltas`) — así "cuántas veces lleva" siempre
es leer 1 documento, nunca escanear el historial completo.

- **Quién los actualiza**: una Cloud Function (`functions/index.js`), no el
  navegador. Se dispara sola cada vez que se crea un evento `FALTA` o
  `RETARDO` (venga del pase de lista, de recepción, o de donde sea) y suma
  +1 de forma atómica. Esto evita contar doble sin importar desde qué
  pantalla se originó el evento.
- **Panel "Alertas"** (todos los roles de consulta): `where(contador, '>=',
  umbral)` directo sobre `alumnos` — trae solo a quien de verdad cruza el
  umbral, nunca escanea a los 650. Aquí dirección/tutoría/contraloría ven
  quién necesita seguimiento, sin que se le mande nada al padre todavía.
- **Correo automático al padre**: la misma Cloud Function, cada vez que el
  contador vuelve a ser múltiplo de 3 (configurable en `UMBRAL_RETARDOS` /
  `UMBRAL_FALTAS` dentro de `functions/index.js`), le manda un correo a
  `alumno.correoPadre` usando **Resend** (capa gratuita: 3,000
  correos/mes, 100/día — de sobra para un plantel). Si el alumno no tiene
  `correoPadre` cargado, simplemente no se envía nada (se sigue contando
  igual).

### Puesta en marcha (una sola vez)

1. **Activar el plan Blaze** en tu proyecto de Firebase (Configuración del
   proyecto > Uso y facturación > Modificar plan). Sigue incluyendo la
   misma cuota gratuita de Cloud Functions (2 millones de invocaciones al
   mes); para este volumen el gasto esperado es $0.
2. Crea una cuenta gratuita en https://resend.com y genera una **API Key**.
3. Guarda esa llave como secreto de Cloud Functions — esto se hace desde
   **Google Cloud Shell** (botón de terminal en la esquina superior de
   https://console.cloud.google.com, es 100% en el navegador, no instala
   nada en tu PC):
   ```
   firebase functions:secrets:set RESEND_API_KEY --project TU-PROJECT-ID
   ```
   Te pedirá pegar la API Key de Resend y listo.
4. En Resend, verifica el dominio `ibime.edu.mx` (o cambia el remitente en
   `functions/index.js`, variable `REMITENTE`, por un correo de un dominio
   que ya tengas verificado ahí).
5. Haz push a `main`: el workflow ya incluye el paso que publica las
   Cloud Functions junto con el resto.

## Horarios y disponibilidad (profesores libres / salones vacíos)

Pensado para tus 43 maestros: en vez de cargar tres hojas sueltas (grupos,
profesores, salones) que se pueden desincronizar entre sí, se sube **una
sola tabla consolidada** desde "Cargar horario" (administrador): una fila
por clase, con día, hora/periodo, grupo, materia, docente y salón.

Con eso cargado, cualquier rol de consulta puede usar la pestaña
**Disponibilidad**: elige día y hora, y la app le dice qué profesores están
libres y qué salones están vacíos en ese momento — se calcula restando
quién aparece ocupado en `horarios` contra el universo completo de
docentes/salones (que sale de `/meta/horario`, actualizado solo al cargar
el horario). Como el horario cambia una vez por semestre, esta consulta es
bajo demanda (un botón "Consultar"), no en vivo.

## Optimización de lecturas en Firestore

Con ~650 alumnos de secundaria por plantel (multiplicado por cada plantel
del colegio), la app está diseñada para **nunca leer la colección completa
de alumnos** en el uso normal:

- Las opciones de los filtros (tutores, grupos de español, grupos de
  inglés) salen de un único documento `/meta/filtros` (actualizado con
  `arrayUnion` al cargar el listado): **1 lectura**, sin importar cuántos
  alumnos haya.
- La tabla de alumnos no carga nada hasta que se elige un tutor o un grupo;
  a partir de ahí consulta con `where()` y trae solo esos ~20-30
  documentos, nunca los 650.
- El pase de lista consulta `alumnos` y `asistencia` acotado siempre por
  `tutor` (o por grupo, en el caso del docente).
- "Llegadas tarde" y "Salida anticipada" buscan al alumno por su matrícula,
  que es el ID del documento: **1 lectura exacta** por captura.
- Los catálogos (`tiposSalida`, `supervisores`) sí se cargan completos,
  pero son colecciones pequeñas (decenas de documentos, no cientos).

Si más adelante se agrega un "dashboard por alumno" (historial individual),
debe seguir el mismo patrón: consultar por `alumnoId` puntual, nunca por
colección completa.

## Paso 1 — Crear el proyecto de Firebase (5 minutos, desde el navegador)

1. Entra a https://console.firebase.google.com y crea un proyecto nuevo
   (idealmente usando tu cuenta @ibime.edu.mx de administrador de Workspace).
2. Dentro del proyecto, ve a **Compilación > Authentication > Comenzar** y
   activa el proveedor **Google** (no "Correo electrónico/contraseña").
   En la configuración del proveedor Google, puedes dejar el correo de
   soporte como el tuyo.
3. Ve a **Compilación > Firestore Database** y créala (modo producción,
   cualquier región cercana, por ejemplo `us-central`).
4. Ve a **Configuración del proyecto (ícono de engrane) > General**, baja hasta
   "Tus apps", crea una **app web** (ícono `</>`), ponle un nombre y copia el
   objeto `firebaseConfig` que te muestra (lo usarás en el paso 3).
5. Ve a **Configuración del proyecto > Cuentas de servicio**, botón
   **Generar nueva clave privada**. Se descarga un archivo `.json`: lo usarás
   en el paso 3 tal cual, sin modificarlo.
6. (Recomendado) En https://console.cloud.google.com, busca el mismo
   proyecto, ve a **APIs y servicios > Pantalla de consentimiento de
   OAuth** y, si tu Workspace lo permite, marca el tipo de usuario como
   **Interno** — así Google restringe el selector de cuentas al dominio
   ibime.edu.mx desde su propio lado, además de la validación que ya hace
   la app.

## Paso 2 — Subir este código a un repositorio de GitHub

1. Crea un repositorio nuevo y vacío en GitHub (sin README, sin licencia).
2. Sube todos estos archivos a ese repositorio (puedes arrastrarlos desde la
   interfaz web de GitHub con "Add file > Upload files", sin usar tu terminal).

## Paso 3 — Configurar las llaves de Firebase en GitHub (sin tocar tu PC)

En tu repositorio de GitHub: **Settings > Secrets and variables > Actions**.

**Pestaña "Variables" → "New repository variable"**, crea estas 6 variables
con los valores del `firebaseConfig` del paso 1.4:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Pestaña "Secrets" → "New repository secret"**, crea:

- `FIREBASE_SERVICE_ACCOUNT`: pega el contenido completo del archivo `.json`
  que descargaste en el paso 1.5.

También edita el archivo `.firebaserc` de este repositorio y reemplaza
`TU-PROJECT-ID-DE-FIREBASE` por el ID real de tu proyecto (lo ves en
Configuración del proyecto > General > "ID del proyecto"). Puedes editarlo
directamente en GitHub, sin descargar nada.

## Paso 4 — Habilitar Firebase Hosting

En la consola de Firebase: **Compilación > Hosting > Comenzar**. Puedes
saltarte los pasos de instalación de CLI que te sugiere (eso lo hace GitHub
Actions por ti); solo necesitas que Hosting quede habilitado en el proyecto.

## Paso 5 — Desplegar

Con las variables y el secreto ya configurados, haz cualquier cambio y push a
`main` (o entra a la pestaña **Actions** de tu repositorio y ejecuta
manualmente el workflow "Deploy a Firebase Hosting" con "Run workflow").
GitHub compilará la app y la publicará en tu URL de Firebase Hosting
(algo como `https://tu-proyecto.web.app`).

## Paso 6 — Dar de alta al primer administrador

Ya no hace falta crear nada a mano en Firestore. Una Cloud Function
(`altaAutomaticaUsuario`, en `functions/index.js`) se dispara sola cada vez
que alguien inicia sesión con Google por primera vez, y le crea su perfil
automáticamente:

1. Antes de desplegar (o justo después, y vuelves a desplegar), abre
   `functions/index.js` y agrega tu propio correo a la lista
   `CORREOS_ADMIN_INICIALES`, por ejemplo:
   ```js
   const CORREOS_ADMIN_INICIALES = [
     'direccion@ibime.edu.mx',
   ]
   ```
2. Despliega las funciones (`firebase deploy --only functions`, o vía el
   workflow de GitHub Actions si ya lo tienes configurado).
3. Entra a la app publicada y da clic en "Ingresar con Google" con
   exactamente ese correo: la función te da de alta como **Administrador**
   automáticamente.
4. Cualquier otra persona del colegio que entre por primera vez con su
   cuenta @ibime.edu.mx queda dada de alta sola como **Colaborador**
   (solo puede ver alumnos y grupos). Desde el panel "Usuarios" puedes
   entrar a esa persona y cambiarle el rol o los roles, y dentro de cada
   rol prender/apagar cada privilegio de forma individual (ver "Modelo de
   roles" abajo) — sin volver a tocar Firestore ni el código a mano.

`CORREOS_ADMIN_INICIALES` solo se usa para arrancar: una vez que tengas un
primer administrador dentro de la app, puedes promover a alguien más a
Administrador desde el panel de Usuarios directamente, sin editar código.

## Uso día a día

1. **Cargar alumnos**: el administrador sube el Excel de toda secundaria
   (columnas: matrícula, nombre, correo, grupo español, grupo inglés, tutor)
   desde "Cargar listado". Se identifican por matrícula, así que volver a
   subir el archivo actualiza a los mismos alumnos sin duplicarlos.
2. **Tipos de salida y supervisores**: el administrador da de alta los
   tipos de salida (por ejemplo "Salida con pase", "Recoge tutor") y el
   catálogo de supervisores por día.
3. **Asignar tipo de salida por alumno**: el administrador filtra por
   tutor, grupo de español o grupo de inglés, y para cada alumno selecciona
   el tipo de salida y marca los días de la semana en que aplica.
4. **Cada mañana**: tutoría pasa lista de sus alumnos; recepción/supervisión
   capturan matrícula por matrícula a quien llega tarde.
5. **Durante el día**: recepción, supervisión o administrador otorgan
   salidas anticipadas cuando un padre recoge antes de horario.
6. **A la salida**: cada docente entra y ve solo su grupo, con el tipo de
   salida de cada alumno y los que ya deben descartarse (ausentes o que ya
   salieron); registra Salida / Traslado / Entrega según corresponda.
7. **Dirección y contraloría** consultan el estado de hoy, el historial y
   las faltas en cualquier momento, sin poder modificar nada.

## Estructura del proyecto

```
src/
  firebase.js              Conexión a Firebase (Auth Google + Firestore)
  context/AuthContext.jsx  Sesión, validación de dominio y perfil por correo
  utils/roles.js           Definición de roles y permisos
  utils/eventos.js         Acciones del flujo operativo y categorías de salida
  utils/asistencia.js      Estados y helpers del pase de lista
  utils/meta.js            Documentos /meta/filtros y /meta/horario (evitan leer colecciones completas)
  pages/                   Login y paneles por rol
  components/              Tabla de alumnos, carga de Excel (alumnos y horario),
                           catálogos, tablero de estado, historial, faltas,
                           supervisores, llegadas tarde, salida anticipada,
                           alertas, disponibilidad
functions/                 Cloud Function: contador de retardos/faltas + correo (Resend)
firestore.rules            Reglas de seguridad (permisos por rol en el servidor)
firestore.indexes.json     Índices compuestos para las consultas acotadas
.github/workflows/deploy.yml  Build + deploy automático (hosting, reglas y functions)
```

Las reglas de `firestore.rules` son la barrera real de seguridad (se
aplican en el servidor de Firebase, buscando el perfil por el correo del
token de Google); los paneles por rol en React son solo para la
experiencia de uso. Los índices de `firestore.indexes.json` se publican
automáticamente en cada deploy junto con las reglas.
