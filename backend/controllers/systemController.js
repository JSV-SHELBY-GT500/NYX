/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches system status metrics. A little health check for the mothership.
 */
export const getSystemStatus = async (req, res) => {
    try {
        const status = await db.getSystemStatus();
        res.json(status);
    } catch (error) {
        console.error('[getSystemStatus] Error:', error);
        res.status(500).json({ error: 'Failed to get system status. The sensors are offline.' });
    }
};
