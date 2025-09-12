/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches all notes.
 */
export const getAllNotes = async (req, res) => {
    try {
        const notes = await db.getNotes();
        res.json(notes);
    } catch (error) {
        console.error('[getAllNotes] Error:', error);
        res.status(500).json({ error: 'Failed to fetch notes. The digital ink has run dry.' });
    }
};

/**
 * Creates a new note.
 */
export const createNote = async (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Note content cannot be empty. What am I, a psychic?' });
    }
    try {
        const newNote = await db.addNote(content);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('[createNote] Error:', error);
        res.status(500).json({ error: 'Failed to create note. The paper is probably jammed.' });
    }
};
