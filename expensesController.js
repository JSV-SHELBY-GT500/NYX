/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { db } from '../config/firebase.js';

const expensesRef = db.collection('expenses');

/**
 * Creates a new expense in Firestore.
 */
export const createExpense = async (req, res) => {
    const { category, amount, userId } = req.body;
    if (!category || typeof amount !== 'number' || !userId) {
        return res.status(400).json({ error: 'A category, a numeric amount, and user ID are required.' });
    }
    try {
        const newExpense = { category, amount, timestamp: new Date(), userId };
        const docRef = await expensesRef.add(newExpense);
        res.status(201).json({ id: docRef.id, ...newExpense });
    } catch (error) {
        console.error('[createExpense] Error:', error);
        res.status(500).json({ error: 'Failed to create expense. The transaction was declined.' });
    }
};