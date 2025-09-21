/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { db } from '../config/firebase.js';

const notesRef = db.collection('notes');

/**
 * Fetches all notes for a given user.
 */
export const getAllNotes = async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }
    try {
        const snapshot = await notesRef.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
        const notes = [];
        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() });
        });
        res.json(notes);
    } catch (error) {
        console.error('[getAllNotes] Error:', error);
        res.status(500).json({ error: 'Failed to fetch notes. The digital ink has run dry.' });
    }
};

/**
 * Creates a new note in Firestore.
 */
export const createNote = async (req, res) => {
    const { content, userId } = req.body;
    if (!content || !userId) {
        return res.status(400).json({ error: 'Note content and user ID cannot be empty. What am I, a psychic?' });
    }
    try {
        const newNote = { content, createdAt: new Date(), userId };
        const docRef = await notesRef.add(newNote);
        res.status(201).json({ id: docRef.id, ...newNote });
    } catch (error) {
        console.error('[createNote] Error:', error);
        res.status(500).json({ error: 'Failed to create note. The paper is probably jammed.' });
    }
};