import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY não definidas');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // sessionStorage em vez do padrão (localStorage): a sessão não sobrevive ao fechar a aba/navegador,
    // reduzindo a janela de exposição do token em um dispositivo compartilhado.
    storage: window.sessionStorage,
  },
});
