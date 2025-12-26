# Fashion Encuestas HN

Encuesta anónima con panel de administración (Firebase Auth + Firestore) para las marcas **Fashion Collection**, **Variedades Miss Ceci** y **Fashion Collection Fem**.

## Estructura
- `/index.html`, `/styles.css`, `/app.js`: encuesta pública libre (no requiere PIN).
- `/firebase.js`: inicialización compartida de Firebase (rellena `firebaseConfig`).
- `/paneladmfc25/`: panel de administración (login, dashboard, exportación CSV, reglas sugeridas).

## Requisitos previos
- Cuenta en [Firebase](https://console.firebase.google.com/).
- Node/npm solo si deseas usar Firebase Hosting o un servidor local (no se usan frameworks).

## Pasos para configurar Firebase
1. **Crear proyecto Firebase**
   - En la consola de Firebase, crea un proyecto nuevo y agrega una app web. Copia la configuración (`firebaseConfig`) y pégala en `firebase.js`.
2. **Habilitar Authentication (Email/Password)**
   - En *Authentication > Sign-in method* activa *Correo/Contraseña*.
3. **Crear usuario administrador**
   - En *Authentication > Usuarios* agrega un usuario con correo y contraseña que usarás en `/paneladmfc25`.
   - Asigna un [custom claim](https://firebase.google.com/docs/auth/admin/custom-claims) `admin: true` a ese usuario (por ejemplo con la CLI `firebase auth:import` o un script con Admin SDK) para habilitar solo lectura desde el panel.
4. **Crear Firestore (modo producción)**
   - En *Firestore Database* crea la base de datos en modo producción. La colección usada es `responses`.
5. **Pegar reglas de seguridad**
   - En *Firestore Database > Rules* reemplaza por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isAdmin() {
         return request.auth != null && request.auth.token.admin == true;
       }

       match /responses/{document=**} {
         allow create: if true;               // Público: solo crear
         allow read: if isAdmin();            // Solo admin puede leer/listar
         allow update, delete: if false;      // Nadie puede actualizar o borrar
       }

       match /{document=**} {
         allow read: if isAdmin();
         allow write: if false;
       }
     }
   }
   ```

6. **Probar localmente**
   - Usa una extensión como *Live Server* o `npx serve` desde la raíz del proyecto. Navega a `http://localhost:3000` (o el puerto que te dé) para la encuesta y a `http://localhost:3000/paneladmfc25` para el panel.
7. **Despliegue (opcional) con Firebase Hosting**
   - Instala la CLI: `npm install -g firebase-tools`.
   - `firebase login`
   - `firebase init hosting` (elige el proyecto, define carpeta `.` y configura como SPA = No).
   - `firebase deploy --only hosting`.

## Cómo usar
- **Encuesta pública**
  - Carga `index.html` y responde directamente las preguntas (escala 1-10 y un comentario opcional).
  - Al enviar se crea un documento anónimo en `responses` con los IDs de pregunta (`q1` a `q5`) y `createdAt` (timestamp del servidor).
- **Panel admin `/paneladmfc25`**
  - Inicia sesión con el usuario de Firebase Auth.
  - Verás totales, promedios, modas, gráficos (Chart.js), comentarios filtrables y botón de exportar CSV. Solo usuarios con el claim `admin` pueden leer los resultados.
  - En la sección “Configurar Firebase” hay reglas recomendadas y un botón para probar la conexión (lectura de `responses`).

## Notas de privacidad
- No se solicita ni guarda información personal en la encuesta.
- Las respuestas se almacenan sin datos identificables; solo el panel admin puede leerlas.
