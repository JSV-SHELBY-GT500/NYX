/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { db } from '../config/firebase.js';
import { validationResult } from 'express-validator';

// Get a reference to the 'tasks' collection
const tasksRef = db.collection('tasks');

/**
 * Fetches the list of all tasks from Firestore for a given user.
 */
export const getAllTasks = async (req, res, next) => {
    const { userId } = req.query;
    try {
        const snapshot = await tasksRef.where('userId', '==', userId).get();
        const tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        tasks.sort((a, b) => Number(a.completed) - Number(b.completed));
        res.json(tasks);
    } catch (error) {
        console.error('[getAllTasks] Error:', error);
        next(error);
    }
};

/**
 * Creates a new task in Firestore.
 */
export const createTask = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { title, priority, userId } = req.body;
    try {
        const newTask = { title, priority: priority || 'medium', completed: false, createdAt: new Date(), userId };
        const docRef = await tasksRef.add(newTask);
        res.status(201).json({ id: docRef.id, ...newTask });
    } catch (error) {
        console.error('[createTask] Error:', error);
        next(error);
    }
};

/**
 * Updates a task in Firestore, primarily for toggling completion.
 */
export const updateTask = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { completed } = req.body;
    try {
        const taskDoc = tasksRef.doc(id);
        await taskDoc.update({ completed });
        const updatedDoc = await taskDoc.get();
        if (updatedDoc.exists) {
            res.json({ id: updatedDoc.id, ...updatedDoc.data() });
        } else {
            res.status(404).json({ error: 'Task not found. It probably completed itself and left.' });
        }
    } catch (error) {
        console.error('[updateTask] Error:', error);
        next(error);
    }
};

/**
 * Deletes a task from Firestore. Poof. Gone.
 */
export const deleteTask = async (req, res, next) => {
    const { id } = req.params;
    try {
        await tasksRef.doc(id).delete();
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('[deleteTask] Error:', error);
        next(error);
    }
};