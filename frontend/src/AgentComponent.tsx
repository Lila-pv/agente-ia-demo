import React, { useState, useEffect } from 'react';
// Importamos supabase.supabaseUrl, aunque ya no la usaremos directamente para la URL
import { supabase } from './supabaseClient'; 
import type { Session } from '@supabase/supabase-js';

interface ConversationMessage {
  id: string;
  created_at: string;
  user_message: string;
  agent_response: string;
}

const AgentComponent: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ CORRECCIÓN FINAL: Usamos la URL literal y absoluta de tu proyecto.
  const FUNCTION_URL = "https://dnwtscjvppnhwzrkbzjo.supabase.co/functions/v1/process_message";


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [session]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      // Ordenamos por fecha descendente (más reciente primero)
      .order('created_at', { ascending: false }); 

    if (error) {
      console.error('Error cargando mensajes:', error);
      setError('Error al cargar la conversación.');
    } else {
      setMessages(data || []);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !inputMessage.trim()) return;

    const messageToSend = inputMessage.trim();
    
    setLoading(true);
    setError(null);
    setInputMessage(''); // Limpiar el input

    try {
      // Intentamos la comunicación con la URL literal
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_message: messageToSend }),
      });

      // Si hay error en la red (Failed to fetch), se captura aquí
      const data = await response.json();

      if (!response.ok) {
        // Manejamos errores del backend (Edge Function: WORKER_ERROR)
        const errorMessage = data.msg || data.error || 'Error desconocido al procesar el mensaje en la IA.';
        throw new Error(errorMessage);
      }

      // La Edge Function fue exitosa, recargamos los mensajes para mostrar la respuesta
      await loadMessages(); 

    } catch (err: any) {
      // Si falla, mostramos el error
      // Si el error es "Failed to fetch", es un problema de URL/conexión.
      setError(err.message);
      console.error('Error en la llamada a la Edge Function:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white shadow-xl rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Inicia Sesión para usar el Agente de IA</h2>
        <button
          onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Iniciar Sesión con Google
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto bg-gray-50 shadow-2xl rounded-xl flex flex-col h-[80vh]">
      <h2 className="text-3xl font-extrabold text-blue-700 mb-4">Agente de IA Seguro</h2>
      <button 
        onClick={() => supabase.auth.signOut()}
        className="text-sm text-red-500 hover:underline mb-4 self-start"
      >
        Cerrar Sesión
      </button>

      {/* Usamos flex-col-reverse para que el scroll empiece desde abajo */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-lg bg-white mb-4 flex flex-col-reverse">
        {messages.length === 0 && !loading && (
            <p className="text-gray-500 italic">Comienza tu conversación...</p>
        )}
        {/* Mapeamos los mensajes, y dado que están ordenados de más nuevo a más viejo, 
            usamos el Fragment para asegurar el orden correcto en el stack invertido */}
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            <div className="flex justify-start">
              <div className="bg-green-100 text-gray-800 p-3 rounded-xl max-w-[80%] shadow-md">
                <strong className='text-xs text-green-700'>Agente:</strong> {msg.agent_response}
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-blue-100 text-gray-800 p-3 rounded-xl max-w-[80%] shadow-md">
                <strong className='text-xs'>Tú:</strong> {msg.user_message}
              </div>
            </div>
          </React.Fragment>
        ))}
        {loading && <p className="text-center text-gray-400">Generando respuesta...</p>}
        {error && <p className="text-red-500 border border-red-300 p-2 rounded">Error: {error}</p>}
      </div>

      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={loading}
          className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={loading || !inputMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-r-lg disabled:bg-blue-300"
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
};

export default AgentComponent;