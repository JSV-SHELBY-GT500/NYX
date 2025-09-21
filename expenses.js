/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import {
    createExpense,
} from '../controllers/expensesController.js';

const router = express.Router();

router.post('/', createExpense);

export default router;