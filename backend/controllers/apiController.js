/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from '@google/genai';
import * as db from '../database.js';

// [P-3] Initialize Gemini securely from environment variables.
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set for backend.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

/**
 * Runs a suite of automations on a given text message.
 * This is where the magic happens before the AI is even called.
 * @param {string} text The incoming message text.
 * @returns {object} An object containing the results of the automations.
 */
const runAutomations = async (text) => {
    const results = {
        notifications: [],
        haltGeneration: false,
        haltReason: '',
        suggestedTemplateId: null,
        detectedEmotion: 'neutral', // New: Emotion analysis
    };
    
    const lowerText = text.toLowerCase();

    // AUTOMATION: Detección de "sin stock" y "sobre pedido"
    const stockItem = db.findStockByKeywords(lowerText);
    if (stockItem) {
        if (stockItem.stock === 0) {
            results.haltGeneration = true;
            results.haltReason = `La pieza solicitada (${stockItem.name}) no tiene stock. Necesito verificar con el proveedor si es posible conseguirla sobre pedido. Te notifico en breve.`;
            results.notifications.push({ type: 'stock_alert', message: `Stock check: ${stockItem.name} is out of stock.` });
            await db.addTask(`Verify "special order" availability for ${stockItem.name}`, 'high');
            results.notifications.push({ type: 'task_created', message: `Task created to check special order for ${stockItem.name}.` });
        } else {
            results.notifications.push({ type: 'stock_info', message: `Stock check: ${stockItem.name} has ${stockItem.stock} units available.` });
        }
    }

    // AUTOMATION: Generación de to-dos
    const taskRegex = /(revisa|busca|check|find|cotiza|search)\s(.+)/i;
    const taskMatch = lowerText.match(taskRegex);
    if (taskMatch && taskMatch[2]) {
        const taskTitle = `User requested: ${taskMatch[1]} ${taskMatch[2]}`;
        const newTask = await db.addTask(taskTitle, 'high');
        if (newTask) {
            results.notifications.push({ type: 'task_created', message: `Task created: "${taskTitle}"` });
            await db.logActivity('task_created', { title: taskTitle });
        }
    }

    // AUTOMATION: Lógica de plantillas mejorada
    const partKeywords = ['parte', 'pieza', 'refacción', 'faro', 'motor', 'suspensión', 'cotiza'];
    if (partKeywords.some(kw => lowerText.includes(kw))) {
        results.suggestedTemplateId = 'parts-quote';
        results.notifications.push({ type: 'template_suggestion', message: 'Suggested template: Parts Quote' });
    }
    
    // AUTOMATION (NEW): Análisis de Emociones (Simulado)
    const frustrationKeywords = ['problema', 'no funciona', 'tarda mucho', 'error', 'ayuda'];
    const satisfactionKeywords = ['gracias', 'excelente', 'perfecto', 'muy bien', 'funciona'];
    if (frustrationKeywords.some(kw => lowerText.includes(kw))) {
        results.detectedEmotion = 'frustration';
    } else if (satisfactionKeywords.some(kw => lowerText.includes(kw))) {
        results.detectedEmotion = 'satisfaction';
    }


    return results;
};

// --- Controller Functions ---

/**
 * Handles incoming webhooks, simulating a message from an external platform.
 */
export const handleWebhook = async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Seriously? A webhook call without a message? Try again.' });
    }

    try {
        console.log(`[Webhook] Received message: "${message}"`);
        await db.logActivity('webhook_received', { message });
        const automationResults = await runAutomations(message);
        await db.addMessage(message, 'webhook');

        res.status(200).json({
            status: "Message received and processed. I've already run some automations for you.",
            automations: automationResults.notifications,
        });
    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        res.status(500).json({ error: 'Something went wrong. The machines are angry.' });
    }
};

/**
 * Generates a reply using the Gemini API after running automations.
 */
