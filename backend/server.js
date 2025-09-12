/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

// Load environment variables. The AI's secret fuel.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Standard middleware. Gotta have these.
app.use(cors());
app.use(express.json());

// Main application routes
app.use('/api', apiRoutes);
console.log('[Nyx Backend] Modular API routes initialized under /api.');

// A little health check endpoint. If you see this, I'm alive.
app.get('/', (req, res) => {
    res.send('Nyx Backend Online. Ready for some automation.');
});

app.listen(PORT, () => {
    console.log(`[Nyx Backend] Waking up... Listening on port ${PORT}.`);
    console.log('[Nyx Backend] Let\'s automate the boring stuff.');
});
