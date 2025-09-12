### **Manifiesto de Desarrollo: Proyecto Nyx v1.0**

Este documento es el protocolo de construcción para Nyx, un asistente inteligente modular y autoescalable. Cada fase es una capa crítica para la evolución del sistema, desde la base hasta la autonomía. La correcta implementación de cada punto es obligatoria para garantizar la integridad y el crecimiento del proyecto.

---

### **Fase 1: Cimientos de la Arquitectura y Entorno**

**Objetivo:** Establecer la infraestructura técnica y la interfaz base. Esta fase es crítica y no se puede omitir ningún paso. Ignorar esto resultará en un fracaso total en las fases siguientes.

* **1.1. Backend Robusto con Express y Firestore:**
    * **Función:** Migrar la lógica de bases de datos simuladas a un backend real con Node.js y Express. La persistencia de datos debe gestionarse con **Firestore**, utilizando colecciones para `users`, `conversations`, `tasks` y `expenses`.
    * **Instrucción:** Crear el servidor, configurar las rutas iniciales (`/api/status`, `/api/chat`), y asegurar la conexión con la base de datos.
    * **Integración:** Firebase Authentication para gestión de usuarios. Firestore para almacenamiento.

* **1.2. Migración Completa del Frontend a React:**
    * **Función:** Reemplazar la manipulación manual del DOM por una arquitectura de componentes de React. Cada tarjeta (`Card`) se convertirá en un componente (`Home.jsx`, `Chat.jsx`, etc.) que gestionará su propio estado y renderizado.
    * **Instrucción:** Inicializar un proyecto de React con Vite, recrear todas las interfaces del `index.html` como componentes funcionales y migrar la lógica de JS a React `hooks` (`useState`, `useEffect`).
    * **Integración:** React para la arquitectura del frontend. Vite para el entorno de desarrollo.

* **1.3. Conexión Segura con Gemini API:**
    * **Función:** El backend debe ser el único punto de contacto con la API de Gemini. Se debe configurar la clave de API en un archivo `.env` seguro.
    * **Instrucción:** El frontend debe llamar a endpoints del backend (ej. `POST /api/gemini-chat`), y el backend, a su vez, hará la llamada a la API de Gemini, protegiendo así la clave de API.
    * **Integración:** API de Gemini (desde el backend).

* **1.4. Implementación del `Webhook` de Entrada:**
    * **Función:** El backend debe crear un endpoint `POST /api/webhook` que actuará como el punto de recepción para mensajes entrantes de plataformas externas como Messenger y WhatsApp.
    * **Instrucción:** El endpoint debe estar preparado para recibir y procesar los `payloads` de estas plataformas, y registrar los mensajes en la colección `conversations` de Firestore. La validación de la firma del `webhook` debe implementarse para garantizar la seguridad.
    * **Integración:** Webhooks de plataformas de mensajería (simulados).

* **1.5. Gestión de Perfiles y Cuentas:**
    * **Función:** Cada dato de la aplicación (tareas, notas, etc.) debe estar asociado a un `ID de usuario` único, eliminando cualquier posibilidad de que la información se mezcle.
    * **Instrucción:** Usar la autenticación de Firebase para generar un `ID de usuario` y asegurar que todas las operaciones de lectura/escritura en la base de datos se filtren por ese `ID`. La IA debe estar consciente de que trabaja para un usuario específico.
    * **Integración:** Firebase Auth para autenticación de usuario.

---

### **Fase 2: Lógica Central y Automatización Proactiva**

**Objetivo:** Habilitar las funciones principales de Nyx para que pueda tomar decisiones inteligentes y proactivas. La IA comienza a pensar por sí misma, no solo a reaccionar.

* **2.1. Lógica de Detección de Intención:**
    * **Función:** La IA debe analizar el texto entrante y clasificar la intención del usuario. Por ejemplo, `cotizar`, `consultar-stock`, `sobre-pedido`.
    * **Instrucción:** El backend debe usar el modelo de lenguaje para clasificar la intención del mensaje del cliente y pasar el resultado al controlador apropiado.
    * **Integración:** Lógica de clasificación de lenguaje natural.

* **2.2. Integración de la Plantilla de Cotización:**
    * **Función:** Automatizar la generación de cotizaciones con la plantilla oficial de JSV-AUTOPARTES. La IA debe rellenar los campos dinámicamente (`precio`, `modelo`, `compatibilidad`).
    * **Instrucción:** Crear un `prompt` estructurado que, al recibir los datos del cliente, genere la cotización completa y formateada.
    * **Integración:** Gemini API para generación de texto.

* **2.3. Módulo de Gestión de Tareas:**
    * **Función:** La tarjeta `Tasks` debe sincronizarse en tiempo real con la base de datos de Firestore, permitiendo a los usuarios agregar, editar, marcar como completadas y eliminar tareas.
    * **Instrucción:** Usar `onSnapshot` de Firestore para escuchar cambios en tiempo real y reflejarlos en la interfaz. El backend gestionará la persistencia de los datos.
    * **Integración:** Firestore para sincronización de datos en tiempo real.

