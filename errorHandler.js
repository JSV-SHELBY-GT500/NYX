/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized error handler for Express.
 * Catches errors from async routes and sends a structured 500 response.
 */
export const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    // Avoid sending detailed errors in production for security reasons.
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred on the server.'
        : err.message;

    res.status(500).json({ error: 'Internal Server Error', message });
};