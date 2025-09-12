/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches data for all dynamic widgets.
 */
export const getWidgets = async (req, res) => {
    try {
        const widgets = await db.getWidgets();
        res.json(widgets);
    } catch (error) {
        console.error('[getWidgets] Error:', error);
        res.status(500).json({ error: 'Failed to fetch widget data. The dashboard is blank.' });
    }
};