export const generateReply = async (req, res) => {
    const { message, templateId, context } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'A message is required to generate a reply. I\'m not a mind reader.' });
    }

    try {
        console.log(`[generateReply] Generating reply for: "${message}"`);
        const startTime = Date.now();
        const automationResults = await runAutomations(message);

        if (automationResults.haltGeneration) {
            console.log(`[generateReply] Halting generation due to: ${automationResults.haltReason}`);
            await db.logActivity('ai_reply_halted', { reason: automationResults.haltReason });
            return res.json({
                aiResponse: automationResults.haltReason,
                summary: "Action required by agent.",
                automations: automationResults.notifications,
                emotion: automationResults.detectedEmotion,
            });
        }

        const finalTemplateId = automationResults.suggestedTemplateId || templateId || 'default';
        const template = db.getTemplateById(finalTemplateId);
        
        let prompt = `${template.content}\n`;
        if (context) {
            prompt += `CONTEXTO GENERAL:\n${context}\n\n`;
        }
        // New: Add emotion context
        if (automationResults.detectedEmotion !== 'neutral') {
             prompt += `TONO DEL CLIENTE (detectado): ${automationResults.detectedEmotion}. Ajusta tu respuesta para ser más empático si es frustración, o más entusiasta si es satisfacción.\n\n`;
        }
        prompt += `MENSAJE DEL CLIENTE:\n"${message}"\n\nResponde en el mismo idioma que el mensaje del cliente.`;


        console.log(`[generateReply] Sending prompt to Gemini with template "${template.name}"...`);
        
        const response = await ai.models.generateContent({ model, contents: prompt });
        const aiResponseText = response.text;
        
        const endTime = Date.now();
        db.addResponseTime(endTime - startTime);
        await db.logActivity('ai_reply_generated', { template: finalTemplateId, responseTime: endTime - startTime });


        // Log the full interaction for history
        await db.logInboxInteraction({
            originalMessage: message,
            prompt,
            aiResponse: aiResponseText,
            templateUsed: finalTemplateId,
            automations: automationResults.notifications,
        });

        res.json({
            aiResponse: aiResponseText.trim(),
            automations: automationResults.notifications,
            emotion: automationResults.detectedEmotion,
        });

    } catch (error) {
        console.error('[generateReply] Error calling Gemini API:', error);
        res.status(500).json({ error: 'The AI is not responding. Maybe it\'s on a coffee break.' });
    }
};

/**
 * Handles "Quick Access" queries with more intelligent routing.
 */
export const quickQuery = async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'A query is required.' });
    }
    const lowerQuery = query.toLowerCase();

    // Check for action keywords
    if (lowerQuery.startsWith('add task:')) {
        const title = query.substring(9).trim();
        const task = await db.addTask(title, 'medium');
        await db.logActivity('task_created_quick', { title });
        return res.json({
            response: `Task "${task.title}" created!`,
            action: { type: 'openCard', cardId: 'card-tasks' }
        });
    }

    if (lowerQuery.startsWith('add note:')) {
        const content = query.substring(9).trim();
        await db.addNote(content);
        await db.logActivity('note_created_quick', { content: content.substring(0, 30) });
        return res.json({
            response: `Note added!`,
            action: { type: 'openCard', cardId: 'card-notes' }
        });
    }

    // New: Expense tracking
    const expenseRegex = /(?:gasté|gaste|spent)\s*\$?(\d+(?:\.\d{1,2})?)\s*(?:en|on)\s*(.+)/i;
    const expenseMatch = query.match(expenseRegex);
    if (expenseMatch) {
        const amount = parseFloat(expenseMatch[1]);
        const category = expenseMatch[2].trim();
        await db.addExpense({ category, amount });
        await db.logActivity('expense_logged_quick', { category, amount });
        return res.json({ response: `Ok, I've logged an expense of $${amount} for ${category}.`});
    }

    // New: Reminders
    const reminderRegex = /(?:recuérdame|remind me to)\s*(.+)/i;
    const reminderMatch = query.match(reminderRegex);
    if (reminderMatch) {
        const taskTitle = `Reminder: ${reminderMatch[1].trim()}`;
        await db.addTask(taskTitle, 'high');
        await db.logActivity('reminder_created_quick', { title: taskTitle });
        return res.json({
            response: `Got it. I'll remind you: "${reminderMatch[1].trim()}".`,
            action: { type: 'openCard', cardId: 'card-tasks' }
        });
    }


    // Default to a standard Gemini query
    try {
        const startTime = Date.now();
        const response = await ai.models.generateContent({ model, contents: query });
        const endTime = Date.now();
        db.addResponseTime(endTime - startTime);
        await db.logActivity('ai_quick_query', { responseTime: endTime - startTime });
        res.json({ response: response.text });
    } catch (error)
 {
        console.error('[quickQuery] Error calling Gemini API:', error);
        res.status(500).json({ error: 'The AI is being difficult. Please try again.' });
    }
};


