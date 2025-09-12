/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches all expenses.
 */
export const getAllExpenses = async (req, res) => {
    try {
        const expenses = await db.getExpenses();
        res.json(expenses);
    } catch (error) {
        console.error('[getAllExpenses] Error:', error);
        res.status(500).json({ error: 'Failed to fetch expenses. The accountant is out.' });
    }
};

/**
 * Creates a new expense.
 */
export const createExpense = async (req, res) => {
    const { category, amount } = req.body;
    if (!category || typeof amount !== 'number') {
        return res.status(400).json({ error: 'A category and a numeric amount are required. I\'m an AI, not a miracle worker.' });
    }
    try {
        const newExpense = await db.addExpense({ category, amount });
        res.status(201).json(newExpense);
    } catch (error) {
        console.error('[createExpense] Error:', error);
        res.status(500).json({ error: 'Failed to create expense. The transaction was declined.' });
    }
};

/**
 * Fetches a summary of expenses by category.
 */
export const getExpenseSummary = async (req, res) => {
     try {
        const summary = await db.getExpenseSummary();
        res.json(summary);
    } catch (error) {
        console.error('[getExpenseSummary] Error:', error);
        res.status(500).json({ error: 'Failed to generate expense summary.' });
    }
};