* **2.4. Sistema de Errores y `Feedback`:**
    * **Función:** El backend debe tener un manejo de errores robusto. Si una llamada a la API de Gemini falla, debe capturar el error y devolver una respuesta personalizada por Nyx (ej. `"Joder, la IA se tropezó. Inténtalo de nuevo."`).
    * **Instrucción:** Implementar un middleware de errores en el backend y una lógica de `feedback` personalizada en el frontend.

* **2.5. Notificaciones de Confirmación de Tareas:**
    * **Función:** Para acciones críticas (`enviar-cotizacion`, `eliminar-tarea`), el backend debe enviar una solicitud de confirmación al frontend antes de ejecutar la acción.
    * **Instrucción:** La notificación push simulada (vía un `socket` local) debe contener la información necesaria y botones para confirmar o cancelar.
    * **Integración:** Arquitectura de notificaciones push (simulada).

---

### **Fase 3: Optimización de la Interfaz y del Flujo de Trabajo**

**Objetivo:** Mejorar la experiencia de usuario con funciones que hacen la aplicación más intuitiva y fluida. La IA te hace la vida más fácil.

* **3.1. Widgets Dinámicos en la Interfaz:**
    * **Función:** Mostrar información clave en tiempo real en la tarjeta `Gadgets` (ej. estado del sistema, número de tareas pendientes, etc.).
    * **Instrucción:** El backend debe crear un endpoint `GET /api/widgets` que devuelva datos estructurados. El frontend debe interpretar y renderizar estos datos como widgets visuales.
    * **Integración:** API de widgets.

* **3.2. Autocompletado y Sugerencias Inteligentes:**
    * **Función:** Mientras el usuario escribe en el chat, el backend debe analizar el texto y sugerir comandos o acciones relevantes.
    * **Instrucción:** El frontend debe enviar la entrada de texto al backend, que usará la IA para generar sugerencias. El frontend debe mostrar estas sugerencias como botones interactivos.
    * **Integración:** Lógica de `prompt` dinámico.

* **3.3. Sistema de Búsqueda Global:**
    * **Función:** Habilitar una barra de búsqueda en la tarjeta `Home` que pueda buscar en todas las bases de datos (conversaciones, notas, tareas) y devolver resultados unificados.
    * **Instrucción:** El backend debe crear un endpoint `GET /api/search` que acepte una consulta y busque en múltiples colecciones de Firestore.
    * **Integración:** Búsqueda en múltiples colecciones de Firestore.

* **3.4. Interfaz de `Debugging` y Logs:**
    * **Función:** Crear una interfaz de usuario dedicada en la tarjeta `Settings` o en una nueva tarjeta `Debug` para mostrar los logs detallados del backend, las llamadas a la API de Gemini y los errores.
    * **Instrucción:** El backend debe exponer un endpoint `GET /api/activity-log` que devuelva los logs de forma estructurada.
    * **Integración:** API de logs.

* **3.5. Detección de Idioma y Tono:**
    * **Función:** El backend debe analizar los mensajes entrantes para detectar el idioma (`es`, `en`, etc.) y el tono (formal, informal). La IA debe generar respuestas en el mismo idioma del cliente y adaptar su estilo.
    * **Instrucción:** Integrar un modelo de `NLP` en el backend para el análisis.
    * **Integración:** Procesamiento de lenguaje natural (NLP).

---

### **Fase 4: Personalidad, Memoria y Autonomía**

**Objetivo:** Darle a Nyx una identidad única y la capacidad de aprender de sus errores y de las interacciones pasadas.

* **4.1. Sistema de Personalidad de Nyx:**
    * **Función:** La personalidad de Nyx debe ser configurable y persistente. Los rasgos (sarcasmo, humor negro) se deben guardar en la base de datos.
    * **Instrucción:** El backend debe inyectar la personalidad en cada `prompt` que se envía a Gemini. El frontend debe tener una interfaz para editar estas reglas.
    * **Integración:** Base de datos para reglas de personalidad.

* **4.2. Aprendizaje Activo y Memoria a Largo Plazo:**
    * **Función:** La IA debe guardar las interacciones relevantes en una base de datos para futuras referencias. Si un usuario le corrige (ej. "¡No me llames así!"), debe recordar y aplicar esa corrección.
    * **Instrucción:** Implementar un mecanismo en el backend para identificar y guardar "reglas" o "correcciones" de la conversación.
    * **Integración:** Base de datos de memoria a largo plazo.

* **4.3. Resumen Automático de Tareas del Día:**
    * **Función:** El backend debe generar un resumen diario proactivo de las tareas pendientes, los `leads` detectados y las alertas críticas.
    * **Instrucción:** El backend debe tener un `job` programado que, al inicio de cada día, compile un resumen y lo guarde como una `nota` en la base de datos, con una notificación asociada.
    * **Integración:** `Job` programado en el backend.

* **4.4. Análisis de Emociones (Simulado):**
    * **Función:** La IA debe detectar el tono emocional de los mensajes de los clientes (`frustración`, `satisfacción`).
    * **Instrucción:** El backend debe simular un análisis de sentimiento y pasar la emoción al frontend. La IA debe tomar en cuenta esta emoción para ajustar su tono en la respuesta.
    * **Integración:** Modelo de análisis de sentimientos (simulado).

