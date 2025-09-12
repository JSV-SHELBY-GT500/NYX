/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches the recent activity log.
 */
export const getActivityLog = async (req, res) => {
    try {
        const log = await db.getActivityLog();
        res.json(log);
    } catch (error) {
        console.error('[getActivityLog] Error:', error);
        res.status(500).json({ error: 'Failed to fetch activity log. The historian is on vacation.' });
    }
};
