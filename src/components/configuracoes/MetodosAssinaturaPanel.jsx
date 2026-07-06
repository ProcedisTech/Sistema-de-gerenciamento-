import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, PenLine, TabletSmartphone, QrCode, Link2 } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import { usePapel } from '../../hooks/usePapel.js';
import { getApiErrorToastMessage, organizacaoApi } from '../../services/api.js';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';

function findOrgRow(list, orgId) {
  if (!Array.isArray(list) || !orgId) return null;
  const idStr = String(orgId).trim();
  return list.find(o => o && typeof o === 'object' && (String(o.id ?? '') === idStr || String(o.organizacaoSaudeId ?? '') === idStr)) ?? null;
}

export function MetodosAssinaturaPanel() {
  const toast = useToast();
  const { orgId } = useOrg();
  const { canSeeConfigClinica, isAdmin } = usePapel();
  const canEdit = canSeeConfigClinica || isAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [permiteTablet, setPermiteTablet] = useState(true);
  const [permiteQrCode, setPermiteQrCode] = useState(true);
  const [permiteLink, setPermiteLink] = useState(true);

  const loadSettings = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!orgId) {
      if (!silent) {
        setLoadError('Organização não definida.');
        setLoading(false);
      }
      return null;
    }
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const list = await organizacaoApi.getMinhas();
      const row = findOrgRow(list, orgId);
      if (!row) {
        if (!silent) setLoadError('Não foi possível carregar as configurações da clínica.');
        return null;
      }
      setPermiteTablet(row.permiteAssinaturaTablet ?? true);
      setPermiteQrCode(row.permiteAssinaturaQrCode ?? true);
      setPermiteLink(row.permiteAssinaturaLink ?? true);
      return row;
    } catch (e) {
      if (!silent) {
        setLoadError(getApiErrorToastMessage(e, 'Falha ao carregar configurações.'));
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!canEdit) return;
    if (!orgId) {
      toast.error('Organização não definida.');
      return;
    }

    setSaving(true);
    try {
      await organizacaoApi.atualizar(orgId, {
        permiteAssinaturaTablet: permiteTablet,
        permiteAssinaturaQrCode: permiteQrCode,
        permiteAssinaturaLink: permiteLink
      });
      toast.success('Métodos de assinatura salvos com sucesso.');
      await loadSettings({ silent: true });
    } catch (e) {
      toast.error(getApiErrorToastMessage(e, 'Erro ao salvar métodos de assinatura.'));
    } finally {
      setSaving(false);
    }
  };

  const dis = !canEdit;

  if (loadError && !loading) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-center">
        <p className="text-[14px] font-semibold text-red-800">{loadError}</p>
        <button
          type="button"
          onClick={() => loadSettings()}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-[13px] font-bold text-red-700 hover:bg-red-50"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {dis ? (
        <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-600">
          Você não tem permissão para editar os dados da clínica. Entre em contato com um administrador.
        </div>
      ) : null}

      <div className="mb-4">
        <h3 className="text-[18px] font-bold text-[#0f172a] flex items-center gap-2">
          <PenLine className="h-5 w-5 text-[#00a88e]" />
          Métodos de Assinatura
        </h3>
        <p className="mt-1 text-[13px] text-[#64748b]">
          Escolha quais métodos estarão disponíveis para o paciente assinar documentos na clínica.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {loading ? (
          <ConfigCardStackSkeleton count={3} className="h-24" />
        ) : (
          <>
        <div className={`rounded-xl border p-4 transition-colors ${permiteQrCode ? 'border-[#00a88e]/30 bg-[#f0fdf9]' : 'border-slate-200 bg-white'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex h-6 items-center">
              <input
                type="checkbox"
                checked={permiteQrCode}
                onChange={(e) => setPermiteQrCode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#00a88e] focus:ring-[#00a88e]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[#0f172a] flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#0f172a]" /> QR Code (Recomendado)
              </span>
              <span className="text-[13px] text-[#64748b]">
                O paciente escaneia o código com o próprio celular para ler e assinar. É o método mais seguro e higiênico.
              </span>
            </div>
          </label>
        </div>

        <div className={`rounded-xl border p-4 transition-colors ${permiteTablet ? 'border-[#00a88e]/30 bg-[#f0fdf9]' : 'border-slate-200 bg-white'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex h-6 items-center">
              <input
                type="checkbox"
                checked={permiteTablet}
                onChange={(e) => setPermiteTablet(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#00a88e] focus:ring-[#00a88e]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[#0f172a] flex items-center gap-2">
                <TabletSmartphone className="h-4 w-4 text-[#0f172a]" /> Tablet / Dispositivo da Clínica
              </span>
              <span className="text-[13px] text-[#64748b]">
                O paciente lê e assina diretamente no tablet ou computador do profissional.
              </span>
            </div>
          </label>
        </div>

        <div className={`rounded-xl border p-4 transition-colors ${permiteLink ? 'border-[#00a88e]/30 bg-[#f0fdf9]' : 'border-slate-200 bg-white'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex h-6 items-center">
              <input
                type="checkbox"
                checked={permiteLink}
                onChange={(e) => setPermiteLink(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#00a88e] focus:ring-[#00a88e]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[#0f172a] flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#0f172a]" /> Envio de Link (WhatsApp / E-mail)
              </span>
              <span className="text-[13px] text-[#64748b]">
                Habilita os botões para compartilhar o link de assinatura por WhatsApp, E-mail ou copiar o link manualmente.
              </span>
            </div>
          </label>
        </div>

        {canEdit && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || (!permiteTablet && !permiteQrCode && !permiteLink)}
              className="flex min-h-[44px] w-full sm:w-auto px-8 items-center justify-center gap-2 rounded-xl border border-app-border bg-[#00a88e] py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#00997f] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
            {(!permiteTablet && !permiteQrCode && !permiteLink) && (
              <p className="mt-2 text-[12px] font-semibold text-red-600">Selecione pelo menos um método de assinatura.</p>
            )}
          </div>
        )}
          </>
        )}
      </form>
    </div>
  );
}
