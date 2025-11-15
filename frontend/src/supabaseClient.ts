import { createClient } from '@supabase/supabase-js';

// Lectura de variables de entorno públicas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Las claves de Supabase no están configuradas en el entorno.");
}

// Inicialización del cliente público (para el navegador)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);