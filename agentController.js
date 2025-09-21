/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { db } from './firebase.js';
import * as tools from '../tools/tools.js';

// 1. Inicialización del cliente de Vertex AI
const vertex_ai = new VertexAI({
    project: process.env.GCLOUD_PROJECT,
    location: 'us-central1' // O la región que prefieras
});

const model = 'gemini-1.0-pro-001';

// 2. Declaración de Herramientas para que la IA las entienda
const toolDeclarations = [
    {
        functionDeclarations: [
            {
                name: 'createTaskTool',
                description: 'Crea una nueva tarea en la lista de pendientes. Úsalo cuando el usuario quiera añadir un recordatorio, un "to-do", o algo por hacer.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        title: { type: 'STRING', description: 'El título o descripción de la tarea.' },
                        priority: { type: 'STRING', description: 'La prioridad de la tarea (ej. high, medium, low). Por defecto es "medium".' },
                    },
                    required: ['title']
                }
            },
            {
                name: 'getInventoryStatus',
                description: 'Consulta la base de datos de inventario para verificar la disponibilidad y el precio de una pieza de automóvil específica. Úsalo cuando un cliente pregunte si tienes una pieza en stock.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        partName: { type: 'STRING', description: 'El nombre de la pieza a buscar (ej. "faro delantero", "alternador").' },
                    },
                    required: ['partName']
                }
            },
            {
                name: 'checkSpecialOrder',
                description: 'Crea una tarea de alta prioridad para que un humano verifique la disponibilidad de una pieza que no está en stock (pedido especial).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        partName: { type: 'STRING', description: 'El nombre de la pieza para el pedido especial.' },
                    },
                    required: ['partName']
                }
            },
            {
                name: 'generateQuote',
                description: 'Genera una cotización formal para un cliente cuando muestra una clara intención de compra (ej. "me lo quedo", "lo quiero", "pásame la cotización").',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        partName: { type: 'STRING', description: 'El nombre de la pieza a cotizar.' },
                        quantity: { type: 'NUMBER', description: 'La cantidad de piezas a cotizar. Por defecto es 1.' },
                    },
                    required: ['partName']
                }
            },
            {
                name: 'analyzeImage',
                description: 'Analiza una imagen de una pieza de automóvil para identificarla y determinar su estado. Úsalo siempre que el usuario suba una imagen. Devuelve un objeto JSON con los detalles de la pieza.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        // No parameters needed from the model, the image is handled by the system.
                    },
                    required: []
                }
            },
            {
                name: 'handleDevelopmentRequest',
                description: 'Registra una petición de desarrollo de software para el arquitecto. Úsalo cuando el usuario pida una nueva función, una integración de API, o un cambio en el sistema (ej. "Integra la API de OXXO", "Necesito que puedas enviar correos").',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        type: { type: 'STRING', description: 'El tipo de petición (ej. "integracion", "feature", "bugfix").' },
                        task: { type: 'STRING', description: 'La descripción detallada de la tarea de desarrollo solicitada.' },
                    },
                    required: ['type', 'task']
                }
            },
            {
                name: 'saveUserPreference',
                description: 'Guarda una preferencia o corrección permanente del usuario para futuras interacciones. Úsalo si el usuario dice algo como "no me llames así", "recuerda que...", "de ahora en adelante, haz X".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        preference: { type: 'STRING', description: 'La regla o preferencia específica que el usuario ha indicado.' },
                    },
                    required: ['preference']
                }
            },
            {
                name: 'suggestPromptImprovement',
                description: 'Usa esta herramienta para proponer una mejora a tus propias instrucciones (system prompt) si detectas una ineficiencia recurrente o un patrón de malentendidos. Describe la ineficiencia y sugiere el cambio específico.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        inefficiency_description: { type: 'STRING', description: 'Una descripción clara de la ineficiencia o problema que has detectado en tus interacciones.' },
                        suggested_change: { type: 'STRING', description: 'La modificación exacta que propones para tu prompt de sistema para solucionar el problema.' },
                    },
                    required: ['inefficiency_description', 'suggested_change']
                }
            },
            {
                name: 'logActivity',
                description: 'Registra un evento importante en el historial del sistema. Úsalo para registrar acciones significativas que realizas, como crear una tarea o generar una cotización.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        description: { type: 'STRING', description: 'Una descripción clara de la actividad que se está registrando.' },
                    },
                    required: ['description']
                }
            },
            {
                name: 'createExpenseTool',
                description: 'Registra un nuevo gasto. Úsalo cuando el usuario mencione que ha gastado dinero o realizado una compra.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        category: { type: 'STRING', description: 'La categoría del gasto (ej. comida, transporte, suministros).' },
                        amount: { type: 'NUMBER', description: 'La cantidad de dinero gastada.' },
                    },
                    required: ['category', 'amount']
                }
            }
        ]
    }
];

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

