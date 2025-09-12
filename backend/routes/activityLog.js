/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import { getActivityLog } from '../controllers/activityLogController.js';

const router = express.Router();

// GET /api/activity-log - Fetches the recent activity log
router.get('/', getActivityLog);

export default router;
