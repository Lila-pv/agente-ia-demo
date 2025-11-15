import { createClient } from 'npm:@supabase/supabase-js@2.44.0'; // CORRECCIÓN: Estaba mal tipado, ahora es 'npm:'
import { Application, Router } from 'https://deno.land/x/oak@v12.6.1/mod.ts';

// 1. Configuración de Supabase Admin y CORS
// ---------------------------------------------------------------------

// URL de tu Vercel (para CORS)
const VERCEL_ORIGIN = 'https://agente-ia-demo-tfv0u8d75-lilas-projects-d4fef991.vercel.app'; 

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// Lee el secreto SERVICE_ROLE_KEY
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY'); 

// Cliente Admin (para escribir en la DB ignorando RLS)
// @ts-ignore
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const router = new Router();
const app = new Application();

// Middleware CORS
app.use(async (ctx, next) => {
    ctx.response.headers.set('Access-Control-Allow-Origin', VERCEL_ORIGIN);
    ctx.response.headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    ctx.response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (ctx.request.method === 'OPTIONS') { ctx.response.status = 204; return; }
    await next();
});


// 2. RUTA PRINCIPAL POST (Lógica de Negocio y LLM)
// ---------------------------------------------------------------------
router.post('/process_message', async (ctx) => {
    let user_id; 

    try {
        // Obtener el mensaje y el ID de usuario del cuerpo JSON
        const payload = await ctx.request.body({ type: 'json' }).value;
        const userMessage = payload.user_message;
        const userIdFromFrontend = payload.user_id; 

        if (!userMessage || !userIdFromFrontend) {
            ctx.response.status = 400;
            return ctx.response.body = { error: 'Mensaje y user_id son requeridos.' };
        }
        user_id = userIdFromFrontend; 

        // --- LLAMADA A HUGGING FACE (Usando el Secreto) ---
        // Lee el token del secreto 'OPENAI_API_KEY'
        const HF_TOKEN = Deno.env.get('OPENAI_API_KEY'); 
        
        if (!HF_TOKEN) {
            ctx.response.status = 500;
            return ctx.response.body = { error: 'Token de IA no configurado en Supabase Secrets.' };
        }
        
        // MODELO CORREGIDO para evitar timeouts
        const HF_MODEL = "google/gemma-2b"; 
        const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

        const systemPrompt = "Eres un asistente de IA experto y conciso en el contexto de Lead Developer Full-Stack.";
        const fullPrompt = `Instrucciones: ${systemPrompt} \n\nUsuario: ${userMessage}`;

        const response = await fetch(HF_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}` 
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                options: { wait_for_model: true } 
            })
        });

        if (!response.ok) {
            const status = response.status;
            const errorBody = await response.text(); 
            console.error(`Error de Hugging Face: HTTP ${status}`, errorBody);
            ctx.response.status = 503; 
            return ctx.response.body = { error: `Error con la IA (HTTP ${status}). Revisa el token o el modelo.` };
        }

        const data = await response.json();
        const agentResponse = data?.[0]?.generated_text || 'Error: No pude obtener una respuesta de la IA.';
        
        // Limpieza de la respuesta del LLM
        const cleanedResponse = agentResponse.split("Usuario:")[0].trim();
        const finalResponse = cleanedResponse.replace(`Instrucciones: ${systemPrompt}`, "").trim();

        // --- ESCRITURA EN DB (Usando Cliente Admin con el ID real) ---
        const { error: dbError } = await supabaseAdmin.from('conversations').insert({
            user_id: user_id, 
            user_message: userMessage,
            agent_response: finalResponse
        });

        if (dbError) {
            console.error('Error al guardar en DB:', dbError.message);
            ctx.response.status = 500;
            return ctx.response.body = { error: 'Error interno al guardar la conversación.' };
        }

        // --- Respuesta Final al Frontend ---
        ctx.response.body = { agent_response: finalResponse };

    } catch (error) {
        console.error('Error general en la función:', error.message);
        ctx.response.status = 500;
        ctx.response.body = { error: `Error interno del servidor: ${error.message}` };
    }
});

// 3. Exportar el Handler de Oak
// ---------------------------------------------------------------------
app.use(router.routes());
app.use(router.allowedMethods());

// @ts-ignore
export default app.listen;