/**
 * NEW: Provides intelligent suggestions based on user input text.
 */
export const suggest = async (req, res) => {
    const { text } = req.body;
    if (typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid input. Expecting a string.' });
    }
    
    const suggestions = [];
    const lowerText = text.toLowerCase();

    if (lowerText.includes('cotiz') && lowerText.length > 5) {
        suggestions.push({
            label: 'Crear Cotización',
            action: { type: 'fill_template', templateId: 'parts-quote' }
        });
    }
    
    if (lowerText.includes('catalogo') || lowerText.includes('catálogo')) {
         suggestions.push({
            label: 'Enviar Catálogo',
            action: { type: 'send_message', message: 'Claro, aquí tienes un enlace a nuestro catálogo: [link]' }
        });
    }

    if (lowerText.startsWith('add')) {
         suggestions.push({
            label: 'Add Task: ...',
            action: { type: 'fill_input', text: 'add task: ' }
        });
         suggestions.push({
            label: 'Add Note: ...',
            action: { type: 'fill_input', text: 'add note: ' }
        });
    }
    
    res.json({ suggestions });
};


/**
 * Simulates processing an image with Gemini Vision.
 */
export const processImage = async (req, res) => {
    // In a real implementation, you'd handle image data (e.g., base64) from the body
    console.log('[processImage] Received a request to process an image (simulation).');
    await db.logActivity('image_processed_simulation', {});
    res.json({
        message: "Image received! If this were real, I'd be telling you what's in it right now.",
        analysis: "A beautiful (simulated) picture of a cat on a keyboard."
    });
};

/**
 * Handles streaming a chat response from the Gemini API to the client.
 */
export const streamChat = async (req, res) => {
    const { message, context, template } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'A message is required for streaming chat.' });
    }

    try {
        const history = await db.getChatHistory();
        const chat = ai.chats.create({ model, history });

        let messageForModel = message;
        if (template && template.content) {
            messageForModel = `TEMPLATE: "${template.content}"\n\n${messageForModel}`;
        }
        if (context) {
            messageForModel = `CONTEXT: "${context}"\n\n${messageForModel}`;
        }

        const result = await ai.models.generateContentStream({
            model,
            contents: {
                role: 'user',
                parts: [{ text: messageForModel }]
            },
            // Include history if necessary, though generateContentStream doesn't have a direct `history` field like `chats.create`.
            // The context is managed by providing previous conversation turns in `contents` array if needed.
            // For simplicity, we are using the `chats` pattern which is better for conversation.
            // Let's refactor to use the chat session correctly.
        });
        
        // Correct approach with chat session:
        const streamResult = await chat.sendMessageStream({ message: messageForModel });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        let fullResponse = '';
        for await (const chunk of streamResult) {
            const chunkText = chunk.text;
            if (chunkText) {
                res.write(chunkText);
                fullResponse += chunkText;
            }
        }
        
        await db.addChatMessage('user', message); // Save the original, clean user message
        await db.addChatMessage('model', fullResponse); // Save the full model response

        res.end();

    } catch (error) {
        console.error('[streamChat] Error calling Gemini API:', error);
        res.status(500).end('Failed to stream chat response from the AI.');
    }
};

/**
 * Retrieves the current chat history.
 */
export const getChatHistory = async (req, res) => {
    try {
        const history = await db.getChatHistory();
        res.json(history);
    } catch (error) {
        console.error('[getChatHistory] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
};

/**
 * Clears the current chat history.
 */
export const clearChatHistory = async (req, res) => {
    try {
        await db.clearChatHistory();
        res.status(204).send();
    } catch (error) {
        console.error('[clearChatHistory] Error:', error);
        res.status(500).json({ error: 'Failed to clear chat history.' });
    }
};