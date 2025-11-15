import { createClient } from '@supabase/supabase-js';

// Las variables NEXT_PUBLIC_... son reconocidas por Vercel/Next.js
// y resuelven el problema del 'process' si tienes instalado @types/node
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Las variables de entorno de Supabase no están configuradas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);