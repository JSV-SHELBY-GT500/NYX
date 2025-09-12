/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as db from '../database.js';

/**
 * Fetches the list of all tasks.
 */
export const getAllTasks = async (req, res) => {
    try {
        const tasks = await db.getTasks();
        res.json(tasks);
    } catch (error) {
        console.error('[getAllTasks] Error:', error);
        res.status(500).json({ error: 'Could not fetch tasks. They might be on strike.' });
    }
};

/**
 * Creates a new task.
 */
export const createTask = async (req, res) => {
    const { title, priority } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Task title is required. I can\'t just guess what you want to do.' });
    }
    try {
        const newTask = await db.addTask(title, priority);
        if (newTask) {
            res.status(201).json(newTask);
        } else {
            res.status(409).json({ error: 'A task with that title already exists.' });
        }
    } catch (error) {
        console.error('[createTask] Error:', error);
        res.status(500).json({ error: 'Failed to create task. The to-do list is full.' });
    }
};

/**
 * Updates a task, primarily for toggling completion.
 */
export const updateTask = async (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'The "completed" field must be a boolean. No maybes.' });
    }
    try {
        const updatedTask = await db.updateTask(Number(id), completed);
        if (updatedTask) {
            res.json(updatedTask);
        } else {
            res.status(404).json({ error: 'Task not found. It probably completed itself and left.' });
        }
    } catch (error) {
        console.error('[updateTask] Error:', error);
        res.status(500).json({ error: 'Failed to update task.' });
    }
};

/**
 * Deletes a task. Poof. Gone.
 */
export const deleteTask = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.deleteTask(Number(id));
        if (result) {
            res.status(204).send(); // No Content
        } else {
            res.status(404).json({ error: 'Task not found. Are you sure it ever existed?' });
        }
    } catch (error) {
        console.error('[deleteTask] Error:', error);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
};
