import { createClient } from '@supabase/supabase-js';

// ✅ Exportamos la URL para usarla en AgentComponent.tsx
export const supabaseUrl = 'https://dnwtscjvppnhwzrkbzjo.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRud3RzY2p2cHBuaHd6cmtiempvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDM4MDgsImV4cCI6MjA3ODQ3OTgwOH0.laRv4JiKfYHB9tNTg3AAk_k1KvxGKkBrlxHQvTznKao'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);