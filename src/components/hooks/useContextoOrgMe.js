import { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { resolveApiUrl } from '../../config/apiEnv.js';
import { authHeadersForFetch } from '../../services/api.js';
import { resolverPapel } from '../../utils/authPayload';
import { FUSO_PADRAO } from '../../utils/datasClinica';

/** Tempo máximo de espera do GET /api/auth/me com X-Org-Id. */
export const TIMEOUT_ME_MS = 15000;
/** Tempo máximo em 'loading' sem /me em andamento antes de mostrar o erro com "Tentar de novo". */
export const LIMITE_CONTEXTO_SEM_ME_MS = 8000;

/**
 * Carrega o contexto da clínica ativa a partir do /me com X-Org-Id: permissões, papel e fuso.
 * Única fonte do fuso no app (não depende de permissão de clínica).
 * - Troca de clínica (orgId diferente): status 'loading' até o /me responder.
 * - Mesma clínica com `contextoNonce` novo (ex.: UF salva): recarrega sem voltar a 'loading'.
 */
export function useContextoOrgMe({ authReady, isLoggedIn }) {
  const {
    orgId,
    contextoNonce,
    contextStatus,
    setContextStatus,
    setRoleUserId,
    setRoleNome,
    setPapel,
    setPermissoes,
    setApareceNaAgenda,
    setFusoHorario,
  } = useOrg();
  const [meEmAndamento, setMeEmAndamento] = useState(false);
  const ultimoOrgCarregadoRef = useRef('');
  const statusRef = useRef(contextStatus);
  useEffect(() => {
    statusRef.current = contextStatus;
  }, [contextStatus]);

  useEffect(() => {
    if (!authReady || !isLoggedIn || !orgId) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_ME_MS);
    const recargaSilenciosa = ultimoOrgCarregadoRef.current === orgId && statusRef.current === 'ready';
    if (!recargaSilenciosa) setContextStatus('loading');
    setMeEmAndamento(true);
    (async () => {
      try {
        const response = await fetch(resolveApiUrl('/api/auth/me'), {
          credentials: 'include',
          headers: await authHeadersForFetch({ needsOrg: true }),
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!response.ok) throw new Error('Falha ao atualizar permissões da clínica');
        const me = await response.json();
        if (cancelled) return;
        if (me.organizacaoId !== orgId) throw new Error('Contexto de clínica inválido');
        let fuso = me.fusoHorario;
        if (typeof fuso !== 'string' || !fuso.trim()) {
          console.error('[useContextoOrgMe] /me sem fusoHorario; usando o fuso padrão');
          fuso = FUSO_PADRAO;
        }
        setRoleUserId(me.roleUserId ?? '');
        setRoleNome(me.perfilAcessoCodigo ?? me.role ?? '');
        setPapel(resolverPapel(me.perfilAcessoCodigo ?? me.role ?? ''));
        setPermissoes(me.permissoes || []);
        setApareceNaAgenda(me.apareceNaAgenda);
        setFusoHorario(fuso);
        ultimoOrgCarregadoRef.current = orgId;
        setContextStatus('ready');
      } catch {
        if (cancelled) return;
        if (recargaSilenciosa) return;
        setPermissoes([]);
        setApareceNaAgenda(null);
        setRoleUserId('');
        setPapel(null);
        setFusoHorario(null);
        setContextStatus('error');
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setMeEmAndamento(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
      setMeEmAndamento(false);
    };
  }, [authReady, isLoggedIn, orgId, contextoNonce,
    setRoleUserId, setRoleNome, setPapel, setPermissoes, setApareceNaAgenda, setFusoHorario, setContextStatus]);

  const aguardandoSemMe = Boolean(
    authReady && isLoggedIn && orgId && !meEmAndamento
      && (contextStatus === 'loading' || contextStatus === 'idle'),
  );

  useEffect(() => {
    if (!aguardandoSemMe) return undefined;
    const timer = setTimeout(() => setContextStatus('error'), LIMITE_CONTEXTO_SEM_ME_MS);
    return () => clearTimeout(timer);
  }, [aguardandoSemMe, setContextStatus]);

  return { meEmAndamento };
}
