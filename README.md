# NyxOS/Vertex v3.0

Este es el manifiesto y la base de código para NyxOS v3.0, un sistema operativo de asistencia personal impulsado por IA, diseñado para ser autónomo, proactivo y evolutivo. Este proyecto utiliza una arquitectura moderna basada en Node.js, React, Google Vertex AI y Firestore.

## Arquitectura

El sistema se divide en dos componentes principales:

-   **Backend**: Un servidor Node.js/Express que gestiona la lógica de negocio, la comunicación con la IA y la persistencia de datos.
-   **Frontend**: Una aplicación de React (Vite) que proporciona la interfaz de usuario.

La comunicación entre el frontend y el backend para las interacciones en tiempo real (chat, notificaciones) se realiza exclusivamente a través de **WebSockets**, creando una experiencia fluida y `event-driven`.

### Componentes Clave

-   **Vertex AI**: El cerebro del sistema. Se utiliza el SDK de `@google-cloud/vertexai` para interactuar con los modelos de Gemini, aprovechando sus capacidades de `function calling` para la autonomía.
-   **Firestore**: La memoria persistente del sistema. Almacena todo: tareas, notas, historial de chat, personalidad de la IA, preferencias de usuario y más.
-   **Express**: Proporciona una API REST para operaciones CRUD básicas (tareas, notas) que complementan la interfaz principal.
-   **WebSockets (`ws`)**: La autopista de comunicación para el diálogo en tiempo real con la IA y las notificaciones del sistema.

## Configuración del Entorno

### Prerrequisitos

-   Node.js (v18 o superior)
-   Una cuenta de Google Cloud con un proyecto activo y la API de Vertex AI habilitada.
-   `gcloud` CLI instalado y autenticado.

### Pasos de Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```

2.  **Configurar Credenciales de Google Cloud:**
    Autentica tu entorno local para que el SDK de Firebase/Vertex pueda acceder a los servicios de Google Cloud.
    ```bash
    gcloud auth application-default login
    ```

3.  **Configurar Backend:**
    -   Navega al directorio `backend`.
    -   Crea un archivo `.env` a partir del `.env.example` y añade el ID de tu proyecto de Google Cloud:
        ```
        GCLOUD_PROJECT="tu-gcloud-project-id"
        PORT=8080
        ```
    -   Instala las dependencias:
        ```bash
        npm install
        ```

4.  **Configurar Frontend:**
    -   Navega al directorio `frontend`.
    -   Instala las dependencias:
        ```bash
        npm install
        ```

## Ejecución del Proyecto

1.  **Iniciar el Backend:**
    Desde el directorio `backend`, ejecuta:
    ```bash
    npm run dev
    ```
    El servidor se iniciará en `http://localhost:8080`.

2.  **Iniciar el Frontend:**
    Desde el directorio `frontend`, ejecuta:
    ```bash
    npm run dev
    ```
    La aplicación de React estará disponible en `http://localhost:5173` (o el puerto que Vite asigne).

## Despliegue (Deployment)

Esta sección detalla el proceso para desplegar el backend y el frontend en un entorno de producción.

### Backend en Google Cloud Run

Cloud Run proporciona un entorno serverless y escalable ideal para nuestro backend.

1.  **Construir la Imagen de Docker:**
    Asegúrate de que tu `gcloud` CLI esté configurado con el proyecto correcto (`gcloud config set project tu-gcloud-project-id`). Luego, desde el directorio raíz del proyecto, construye la imagen usando Cloud Build:
    ```bash
    gcloud builds submit --tag gcr.io/tu-gcloud-project-id/nyx-v3-backend ./backend
    ```

2.  **Desplegar en Cloud Run:**
    Despliega la imagen recién construida. Este comando crea un nuevo servicio llamado `nyx-v3-backend`.
    ```bash
    gcloud run deploy nyx-v3-backend \
      --image gcr.io/tu-gcloud-project-id/nyx-v3-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars GCLOUD_PROJECT="tu-gcloud-project-id"
    ```
    -   `--allow-unauthenticated` permite que el frontend acceda a la API REST. La seguridad a nivel de usuario se maneja dentro de la aplicación.
    -   Cloud Run inyecta automáticamente la variable de entorno `PORT`.

3.  **Habilitar WebSockets (Afinidad de Sesión):**
    Los WebSockets requieren que un cliente permanezca conectado al mismo contenedor. Habilita la "afinidad de sesión" en tu servicio de Cloud Run:
    ```bash
    gcloud run services update nyx-v3-backend \
      --region us-central1 \
      --session-affinity
    ```

4.  **Obtener la URL del Backend:**
    Una vez desplegado, Cloud Run te proporcionará una URL para tu servicio (ej. `https://nyx-v3-backend-xxxxx-uc.a.run.app`). Necesitarás esta URL para configurar el frontend.

### Frontend en Vercel

Vercel ofrece un despliegue simple y rápido para aplicaciones de React.

1.  **Crear un Repositorio en GitHub:**
    Asegúrate de que tu proyecto esté en un repositorio de GitHub.

2.  **Importar Proyecto en Vercel:**
    -   Inicia sesión en tu cuenta de Vercel.
    -   Haz clic en "Add New... -> Project".
    -   Importa el repositorio de GitHub que acabas de crear.

3.  **Configurar el Proyecto:**
    -   Vercel detectará automáticamente que es una aplicación de Vite/React.
    -   **Framework Preset:** Vite.
    -   **Root Directory:** `frontend`.
    -   **Build and Output Settings:** Déjalos con los valores predeterminados.

4.  **Configurar Variables de Entorno:**
    -   En la configuración del proyecto en Vercel, ve a "Settings -> Environment Variables".
    -   Añade la siguiente variable. Recuerda usar el protocolo `wss://` (WebSocket Secure) para producción.
        -   **Name:** `VITE_WEBSOCKET_URL`
        -   **Value:** `wss://nyx-v3-backend-xxxxx-uc.a.run.app` (reemplaza con la URL de tu Cloud Run).

5.  **Desplegar:**
    Haz clic en el botón "Deploy". Vercel construirá y desplegará tu frontend, proporcionándote una URL de producción.