import React, { useState, useEffect } from 'react';
// CORRECCIÓN: Usar './' si supabaseClient.ts está en el mismo nivel
import { supabase } from './supabaseClient'; 
// Asegúrate de que AgentComponent.tsx también importe el CSS si es necesario
import './App.css'; 

interface Message {
    sender: 'user' | 'agent';
    text: string;
}

const AgentComponent: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // 1. Manejo de Autenticación
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_e, s: any) => {
            setUser(s?.user ?? null);
        });

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, []);

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({ provider: 'github' });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMessages([]);
    };

    // 2. Manejo de Envío de Mensajes
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user) return;

        const userMessage: Message = { sender: 'user', text: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Llama a la Edge Function
            const response = await fetch('https://dnwtscjvppnhwzrkbzjo.supabase.co/functions/v1/process_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.id}` 
                },
                body: JSON.stringify({
                    user_message: input.trim(),
                    user_id: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error desconocido del servidor.');
            }

            const agentMessage: Message = { sender: 'agent', text: data.agent_response || 'Error: No se recibió respuesta.' };
            setMessages(prev => [...prev, agentMessage]);

        } catch (error: any) {
            console.error("Error al procesar mensaje:", error);
            const errorMessage: Message = { sender: 'agent', text: `ERROR: ${error.message}` };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Estructura JSX con Clases de Diseño
    return (
        <div className="App">
            <header className="header">
                Agente de IA Seguro
            </header>

            {!user ? (
                <div className="auth-container">
                    <p>Inicia sesión para empezar a chatear.</p>
                    <button onClick={handleLogin} className="login-button">
                        Iniciar Sesión con GitHub
                    </button>
                </div>
            ) : (
                <>
                    <div className="message-list">
                        {messages.length === 0 && (
                            <div className="welcome-message">
                                ¡Hola! Soy tu Asistente de IA. Pregúntame sobre desarrollo Full-Stack.
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} className={msg.sender === 'user' ? 'user-message' : 'agent-message'}>
                                {msg.text}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="agent-message loading-message">
                                Generando respuesta...
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleSendMessage} className="input-container">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu mensaje..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}>
                            Enviar
                        </button>
                        <button type="button" onClick={handleLogout} className="logout-button">
                            Cerrar Sesión
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

export default AgentComponent;