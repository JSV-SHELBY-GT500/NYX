/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import {
    getAllExpenses,
    createExpense,
    getExpenseSummary,
} from '../controllers/expensesController.js';

const router = express.Router();

router.get('/', getAllExpenses);
router.post('/', createExpense);
router.get('/summary', getExpenseSummary);

export default router;
