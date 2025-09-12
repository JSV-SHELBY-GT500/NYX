/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import { getWidgets } from '../controllers/widgetsController.js';

const router = express.Router();

// GET /api/widgets - Fetches the data for dynamic UI widgets
router.get('/', getWidgets);

export default router;
