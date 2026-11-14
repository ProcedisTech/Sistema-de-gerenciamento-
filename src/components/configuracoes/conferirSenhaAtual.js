import { supabase } from "../../lib/supabaseClient";

// Mesma conferência do inativar (EquipePessoaView), mas sem a brecha: sem sessão, a ação é recusada.
// 'ok' | 'errada' | 'indisponivel' (sem supabase, sem sessão, sem e-mail ou falha ao conferir).
export async function conferirSenha(senha) {
  try {
    if (!supabase?.auth) return "indisponivel";
    const { data } = await supabase.auth.getSession();
    const email = data?.session?.user?.email;
    if (!email) return "indisponivel";
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    return error ? "errada" : "ok";
  } catch {
    return "indisponivel";
  }
}

export async function conferirSenhaAtual(senha) {
  return (await conferirSenha(senha)) === "ok";
}
