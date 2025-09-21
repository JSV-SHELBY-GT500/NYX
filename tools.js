/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { db } from '../config/firebase.js';
import { VertexAI } from '@google-cloud/vertexai';

const tasksRef = db.collection('tasks');
const expensesRef = db.collection('expenses');
const inventoryRef = db.collection('inventory');
const activityLogRef = db.collection('activityLog');
const quotesRef = db.collection('quotes');
const userPreferencesRef = db.collection('userPreferences');
const developmentRequestsRef = db.collection('developmentRequests');

/**
 * Creates a new task in Firestore. This is a tool for Vertex AI.
 * @param {{title: string, priority: string, userId: string}} params
 * @returns {{success: boolean, taskId: string, message: string}}
 */
export const createTaskTool = async ({ title, priority, userId }) => {
    try {
        const newTask = { title, priority: priority || 'medium', completed: false, createdAt: new Date(), userId };
        const docRef = await tasksRef.add(newTask);
        console.log(`[Tool: createTask] Task created with ID: ${docRef.id}`);
        return { success: true, taskId: docRef.id, message: `Task "${title}" created successfully.` };
    } catch (error) {
        console.error('[Tool: createTask] Error creating task:', error);
        return { success: false, message: `Failed to create task: ${error.message}` };
    }
};

/**
 * Creates a new expense in Firestore. This is a tool for Vertex AI.
 * @param {{category: string, amount: number, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const createExpenseTool = async ({ category, amount, userId }) => {
    try {
        const newExpense = { category, amount, timestamp: new Date(), userId };
        const docRef = await expensesRef.add(newExpense);
        console.log(`[Tool: createExpense] Expense logged with ID: ${docRef.id}`);
        return { success: true, message: `Expense of $${amount} for ${category} logged successfully.` };
    } catch (error) {
        console.error('[Tool: createExpense] Error logging expense:', error);
        return { success: false, message: `Failed to log expense: ${error.message}` };
    }
};

/**
 * Queries inventory in Firestore. This simulates RAG.
 * @param {{partName: string}} params
 * @returns {{success: boolean, data: object, message: string}}
 */
export const getInventoryStatus = async ({ partName }) => {
    try {
        const querySnapshot = await inventoryRef.where('part_name', '==', partName.toLowerCase()).limit(1).get();
        if (querySnapshot.empty) {
            return { success: true, data: { stock: 0 }, message: `No se encontró "${partName}" en el inventario.` };
        }
        const doc = querySnapshot.docs[0];
        return { success: true, data: doc.data(), message: `Pieza "${partName}" encontrada.` };
    } catch (error) {
        console.error('[Tool: getInventoryStatus] Error:', error);
        return { success: false, message: `Error al consultar el inventario: ${error.message}` };
    }
};

/**
 * Analyzes an image of a car part using Gemini Vision.
 * @param {{imageData: string, userId: string}} params
 * @returns {{success: boolean, analysis: object, message: string}}
 */
export const analyzeImage = async ({ imageData }) => {
    if (!imageData) {
        return { success: false, analysis: null, message: 'No se proporcionaron datos de imagen.' };
    }
    try {
        const vertex_ai = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: 'us-central1' });
        const visionModel = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-001' }); // Using Flash for speed

        const [header, base64Data] = imageData.split(',');
        const mimeType = header.match(/:(.*?);/)[1];

        const imagePart = { inlineData: { mimeType, data: base64Data } };
        const prompt = `Analiza la imagen de esta autoparte. Identifica el tipo de pieza, cualquier marca o número de parte visible, y su condición (nuevo, usado, dañado). Devuelve la respuesta únicamente como un objeto JSON con las claves "part_type", "part_number", "brand", y "condition". Si un campo no se puede determinar, pon su valor como "unknown". No incluyas nada más en tu respuesta, solo el JSON.`;

        const result = await visionModel.generateContent([prompt, imagePart]);
        const responseText = result.response.candidates[0].content.parts[0].text;
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(jsonString);

        return { success: true, analysis, message: 'Imagen analizada con éxito.' };
    } catch (error) {
        console.error('[Tool: analyzeImage] Error:', error);
        return { success: false, analysis: null, message: `Error al analizar la imagen: ${error.message}` };
    }
};

