// Código Corregido para supabase/functions/process_message/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2.44.0';
import { Application, Router } from 'https://deno.land/x/oak@v12.6.1/mod.ts';

// 1. Tipado de Request/Response
interface MessagePayload {
  user_message: string;
}

// 2. Setup del cliente Supabase para Service Role
// --- VERIFICACIÓN DE VARIABLES CRÍTICAS ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error("ERROR: Faltan variables de entorno críticas (URL, SERVICE_ROLE_KEY o OPENAI_API_KEY).");
    // Aunque no podemos detener el worker de Deno.serve aquí,
    // el router puede manejar la falta de las variables.
}

// Inicialización del cliente de Supabase (solo si las claves existen)
const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY 
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    })
    : null; // Si falta alguna clave, el cliente será nulo.


// 3. Router y Lógica de la Edge Function
const router = new Router();

router.post('/', async (ctx) => {
  try {
    // Verificar si la inicialización de claves falló al inicio
    if (!supabaseAdmin || !OPENAI_API_KEY) {
        ctx.response.status = 500;
        return ctx.response.body = { error: 'Error interno: La función no se inicializó correctamente (variables faltantes).' };
    }

    // --- SEGURIDAD: 3.1. Verificar Token JWT ---
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.response.status = 401;
      return ctx.response.body = { error: 'No autorizado: JWT no proporcionado.' };
    }
    const token = authHeader.substring(7);

    // Obtener el ID del usuario del token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Error de autenticación:', authError?.message || 'Usuario no encontrado');
      ctx.response.status = 401;
      return ctx.response.body = { error: 'Token inválido o usuario no autenticado.' };
    }
    const user_id = user.id;

    // --- LÓGICA DE NEGOCIO: 3.2. Procesar Mensaje ---
    const payload = await ctx.request.body({ type: 'json' }).value as MessagePayload;
    const userMessage = payload.user_message;

    if (!userMessage) {
      ctx.response.status = 400;
      return ctx.response.body = { error: 'Mensaje de usuario requerido.' };
    }

    // --- INTEGRACIÓN LLM: 3.3. Llamada a la IA (OpenAI) ---
    // Usamos la variable OPENAI_API_KEY ya verificada y no el Deno.env.get() de nuevo.
    
    // Prompt de sistema para darle un rol al agente
    const systemPrompt = "Eres un agente de soporte de IA experto y amigable que responde preguntas de forma concisa y profesional.";
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ✅ Usamos la clave ya verificada
        'Authorization': `Bearer ${OPENAI_API_KEY}`, 
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
      }),
    });

    // --- MANEJO DE ERROR DE RESPUESTA DE OPENAI ---
    if (!response.ok) {
        const errorData = await response.json();
        console.error('Error de OpenAI:', errorData);
        ctx.response.status = response.status;
        return ctx.response.body = { 
            error: `Error de la IA: ${errorData.error?.message || 'Error desconocido.'}` 
        };
    }
    
    const data = await response.json();
    const agentResponse = data.choices?.[0]?.message.content || 'Error: No pude obtener una respuesta de la IA.';
    
    // --- ESCRITURA EN DB: 3.4. Guardar la conversación ---
    const { error: dbError } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: user_id,
        user_message: userMessage,
        agent_response: agentResponse,
      });

    if (dbError) {
      console.error('Error al guardar en DB:', dbError.message);
      ctx.response.status = 500;
      return ctx.response.body = { error: 'Error interno al guardar la conversación.' };
    }

    // --- 3.5. Respuesta Final ---
    ctx.response.body = { agent_response: agentResponse };

  } catch (error) {
    console.error('Error general en la función:', error.message);
    ctx.response.status = 500;
    ctx.response.body = { error: 'Error interno del servidor.' };
  }
});

// 4. Montar la aplicación Oak (necesario para Edge Functions complejas)
const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

Deno.serve(app.fetch);