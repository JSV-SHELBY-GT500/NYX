import React, { useState, useEffect } from 'react';

const Tasks = ({ userId }) => {
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newPriority, setNewPriority] = useState('medium');

    useEffect(() => {
        if (userId) fetchTasks();
    }, [userId]);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8080/api/tasks?userId=${userId}`);
            const data = await response.json();
            setTasks(data);
        } catch (error) {
            console.error("Failed to fetch tasks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            await fetch('http://localhost:8080/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTaskTitle, priority: newPriority, userId }),
            });
            setNewTaskTitle('');
            fetchTasks();
        } catch (error) {
            console.error("Failed to add task:", error);
        }
    };

    const handleToggleTask = async (id, completed) => {
        try {
            await fetch(`http://localhost:8080/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            });
            fetchTasks();
        } catch (error) {
            console.error("Failed to toggle task:", error);
        }
    };

    return (
        <div className="card-content" id="tasks-content">
            <ul className="task-list-container" id="task-list">
                {isLoading ? (
                    <li className="no-tasks-message">Loading tasks...</li>
                ) : tasks.length === 0 ? (
                    <li className="no-tasks-message">No tasks yet. Add one below!</li>
                ) : (
                    tasks.map(task => (
                        <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`} data-priority={task.priority}>
                            <input type="checkbox" className="task-checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id, !task.completed)} />
                            <span className="task-title">{task.title}</span>
                        </li>
                    ))
                )}
            </ul>
            <form className="task-add-form" onSubmit={handleAddTask}>
                <input type="text" id="task-title-input" placeholder="Add a new task..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} required />
                <select id="task-priority-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <button type="submit">Add</button>
            </form>
        </div>
    );
};

export default Tasks;