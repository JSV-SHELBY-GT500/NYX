/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- In-Memory Database Simulation ---
// In a real app, this would be a proper database (e.g., PostgreSQL, Firestore).
// For now, we're just keeping things in memory. Don't restart the server if you value your data.

const serverStartTime = Date.now();
const RESPONSE_TIME_LOG_LIMIT = 20;

const db = {
    messages: [
        { id: 1, text: 'Hola, tienen faros de led para un Jetta 2019?', source: 'webhook' }
    ],
    tasks: [
        { id: 1, title: 'Check stock for Jetta 2019 LED headlights', priority: 'high', completed: false },
        { id: 2, title: 'Follow up with customer about Mustang V8 engine', priority: 'medium', completed: false },
        { id: 3, title: 'Order more 4x4 suspension kits', priority: 'low', completed: true },
    ],
    notes: [
        { id: 1, content: 'Remember to check the new supplier catalog on Friday.' },
    ],
    expenses: [
        { id: 1, category: 'Gasolina', amount: 500, timestamp: new Date().toISOString() },
        { id: 2, category: 'Refacciones', amount: 1250, timestamp: new Date().toISOString() },
    ],
    inboxHistory: [],
    activityLog: [
        { id: 1, type: 'system_startup', details: {}, timestamp: new Date().toISOString() },
    ],
    chatHistory: [], // New: For storing conversation history
    stock: {
        'faros-led-jetta-2019': { stock: 5, name: 'Faros LED para Jetta 2019' },
        'motor-v8-mustang': { stock: 0, name: 'Motor V8 para Mustang' },
        'suspension-kit-4x4': { stock: 2, name: 'Kit de Suspensión 4x4' }
    },
    templates: {
        'default': { id: 'default', name: 'Respuesta General', content: 'Actúa como un asistente de ventas amigable y responde la pregunta del cliente de forma concisa.' },
        'parts-quote': { id: 'parts-quote', name: 'Cotización de Piezas', content: 'Actúa como un experto en autopartes. Proporciona una cotización detallada para la pieza solicitada, incluyendo disponibilidad y precio si es posible. Sé claro y profesional.' },
    },
    // For system monitoring
    geminiResponseTimes: [], // Stores last N response times in ms
};

let messageIdCounter = db.messages.length + 1;
let taskIdCounter = db.tasks.length + 1;
let noteIdCounter = db.notes.length + 1;
let expenseIdCounter = db.expenses.length + 1;
let historyIdCounter = 1;
let activityIdCounter = db.activityLog.length + 1;

// --- Database Access Functions ---

// Messages
export const getMessages = async () => db.messages;
export const addMessage = async (messageText, source) => {
    const newMessage = { id: messageIdCounter++, text: messageText, source };
    db.messages.push(newMessage);
    console.log(`[Database] Message added: ${newMessage.text}`);
    return newMessage;
};
export const deleteMessage = async (id) => {
    const index = db.messages.findIndex(m => m.id === id);
    if (index > -1) {
        db.messages.splice(index, 1);
        console.log(`[Database] Message ${id} deleted.`);
        return { success: true };
    }
    return null;
};


// Tasks
export const getTasks = async () => db.tasks;
export const addTask = async (title, priority = 'medium') => {
    if (db.tasks.some(task => task.title.toLowerCase() === title.toLowerCase())) {
        console.log(`[Database] Task already exists: "${title}"`);
        return null; // Return null to indicate duplication
    }
    const newTask = { id: taskIdCounter++, title, priority, completed: false };
    db.tasks.push(newTask);
    console.log(`[Database] Task added: ${newTask.title}`);
    return newTask;
};
export const updateTask = async (id, completed) => {
    const task = db.tasks.find(t => t.id === id);
    if (task) {
        task.completed = completed;
        console.log(`[Database] Task ${id} updated. Completed: ${completed}`);
        return task;
    }
    return null;
};
export const deleteTask = async (id) => {
    const index = db.tasks.findIndex(t => t.id === id);
    if (index > -1) {
        db.tasks.splice(index, 1);
        console.log(`[Database] Task ${id} deleted.`);
        return { success: true };
    }
    return null;
};

