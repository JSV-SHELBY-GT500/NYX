# Plan de Evolución de la Aplicación: De Frontend a Full-Stack

Este documento es la hoja de ruta para transformar el prototipo actual en una aplicación web Full-Stack robusta. Sirve como un documento vivo, indexado y modular para guiar el desarrollo.

**Índice:**

1.  [Arquitectura Final Propuesta](#1-arquitectura-final-propuesta)
2.  [Entorno de Desarrollo y Prerrequisitos](#2-entorno-de-desarrollo-y-prerrequisitos)
3.  [Plan de Implementación por Fases](#3-plan-de-implementación-por-fases)
    1.  [Fase 1: Configuración del Backend](#fase-1-configuración-del-backend)
    2.  [Fase 2: Migración del Frontend a React](#fase-2-migración-del-frontend-a-react)
    3.  [Fase 3: Integración y Flujo Completo](#fase-3-integración-y-flujo-completo)
4.  [Placeholders de Funcionalidad (Estado Actual)](#4-placeholders-de-funcionalidad-estado-actual)
    1.  [[P-1] Recepción de Mensajes (Webhook)](#p-1-recepción-de-mensajes-webhook)
    2.  [[P-2] Generación de Respuestas de IA para Inbox](#p-2-generación-de-respuestas-de-ia-para-inbox)
    3.  [[P-3] Almacenamiento Seguro de API Keys](#p-3-almacenamiento-seguro-de-api-keys)

---

### 1. Arquitectura Final Propuesta

-   **Backend:** **Node.js** con el framework **Express**.
    -   **Responsabilidades:**
        -   Recibir y validar webhooks de servicios externos (ej. Facebook Messenger).
        -   Gestionar la comunicación segura con la API de Google Gemini.
        -   Proporcionar una API RESTful para que el frontend consuma los datos (mensajes, configuraciones, etc.).
        -   Manejar el almacenamiento seguro de API keys y otros secretos.
-   **Frontend:** **React** con **Vite** y **TypeScript**.
    -   **Responsabilidades:**
        -   Renderizar la interfaz de usuario dinámica y reactiva.
        -   Gestionar el estado de la aplicación local (UI state).
        -   Comunicarse con la API del backend para enviar y recibir datos.
-   **Base de Datos:** (A definir, se sugiere **PostgreSQL** o **Firestore**).
    -   **Responsabilidades:** Persistir conversaciones, plantillas de usuario, configuraciones y logs.

### 2. Entorno de Desarrollo y Prerrequisitos

-   **Software:** Node.js (LTS), VS Code.
-   **Extensiones VS Code:** ESLint, Prettier, Thunder Client (para probar la API).
-   **Estructura:** Monorepo con dos carpetas principales: `/backend` y `/frontend`.

### 3. Plan de Implementación por Fases

#### Fase 1: Configuración del Backend
1.  Inicializar el proyecto Node.js con Express.
2.  Crear el endpoint `/webhook` para recibir datos `POST`. Inicialmente, solo registrará los datos recibidos.
3.  Crear el endpoint `POST /api/generate-reply` que reciba un prompt, llame a la API de Gemini, y devuelva la respuesta.
4.  Crear endpoints `GET /api/messages` y `POST /api/messages` para gestionar los mensajes.
5.  Implementar un sistema seguro para la gestión de variables de entorno (`.env`).

#### Fase 2: Migración del Frontend a React
1.  Inicializar un nuevo proyecto de React+TS con Vite en la carpeta `/frontend`.
2.  Recrear la UI actual dividiéndola en componentes reutilizables (ej. `<InboxCard />`, `<ChatApp />`, `<ConfirmationToast />`).
3.  Implementar un sistema de enrutamiento básico si es necesario, o gestionar las "tarjetas" a través del estado de React.
4.  Reemplazar toda la manipulación directa del DOM con el manejo de estado de React (`useState`, `useEffect`).

#### Fase 3: Integración y Flujo Completo
1.  Conectar el frontend para que llame a los endpoints del backend en lugar de a las funciones placeholder.
2.  Configurar Vite para usar un proxy que redirija las llamadas a `/api` al servidor backend durante el desarrollo.
3.  Implementar la lógica completa del webhook de Facebook.
4.  Configurar un mecanismo de despliegue (ej. Vercel, Render, Docker).

---

### 4. Placeholders de Funcionalidad (Estado Actual)

Esta sección documenta las funcionalidades que están **simuladas** en el prototipo actual de frontend y que deben ser reemplazadas por una implementación de backend.

#### [P-1] Recepción de Mensajes (Webhook)
-   **Ubicación:** Tarjeta "Inbox" (`InboxApp`).
-   **Placeholder Actual:** El usuario pega manualmente el texto de una conversación en un `<textarea>` y hace clic en "Process Message".
-   **Implementación Final (Backend):** El endpoint `/webhook` del backend recibirá automáticamente los mensajes de la plataforma externa (Facebook). El frontend solicitará estos mensajes al backend a través de `GET /api/messages`.

#### [P-2] Generación de Respuestas de IA para Inbox
-   **Ubicación:** `InboxApp.handleGenerate()`.
-   **Placeholder Actual:** La lógica del frontend llama directamente a `AIController.quickQuery()` con el prompt construido. Esto expone la lógica del prompt y realiza la llamada a la API desde el cliente.
-   **Implementación Final (Backend):** El frontend enviará el texto del cliente y el ID de la plantilla seleccionada a `POST /api/generate-reply`. El backend construirá el prompt y llamará a la API de Gemini de forma segura, devolviendo solo la respuesta final al cliente.

#### [P-3] Almacenamiento Seguro de API Keys
-   **Ubicación:** Tarjeta "Settings" (`SettingsApp`).
-   **Placeholder Actual:** La interfaz para agregar y eliminar API keys ha sido implementada. Las claves se guardan en el `localStorage` del navegador. **ESTO NO ES SEGURO PARA PRODUCCIÓN**, es solo un placeholder funcional para el prototipo.
-   **Implementación Final (Backend):** Las claves se guardarán en una base de datos o en un servicio de gestión de secretos (como AWS Secrets Manager o Google Secret Manager), encriptadas en reposo. El frontend nunca tendrá acceso directo a estas claves. El backend las usará para hacer llamadas a las APIs externas correspondientes.
