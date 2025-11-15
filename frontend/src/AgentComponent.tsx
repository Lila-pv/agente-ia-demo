import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; 
import type { Session } from '@supabase/supabase-js';

interface ConversationMessage {
  id: string;
  created_at: string;
  user_message: string;
  agent_response: string;
}

// URL de tu Edge Function
const FUNCTION_URL = "https://dnwtscjvppnhwzrkbzjo.supabase.co/functions/v1/process_message";

const AgentComponent: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const loadMessages = async () => {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (error) setError('Error cargando la conversación: ' + error.message);
    else setMessages(data || []);
  };

  useEffect(() => { if (session) loadMessages(); else setMessages([]); }, [session]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !inputMessage.trim()) return;
    const messageToSend = inputMessage.trim();
    const userId = session.user.id;
    
    setLoading(true); setError(null); setInputMessage('');
    
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        // Envío de campos sincronizados con la Edge Function
        body: JSON.stringify({ 
             user_message: messageToSend, 
             user_id: userId 
          })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error desconocido del agente.');
      }

      await loadMessages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ... (Renderizado de UI)
  if (!session) return (
    <div>
      <h2>Agente de IA</h2>
      <p>Demostración de Full-Stack con Supabase y Edge Functions.</p>
      <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
          Iniciar sesión con Google
      </button>
    </div>
  );

  return (
    <div>
        <h2>Agente de IA (Sesión: {session.user.email})</h2>
        <button onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button>
      <hr style={{margin: '15px 0'}}/>
      <div style={{height: '300px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px'}}>
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            <div><strong>Tú:</strong> {m.user_message}</div>
            <div><strong>Agente:</strong> {m.agent_response}</div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} style={{ marginTop: '20px' }}>
        <input 
            value={inputMessage} 
            onChange={e => setInputMessage(e.target.value)} 
            placeholder="Comienza tu conversación..." 
            disabled={loading}
            style={{ padding: '8px', width: '70%' }}
        />
        <button type="submit" disabled={loading || inputMessage.trim().length === 0} style={{ padding: '8px 15px', marginLeft: '10px' }}>
            {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <div style={{color:'red', marginTop: '10px'}}>Error: {error}</div>}
    </div>
  );
};

export default AgentComponent;