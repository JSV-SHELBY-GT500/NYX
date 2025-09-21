import React, { useState, useEffect, useRef } from 'react';

// Un simple componente de notificación (toast)
const Toast = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`toast toast-${type}`}>
            {message}
            <button onClick={onDismiss}>&times;</button>
        </div>
    );
};

const ConfirmationToast = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="toast toast-confirmation">
            <span>{message}</span>
            <div className="toast-actions">
                <button onClick={onConfirm} className="confirm-btn">Confirmar</button>
                <button onClick={onCancel} className="cancel-btn">Cancelar</button>
            </div>
        </div>
    );
};

const AnalysisResult = ({ data }) => {
    return (
        <div className="analysis-result-card">
            <h4>Análisis de Imagen Completado</h4>
            <ul>
                {Object.entries(data).map(([key, value]) => (
                    <li key={key}>
                        <strong>{key.replace(/_/g, ' ')}:</strong> {String(value)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const QuoteCard = ({ data }) => {
    return (
        <div className="analysis-result-card">
            <h4>Cotización Generada</h4>
            <ul>
                <li><strong>Pieza:</strong> {data.partName}</li>
                <li><strong>Cantidad:</strong> {data.quantity}</li>
                <li><strong>Precio Unitario:</strong> ${data.price}</li>
                <li><strong>Total:</strong> ${data.total}</li>
            </ul>
        </div>
    );
};


const Chat = ({ userId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [notification, setNotification] = useState(null);
    const socket = useRef(null);
    const [quoteToConfirm, setQuoteToConfirm] = useState(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // 1. Conexión WebSocket desde el frontend
        const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080';
        console.log(`Connecting WebSocket to: ${wsUrl}`);
        socket.current = new WebSocket(wsUrl);

        socket.current.onopen = () => {
            console.log('WebSocket conectado.');
            setIsConnected(true);
            // 1. Memoria de Conversación: Solicitar historial al conectar
            if (userId) {
                socket.current.send(JSON.stringify({
                    event: 'request-history',
                    payload: { userId }
                }));
            }
        };
        
        socket.current.onclose = () => {
            console.log('WebSocket desconectado.');
            setIsConnected(false);
        };

        // 3. Frontend basado en eventos
        socket.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.event) {
                // 4. Streaming de Respuestas
                case 'chat-stream-chunk':
                    setMessages(prev => {
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage && lastMessage.sender === 'ai' && lastMessage.type !== 'analysis') {
                            const updatedMessages = [...prev];
                            updatedMessages[prev.length - 1] = {
                                ...lastMessage,
                                text: lastMessage.text + data.payload
                            };
                            return updatedMessages;
                        }
                        return prev;
                    });
                    break;

                case 'chat-stream-end':
                    setHistory(data.payload.history);
                    break;

                // 5. Notificaciones en Tiempo Real
                case 'notification':
                    setNotification(data.payload);
                    break;

                case 'error':
                    setNotification({ type: 'error', message: data.payload });
                    break;

                case 'image-analysis-result':
                    setMessages(prev => [...prev, { sender: 'ai', type: 'analysis', data: data.payload, id: Date.now() }]);
                    break;
                
                case 'quote-generated':
                    // Render a card with the quote details
                    setMessages(prev => [...prev, { sender: 'ai', type: 'quote', data: data.payload.data, id: Date.now() }]);
                    setQuoteToConfirm(data.payload);
                    break;
                
                case 'development-request-received':
                    // 5. Notificación de Estado de Petición
                    setNotification(data.payload);
                    break;

                case 'history-loaded':
                    const formattedMessages = data.payload.history.map(msg => {
                        const textContent = msg.content?.find(p => p.type === 'text')?.text || '';
                        const analysisContent = msg.content?.find(p => p.type === 'image-analysis-result')?.payload;

                        if (analysisContent) {
                            return { sender: 'ai', type: 'analysis', data: analysisContent, id: msg.id };
                        }

                        return {
                            sender: msg.role === 'user' ? 'user' : 'ai',
                            text: textContent,
                            type: 'text',
                            id: msg.id
                        };
                    }).filter(msg => msg.text || msg.type === 'analysis');
                    setMessages(formattedMessages);
                    setHistory(data.payload.rawHistory);
                    break;
            }
        };

        return () => {
            socket.current.close();
        };
    }, [userId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleConfirmQuote = (quoteId) => {
        socket.current.send(JSON.stringify({
            event: 'send-confirmed-quote',
            payload: { quoteId, userId }
        }));
        // Hide the confirmation toast
        setQuoteToConfirm(null);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const imageData = reader.result;
            const userMessage = { sender: 'user', text: `Analiza esta imagen: ${file.name}`, type: 'text', id: Date.now() };
            const aiPlaceholder = { sender: 'ai', text: '', type: 'text', id: Date.now() + 1 };
            setMessages(prev => [...prev, userMessage, aiPlaceholder]);

            socket.current.send(JSON.stringify({
                event: 'chat-message',
                payload: {
                    message: `Analiza la imagen que acabo de subir.`,
                    userId,
                    history,
                    imageData,
                }
            }));
        };
        // Reset file input
        e.target.value = null;
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!input.trim() || !socket.current || socket.current.readyState !== WebSocket.OPEN) return;

        const userMessage = { sender: 'user', text: input, type: 'text', id: Date.now() };
        const aiPlaceholder = { sender: 'ai', text: '', type: 'text', id: Date.now() + 1 };
        setMessages(prev => [...prev, userMessage, aiPlaceholder]);

        socket.current.send(JSON.stringify({
            event: 'chat-message',
            payload: {
                message: input,
                userId,
                history
            }
        }));
        setInput('');
    };

    return (
        <div className="chat-container">
            {notification && (
                <Toast
                    message={notification.message}
                    type={notification.type}
                    onDismiss={() => setNotification(null)}
                />
            )}
            {quoteToConfirm && (
                <ConfirmationToast
                    message={`¿Enviar cotización para ${quoteToConfirm.data.partName}?`}
                    onConfirm={() => handleConfirmQuote(quoteToConfirm.quoteId)}
                    onCancel={() => setQuoteToConfirm(null)}
                />
            )}
            <div className="chat-header">
                <h2>Nyx v3.0 Chat</h2>
                <span className={`connection-status ${isConnected ? 'connected' : ''}`}>
                    {isConnected ? '● Conectado' : '○ Desconectado'}
                </span>
            </div>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    (() => {
                        switch (msg.type) {
                            case 'analysis': return <AnalysisResult key={msg.id || index} data={msg.data} />;
                            case 'quote': return <QuoteCard key={msg.id || index} data={msg.data} />;
                            default: return (
                                <div key={msg.id || index} className={`message ${msg.sender}`}><p>{msg.text}</p></div>
                            );
                        }
                    })()
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Habla con Nyx..."
                    disabled={!isConnected}
                />
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                <button type="button" className="attach-button" onClick={() => fileInputRef.current.click()} disabled={!isConnected}>
                    📎
                </button>
                <button type="submit" disabled={!isConnected || !input.trim()}>Enviar</button>
            </form>
        </div>
    );
};

export default Chat;