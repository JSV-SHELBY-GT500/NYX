/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import * as db from '../database.js';
import {
    handleWebhook,
    generateReply,
    quickQuery,
    processImage,
    suggest,
    streamChat,
    getChatHistory,
    clearChatHistory,
} from '../controllers/apiController.js';
import { getSystemStatus } from '../controllers/systemController.js';
import taskRoutes from './tasks.js';
import noteRoutes from './notes.js';
// New imports for Phase 3
import widgetRoutes from './widgets.js';
import expenseRoutes from './expenses.js';
import activityLogRoutes from './activityLog.js';


const router = express.Router();

// --- Modular Routes ---
router.use('/tasks', taskRoutes);
router.use('/notes', noteRoutes);
router.use('/widgets', widgetRoutes);
router.use('/expenses', expenseRoutes);
router.use('/activity-log', activityLogRoutes);


// --- Main Chat & Automation Routes ---
router.post('/webhook', handleWebhook);
router.post('/generate-reply', generateReply);
router.post('/quick-query', quickQuery);
router.post('/chat/suggest', suggest);

// --- New Chat Routes ---
router.post('/chat/stream', streamChat);
router.get('/chat/history', getChatHistory);
router.delete('/chat/history', clearChatHistory);


// --- System & Other Routes ---
router.get('/system-status', getSystemStatus);
router.post('/process-image', processImage); // Simulated Gemini Vision endpoint

// --- Inbox Message Management Routes ---
router.get('/messages', async (req, res) => {
    try {
        const messages = await db.getMessages();
        res.json(messages);
    } catch (e) {
        console.error('[GET /messages] Error:', e);
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
});

router.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.deleteMessage(Number(id));
        if (result) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: `Message with id ${id} not found.` });
        }
    } catch(e) {
        console.error(`[DELETE /messages/${id}] Error:`, e);
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});


export default router;