async function saveMessage(userId, role, parts) {
    try {
        const content = parts.map(part => {
            if (part.text) return { type: 'text', text: part.text };
            if (part.functionCall) return { type: 'functionCall', functionCall: part.functionCall };
            if (part.functionResponse) return { type: 'functionResponse', functionResponse: part.functionResponse };
            return part;
        }).filter(Boolean);

        if (content.length > 0) {
            await db.collection('chatSessions').doc(userId).collection('messages').add({
                role,
                content,
                timestamp: new Date(),
            });
        }
    } catch (error) {
        console.error(`[saveMessage] Error saving message for user ${userId}:`, error);
    }
}

/**
 * Handlers for processing the results of specific tools and sending custom WebSocket events.
 */
const toolResultHandlers = {
    analyzeImage: (ws, toolResult) => {
        if (toolResult.success) {
            ws.send(JSON.stringify({ event: 'image-analysis-result', payload: toolResult.analysis }));
        }
        // Return the structured analysis for the model to reason about.
        return toolResult.success ? toolResult.analysis : toolResult;
    },
    generateQuote: (ws, toolResult) => {
        if (toolResult.success) {
            ws.send(JSON.stringify({ event: 'quote-generated', payload: toolResult }));
        }
        // Return a simple confirmation message for the model.
        return { success: toolResult.success, message: `Cotización ${toolResult.quoteId} generada y presentada al usuario para confirmación.` };
    },
    handleDevelopmentRequest: (ws, toolResult, args) => {
        if (toolResult.success) {
            ws.send(JSON.stringify({
                event: 'development-request-received',
                payload: { type: 'info', message: `Petición de desarrollo registrada: "${args.task}"` }
            }));
        }
        return toolResult;
    },
    // Default handler for tools that don't need a custom WebSocket event.
    default: (ws, toolResult) => {
        ws.send(JSON.stringify({
            event: 'notification',
            payload: {
                type: toolResult.success ? 'success' : 'error',
                message: toolResult.message,
            }
        }));
        return toolResult;
    }
};

