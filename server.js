import http from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importar la configuración de Firebase para asegurar la inicialización al arranque.
import { db, auth } from './config/firebase.js';
import { processWebSocketMessage } from './controllers/agentController.js'; // Main AI chat processor
import { errorHandler } from './middleware/errorHandler.js';
import * as tools from './tools/tools.js'; // Import tools for direct use

// Importar rutas modulares
import tasksRouter from './routes/tasks.js';
import notesRouter from './routes/notes.js';
import expensesRouter from './routes/expenses.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 10 * 1024 * 1024 }); // 10MB payload limit for images
const port = process.env.PORT || 8080;

// Middleware
app.use(cors()); // Habilitar CORS para todas las rutas
app.use(express.json()); // Para parsear application/json

// Ruta de prueba para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('Nyx V3.0 Backend: El Sacrificio Inicial ha sido completado. El santuario está listo.');
});

// Usar las rutas de la API
app.use('/api/tasks', tasksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/expenses', expensesRouter);

/**
 * Handles the final step of sending a user-confirmed quote.
 * This is a direct workflow, not involving the AI agent.
 */
async function handleSendQuote(ws, { quoteId, userId }) {
    try {
        await db.collection('quotes').doc(quoteId).update({ status: 'sent', confirmedAt: new Date() });
        await tools.logActivity({ userId, description: `Cotización ${quoteId} confirmada y enviada.` });
        ws.send(JSON.stringify({
            event: 'notification',
            payload: { type: 'success', message: `Cotización ${quoteId} enviada con éxito.` }
        }));
    } catch (error) {
        console.error('[handleSendQuote] Error:', error);
        ws.send(JSON.stringify({ event: 'error', payload: `Error al enviar la cotización ${quoteId}.` }));
    }
}

/**
 * Handles requests related to the development workflow.
 */
async function handleDevWorkflow(ws, event, payload) {
    const { userId, requestId, status } = payload;

    switch (event) {
        case 'request-dev-requests':
            try {
                const snapshot = await db.collection('developmentRequests').orderBy('createdAt', 'desc').get();
                const requests = [];
                snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
                ws.send(JSON.stringify({ event: 'dev-requests-loaded', payload: requests }));
            } catch (error) {
                console.error('[handleDevWorkflow] Error fetching dev requests:', error);
                ws.send(JSON.stringify({ event: 'error', payload: 'No se pudieron cargar las peticiones de desarrollo.' }));
            }
            break;

        case 'update-dev-request-status':
            try {
                if (!requestId || !status || !userId) {
                    throw new Error('Faltan requestId, status o userId.');
                }
                const docRef = db.collection('developmentRequests').doc(requestId);
                await docRef.update({ status });
                await tools.logActivity({ userId, description: `Petición de desarrollo ${requestId} actualizada a: ${status}` });

                ws.send(JSON.stringify({
                    event: 'notification',
                    payload: { type: 'success', message: `Petición ${requestId} marcada como '${status}'.` }
                }));
                // Optionally, broadcast the update to all admins
            } catch (error) {
                console.error('[handleDevWorkflow] Error updating dev request:', error);
                ws.send(JSON.stringify({ event: 'error', payload: `Error al actualizar la petición ${requestId}.` }));
            }
            break;
    }
}

/**
 * Handles a request from the client to load their chat history.
 */
async function handleHistoryRequest(ws, { userId }) {
    try {
        const messagesSnapshot = await db.collection('chatSessions').doc(userId).collection('messages').orderBy('timestamp', 'asc').limit(50).get();
        const historyForClient = [];
        const rawHistoryForAgent = []; // The format Vertex AI expects

        messagesSnapshot.forEach(doc => {
            const data = doc.data();
            historyForClient.push({ id: doc.id, ...data });
            rawHistoryForAgent.push({
                role: data.role,
                parts: data.content.map(p => {
                    if (p.type === 'text') return { text: p.text };
                    if (p.type === 'functionCall') return { functionCall: p.functionCall };
                    if (p.type === 'functionResponse') return { functionResponse: p.functionResponse };
                    return p;
                })
            });
        });

        ws.send(JSON.stringify({
            event: 'history-loaded',
            payload: { history: historyForClient, rawHistory: rawHistoryForAgent }
        }));
    } catch (error) {
        console.error(`[handleHistoryRequest] Error for user ${userId}:`, error);
        ws.send(JSON.stringify({ event: 'error', payload: 'No se pudo cargar el historial.' }));
    }
}

// Lógica del Servidor WebSocket
wss.on('connection', (ws) => {
    console.log('[WebSocket] Cliente conectado.');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[WebSocket] Mensaje recibido:', data.event);

            switch (data.event) {
                case 'chat-message':
                    await processWebSocketMessage(ws, data.payload);
                    break;
                case 'send-confirmed-quote':
                    await handleSendQuote(ws, data.payload);
                    break;
                case 'request-history':
                    await handleHistoryRequest(ws, data.payload);
                    break;
                case 'request-dev-requests':
                case 'update-dev-request-status':
                    await handleDevWorkflow(ws, data.event, data.payload);
                    break;
                default:
                    console.warn(`[WebSocket] Evento desconocido recibido: ${data.event}`);
            }
        } catch (error) {
            console.error('[WebSocket] Error procesando mensaje:', error);
            ws.send(JSON.stringify({ event: 'error', payload: 'Error interno del servidor al procesar el mensaje.' }));
        }
    });

    ws.on('close', () => {
        console.log('[WebSocket] Cliente desconectado.');
    });
});


// 4. Middleware de Manejo de Errores Centralizado
app.use(errorHandler);

server.listen(port, () => {
    console.log(`Servidor de Nyx V3.0 (HTTP + WebSocket) escuchando en http://localhost:${port}`);
});