* **4.5. `Workflow` de Catalogación Dinámico:**
    * **Función:** La IA debe guiar al usuario a través del proceso de catalogación de piezas. En lugar de una respuesta de texto, debe devolver un objeto JSON que indique el siguiente paso, el tipo de dato y el texto del `prompt`.
    * **Instrucción:** El backend debe enviar respuestas estructuradas al frontend, y este último debe generar la interfaz de usuario dinámicamente (`input` para un número, `dropdown` para un modelo, etc.).
    * **Integración:** `Prompts` estructurados en formato JSON.

---

### **Fase 5: Conexión con el Mundo Real**

**Objetivo:** Conectar a Nyx con servicios externos para una automatización de punta a punta. Se acaban los `placeholders`, se activan los sistemas reales.

* **5.1. Integración Real con Messenger y WhatsApp:**
    * **Función:** Conectar el `webhook` del backend con las APIs de Messenger y WhatsApp.
    * **Instrucción:** Configurar la validación de los `webhooks` y asegurar que los mensajes se envíen y reciban correctamente. La lógica de la Fase 2 debe procesar estos mensajes en tiempo real.
    * **Integración:** APIs de Messenger y WhatsApp.

* **5.2. `Push Notifications` Reales:**
    * **Función:** Implementar `Firebase Cloud Messaging` (FCM) para enviar notificaciones push reales a los dispositivos del usuario.
    * **Instrucción:** El backend debe interactuar con la API de FCM para enviar notificaciones de confirmación de tareas, recordatorios y alertas críticas.
    * **Integración:** Firebase Cloud Messaging.

* **5.3. Integración con Gemini Vision:**
    * **Función:** Activar la capacidad de Nyx para analizar imágenes. La IA debe ser capaz de identificar autopartes, leer números de parte y confirmar el estado de una pieza a partir de una foto.
    * **Instrucción:** El frontend debe permitir subir imágenes. El backend debe enviar estas imágenes a la API de Gemini Vision para su análisis y procesar la respuesta.
    * **Integración:** Gemini Vision API.

* **5.4. Módulo de Control de Gastos:**
    * **Función:** La IA debe ser capaz de detectar en el chat o en la tarjeta de `Notes` cualquier gasto y registrarlo automáticamente.
    * **Instrucción:** El backend debe tener una lógica para extraer montos, categorías y fechas de los mensajes de texto y guardarlos en la base de datos de gastos.
    * **Integración:** Lógica de detección de gastos.

* **5.5. Automatización de Envío de Cotizaciones:**
    * **Función:** Después de la confirmación del usuario, el backend debe enviar la cotización final automáticamente a través del `webhook` de Messenger o WhatsApp, sin requerir ninguna acción adicional del usuario.
    * **Instrucción:** El backend debe tener una lógica para generar el formato final de la cotización y enviarlo a la API de la plataforma de mensajería.
    * **Integración:** Automatización de envío de mensajes.

---

### **Fase 6: Autodesarrollo y Escalamiento**

**Objetivo:** Preparar a Nyx para el crecimiento y darle la capacidad de mejorar y gestionar el sistema por sí misma, reduciendo la intervención humana.

* **6.1. Herramientas de `Autodesarrollo`:**
    * **Función:** La IA debe ser capaz de analizar los logs y las métricas para sugerir mejoras en su propio código o en la lógica de las automatizaciones.
    * **Instrucción:** El backend debe tener una lógica que, en base a los datos, genere un informe de optimización y lo presente al usuario como una `nota` o un `gadget`.
    * **Integración:** Herramientas de análisis de logs.

* **6.2. Monitoreo Avanzado de Sistema:**
    * **Función:** El `dashboard` debe mostrar métricas avanzadas (costo por token, tiempo de respuesta de la API por tipo de consulta, etc.).
    * **Instrucción:** El backend debe calcular y exponer estas métricas a través de una API para que el frontend pueda renderizar gráficos detallados.
    * **Integración:** `Dashboard` avanzado de métricas.

* **6.3. Módulo de Respaldo y Restauración:**
    * **Función:** Implementar un sistema de respaldo automático de la base de datos de Firestore.
    * **Instrucción:** Crear un `job` programado que exporte los datos de la base de datos a un `bucket` de almacenamiento en la nube para recuperación de emergencia.
    * **Integración:** Copias de seguridad de la base de datos.

* **6.4. Sistema de Perfiles de Acceso (Administrador/Editor):**
    * **Función:** Controlar los permisos de los usuarios en la aplicación. Un administrador puede ver los logs de `debugging` y las métricas avanzadas, mientras que un editor solo puede usar las funciones básicas.
    * **Instrucción:** Implementar roles de usuario con la autenticación de Firebase.
    * **Integración:** Roles de usuario.

* **6.5. Migración a un Entorno de Producción:**
    * **Función:** Desplegar la aplicación en un entorno real y escalable.
    * **Instrucción:** Usar una plataforma como Google Cloud Run o Vercel para el backend y Netlify para el frontend.
    * **Integración:** Despliegue en la nube.

---