import React, { useState, useEffect } from 'react';

const Notes = ({ userId }) => {
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newNoteContent, setNewNoteContent] = useState('');

    useEffect(() => {
        if (userId) fetchNotes();
    }, [userId]);

    const fetchNotes = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8080/api/notes?userId=${userId}`);
            const data = await response.json();
            setNotes(data);
        } catch (error) {
            console.error("Failed to fetch notes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNoteContent.trim()) return;

        try {
            await fetch('http://localhost:8080/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newNoteContent, userId }),
            });
            setNewNoteContent('');
            fetchNotes();
        } catch (error) {
            console.error("Failed to add note:", error);
        }
    };

    return (
        <div className="card-content" id="notes-content">
            <ul className="notes-list-container" id="notes-list">
                {isLoading ? (
                    <li className="no-notes-message">Loading notes...</li>
                ) : notes.length === 0 ? (
                    <li className="no-notes-message">No notes yet. Add one below.</li>
                ) : (
                    notes.map(note => (
                        <li key={note.id} className="note-item">
                            {note.content}
                        </li>
                    ))
                )}
            </ul>
            <form className="note-add-form" onSubmit={handleAddNote}>
                <textarea id="note-content-input" placeholder="Jot something down..." value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} required></textarea>
                <button type="submit">Save Note</button>
            </form>
        </div>
    );
};

export default Notes;