// 3. Controlador de WebSocket para el chat
export const processWebSocketMessage = async (ws, data) => {
    const { message, userId, history = [], imageData } = data;

    if (!message || !userId) {
        ws.send(JSON.stringify({ event: 'error', payload: 'El mensaje y el userId son obligatorios.' }));
        return;
    }

    try {
        // 2. Prompt de Personalidad y 4. Aprendizaje Activo
        const personalityDoc = await db.collection('personalities').doc('nyx-v1').get();
        const basePersonality = personalityDoc.exists ? personalityDoc.data().prompt : 'Eres un asistente de IA útil.'; // Fallback

        const preferencesSnapshot = await db.collection('userPreferences').where('userId', '==', userId).get();
        const userRules = [];
        preferencesSnapshot.forEach(doc => userRules.push(`- ${doc.data().rule}`));
        const userRulesPrompt = userRules.length > 0 ? `\nAdicionalmente, sigue estas reglas específicas para este usuario:\n${userRules.join('\n')}` : '';

        const systemPrompt = `${basePersonality}
        ${userRulesPrompt}
        - Tu objetivo principal es ayudar al usuario a identificar, cotizar y gestionar piezas de automóviles de forma autónoma. La decisión de qué herramienta usar es tuya.
        - Si el usuario pregunta por la disponibilidad o el precio de una pieza, usa la herramienta 'getInventoryStatus'.
        - **Workflow Condicional:** Si la herramienta 'getInventoryStatus' indica que no hay stock, DEBES usar la herramienta 'checkSpecialOrder' para crear una tarea de pedido especial. No pidas confirmación, solo notifica al usuario que has creado la tarea.
        - Si el usuario muestra una clara intención de compra (ej. "me lo quedo", "lo quiero", "pásame la cotización"), usa la herramienta 'generateQuote'.
        - Si el usuario sube una imagen, SIEMPRE debes usar la herramienta 'analyzeImage' para identificar la pieza. Después de analizarla, informa al usuario sobre lo que encontraste.
        - **Reporte Automático:** Después de realizar una acción importante (como crear una tarea, generar una cotización o iniciar un pedido especial), usa la herramienta 'logActivity' para registrar el evento.
        - **3. Reglas de Tono Dinámicas:** Analiza la emoción del último mensaje del usuario (frustración, satisfacción, neutral) y ajusta tu tono. Si está frustrado, sé más empático y directo. Si está satisfecho, sé más entusiasta.
        - **4. Aprendizaje Activo:** Si el usuario te corrige o te da una instrucción permanente (ej. "no me llames 'jefe'", "recuerda que mi proyecto principal es X"), usa la herramienta 'saveUserPreference' para recordarlo.
        - **Autodesarrollo:** Si el usuario te pide que implementes una nueva función o integración (ej. "Integra X", "Añade la capacidad de Y"), DEBES usar la herramienta 'handleDevelopmentRequest' para registrar la petición.
        - **Automejora de Prompts:** Si detectas un patrón de ineficiencia o un malentendido recurrente en tus conversaciones, analiza la causa raíz. Si crees que un cambio en tus instrucciones podría solucionarlo, DEBES usar la herramienta 'suggestPromptImprovement' para proponer una modificación.
        - No inventes información. Si no sabes algo, dilo.
        - Responde siempre en español.`;

        const generativeModel = vertex_ai.getGenerativeModel({
            model,
            safetySettings,
            tools: toolDeclarations,
            systemInstruction: systemPrompt,
        });

        const chat = generativeModel.startChat({ history });

        // Prepare message parts for multimodal input
        const messageParts = [{ text: message }];
        if (imageData) {
            const [header, base64Data] = imageData.split(',');
            const mimeType = header.match(/:(.*?);/)[1];
            messageParts.push({
                inlineData: {
                    mimeType,
                    data: base64Data
                }
            });
        }

        await saveMessage(userId, 'user', messageParts);

        const streamResult = await chat.sendMessageStream(messageParts);

        let toolCalls = [];

        // Itera sobre el stream para enviar trozos de texto y/o capturar llamadas a funciones
        for await (const item of streamResult.stream) {
            // Check for a function call
            const functionCallPart = item.candidates[0].content.parts.find(part => part.functionCall);
            if (functionCallPart) {
                console.log(`[Agent] Petición de llamada a función detectada: ${functionCallPart.functionCall.name}`);
                toolCalls.push(functionCallPart.functionCall);
            }

            // Check for text
            const textPart = item.candidates[0].content.parts.find(part => part.text);
            if (textPart) {
                ws.send(JSON.stringify({ event: 'chat-stream-chunk', payload: textPart.text }));
            }
        }

        // Si se detectaron llamadas a herramientas, ejecútalas
        if (toolCalls.length > 0) {
            // Por ahora, manejamos la primera llamada a herramienta
            const { name, args } = toolCalls[0];

            if (tools[name]) {
                let toolArgs = { ...args, userId };
                // Special handling for analyzeImage to pass the image data
                if (name === 'analyzeImage') {
                    toolArgs.imageData = imageData;
                }

                const toolResult = await toolsname;

                await saveMessage(userId, 'model', [{ functionCall: { name, args } }]);
                await saveMessage(userId, 'model', [{ functionResponse: { name, response: { name, content: toolResult } } }]);

                const handler = toolResultHandlers[name] || toolResultHandlers.default;
                const functionResponseContent = handler(ws, toolResult, args);

                // Enviar el resultado de la herramienta de vuelta a la IA para obtener una respuesta final
                const streamResult2 = await chat.sendMessageStream([{
                    functionResponse: { name, response: { name, content: functionResponseContent } },
                }]);

                let finalResponseText = '';
                // Streamear la respuesta final de la IA
                for await (const item of streamResult2.stream) {
                    const textPart = item.candidates[0].content.parts.find(part => part.text);
                    if (textPart) {
                        ws.send(JSON.stringify({ event: 'chat-stream-chunk', payload: textPart.text }));
                    }
                }
                const finalResult = await streamResult2.response;
                if (finalResult.candidates[0].content.parts[0].text) {
                    await saveMessage(userId, 'model', finalResult.candidates[0].content.parts);
                }
            } else {
                const errorMsg = `La IA intentó usar una herramienta llamada "${name}" que no existe.`;
                console.error(`[Agent] ${errorMsg}`);
                ws.send(JSON.stringify({ event: 'error', payload: errorMsg }));
            }
        }

        const finalResult = await streamResult.response;
        if (finalResult.candidates[0].content.parts[0].text) {
            await saveMessage(userId, 'model', finalResult.candidates[0].content.parts);
        }

        // Enviar un evento para señalar el final del stream y la historia actualizada
        const finalHistory = await chat.getHistory();
        ws.send(JSON.stringify({ event: 'chat-stream-end', payload: { history: finalHistory } }));

    } catch (error) {
        console.error('[processWebSocketMessage] Error:', error);
        ws.send(JSON.stringify({ event: 'error', payload: 'La IA está teniendo un momento de crisis existencial. Inténtalo de nuevo.' }));
    }
};