/**
 * Logs an important event to the activity log in Firestore.
 * @param {{description: string, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const logActivity = async ({ description, userId }) => {
    try {
        await activityLogRef.add({ description, userId, timestamp: new Date() });
        console.log(`[Tool: logActivity] Event logged for user ${userId}: "${description}"`);
        return { success: true, message: 'Actividad registrada.' };
    } catch (error) {
        console.error('[Tool: logActivity] Error:', error);
        return { success: false, message: `No se pudo registrar la actividad: ${error.message}` };
    }
};

/**
 * Creates a high-priority task to check on a special order.
 * @param {{partName: string, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const checkSpecialOrder = async ({ partName, userId }) => {
    try {
        const taskTitle = `Revisar pedido especial para: ${partName}`;
        const taskResult = await createTaskTool({ title: taskTitle, priority: 'high', userId });
        if (taskResult.success) {
            await logActivity({ description: `Tarea de pedido especial creada para "${partName}"`, userId });
            return { success: true, message: `He creado una tarea de alta prioridad para revisar el pedido especial de "${partName}".` };
        }
        return { success: false, message: 'No se pudo crear la tarea para el pedido especial.' };
    } catch (error) {
        console.error('[Tool: checkSpecialOrder] Error:', error);
        return { success: false, message: `Error al procesar el pedido especial: ${error.message}` };
    }
};

/**
 * Generates a quote for a part and stores it in Firestore.
 * @param {{partName: string, quantity: number, userId: string}} params
 * @returns {{success: boolean, quoteId: string, data: object, message: string}}
 */
export const generateQuote = async ({ partName, quantity = 1, userId }) => {
    try {
        const inventoryResult = await getInventoryStatus({ partName });
        if (!inventoryResult.data || inventoryResult.data.stock === 0) {
            return { success: false, message: `No se puede generar cotización para "${partName}" porque no está en stock.` };
        }
        const price = inventoryResult.data.price || 999; // Default price if not set
        const total = price * quantity;
        const quote = { partName, quantity, price, total, userId, status: 'generated', createdAt: new Date() };
        const docRef = await quotesRef.add(quote);
        await logActivity({ description: `Cotización ${docRef.id} generada para "${partName}"`, userId });
        return { success: true, quoteId: docRef.id, data: quote, message: `Cotización ${docRef.id} generada.` };
    } catch (error) {
        console.error('[Tool: generateQuote] Error:', error);
        return { success: false, message: `Error al generar la cotización: ${error.message}` };
    }
};

/**
 * Saves a user-specific preference or rule to Firestore for future interactions.
 * @param {{preference: string, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const saveUserPreference = async ({ preference, userId }) => {
    try {
        await userPreferencesRef.add({
            userId,
            rule: preference,
            createdAt: new Date(),
        });
        await logActivity({ description: `Nueva preferencia de usuario guardada: "${preference}"`, userId });
        return { success: true, message: `Entendido. Recordaré esta preferencia.` };
    } catch (error) {
        console.error('[Tool: saveUserPreference] Error:', error);
        return { success: false, message: 'No pude guardar esa preferencia.' };
    }
};

/**
 * Handles a development request from the user, saving it for review.
 * @param {{type: string, task: string, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const handleDevelopmentRequest = async ({ type, task, userId }) => {
    try {
        const newRequest = {
            type,
            task,
            userId,
            status: 'pending',
            createdAt: new Date(),
        };
        const docRef = await developmentRequestsRef.add(newRequest);
        await logActivity({ description: `Petición de desarrollo recibida: ${task}`, userId });
        return { success: true, requestId: docRef.id, message: `Petición de desarrollo registrada con ID ${docRef.id}.` };
    } catch (error) {
        console.error('[Tool: handleDevelopmentRequest] Error:', error);
        return { success: false, message: 'No se pudo registrar la petición de desarrollo.' };
    }
};

/**
 * Allows the AI to suggest an improvement to its own system prompt.
 * @param {{inefficiency_description: string, suggested_change: string, userId: string}} params
 * @returns {{success: boolean, message: string}}
 */
export const suggestPromptImprovement = async ({ inefficiency_description, suggested_change, userId }) => {
    try {
        const devRequest = {
            type: 'prompt-improvement',
            task: `Suggestion based on inefficiency: "${inefficiency_description}". Proposed change: "${suggested_change}"`,
            userId,
            status: 'pending',
            createdAt: new Date(),
        };
        const docRef = await db.collection('developmentRequests').add(devRequest);
        await logActivity({ description: `Sugerencia de mejora de prompt recibida: ${docRef.id}`, userId });
        return { success: true, requestId: docRef.id, message: `Sugerencia de mejora de prompt registrada con ID ${docRef.id} para revisión.` };
    } catch (error) {
        console.error('[Tool: suggestPromptImprovement] Error:', error);
        return { success: false, message: 'No se pudo registrar la sugerencia de mejora.' };
    }
};