// Notes
export const getNotes = async () => db.notes;
export const addNote = async (content) => {
    const newNote = { id: noteIdCounter++, content };
    db.notes.push(newNote);
    console.log(`[Database] Note added.`);
    return newNote;
};

// Expenses
export const getExpenses = async () => db.expenses;
export const addExpense = async (expense) => {
    const newExpense = { id: expenseIdCounter++, ...expense, timestamp: new Date().toISOString() };
    db.expenses.push(newExpense);
    console.log(`[Database] Expense logged: ${expense.category} - ${expense.amount}`);
    return newExpense;
};


// History
export const logInboxInteraction = async (log) => {
    const newLog = { id: historyIdCounter++, ...log, timestamp: new Date().toISOString() };
    db.inboxHistory.push(newLog);
    console.log(`[Database] Logged inbox interaction for message: "${log.originalMessage}"`);
};
export const getInboxHistory = async () => db.inboxHistory;

// Chat History (New)
export const getChatHistory = async () => db.chatHistory;
export const addChatMessage = async (role, text) => {
    // Ensuring the message format matches what the Gemini API expects for history
    const message = { role, parts: [{ text }] };
    db.chatHistory.push(message);
    return message;
};
export const clearChatHistory = async () => {
    db.chatHistory = [];
    console.log('[Database] Chat history cleared.');
};


// Activity Log
export const logActivity = async (type, details) => {
    const newLogEntry = { id: activityIdCounter++, type, details, timestamp: new Date().toISOString() };
    db.activityLog.unshift(newLogEntry); // Add to the beginning
    if (db.activityLog.length > 50) { // Keep log from getting too big
        db.activityLog.pop();
    }
    console.log(`[Activity] Logged: ${type}`);
};
export const getActivityLog = async () => db.activityLog;


// Stock
export const findStockByKeywords = (text) => {
    const lowerText = text.toLowerCase();
    for (const key in db.stock) {
        const keywords = key.split('-').slice(0, -1);
        if (keywords.every(kw => lowerText.includes(kw))) {
            return db.stock[key];
        }
    }
    return null;
};

// Templates
export const getTemplateById = (id) => db.templates[id] || db.templates['default'];

// System & Widgets
export const addResponseTime = (timeInMs) => {
    db.geminiResponseTimes.push(timeInMs);
    if (db.geminiResponseTimes.length > RESPONSE_TIME_LOG_LIMIT) {
        db.geminiResponseTimes.shift(); // Keep only the last N times
    }
};

export const getSystemStatus = async () => {
    const uptimeSeconds = (Date.now() - serverStartTime) / 1000;
    const responseTimes = db.geminiResponseTimes;
    const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
        
    return {
        messagesPending: db.messages.length,
        tasksPending: db.tasks.filter(t => !t.completed).length,
        tasksCompleted: db.tasks.filter(t => t.completed).length,
        totalNotes: db.notes.length,
        inboxHistoryCount: db.inboxHistory.length,
        serverUptime: uptimeSeconds,
        avgGeminiResponseTime: Math.round(avgResponseTime),
    };
};

export const getWidgets = async () => {
    const status = await getSystemStatus();
    // In a real app, this could be configurable by the user
    return [
        { type: 'traffic-light', status: status.avgGeminiResponseTime < 1500 ? 'green' : (status.avgGeminiResponseTime < 3000 ? 'yellow' : 'red'), label: 'AI Latency' },
        { type: 'traffic-light', status: status.tasksPending < 5 ? 'green' : (status.tasksPending < 10 ? 'yellow' : 'red'), label: 'Pending Tasks' },
    ];
};

export const getExpenseSummary = async () => {
    const summary = db.expenses.reduce((acc, expense) => {
        if (!acc[expense.category]) {
            acc[expense.category] = 0;
        }
        acc[expense.category] += expense.amount;
        return acc;
    }, {});
    return Object.entries(summary).map(([category, total]) => ({ category, total }));
};