import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2, QrCode, X, Mail, MessageCircle } from 'lucide-react';
import { termosApi, clinicaProcedimentoApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';

/**
 * Modal "Enviar para assinar" — gera link público para o paciente assinar
 * um termo de consentimento ou informações de procedimento remotamente.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ cpf: string, nomeCompleto: string }} props.paciente
 * @param {string} props.clinicSlug - slug da clínica (tb_organizacao_saude.slug)
 */
export function EnviarDocumentoAssinarModal({ open, onClose, paciente, clinicSlug }) {
  const toast = useToast();
  const [tipoDoc, setTipoDoc] = useState('TERMO');
  const [documentoId, setDocumentoId] = useState('');
  const [termos, setTermos] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDocumentoId('');
    setCopied(false);
    setShowQr(false);
    setLoading(true);

    Promise.all([
      termosApi.list().catch(() => []),
      clinicaProcedimentoApi.listar().catch(() => []),
    ])
      .then(([t, p]) => {
        const tList = Array.isArray(t) ? t : (t?.content || []);
        const pList = Array.isArray(p) ? p : (p?.content || []);
        setTermos(tList.filter(i => i.ativo !== false && i.active !== false));
        setProcedimentos(pList.filter(i => i.ativo !== false && i.active !== false));
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Reset documentoId when tipo changes
  useEffect(() => {
    setDocumentoId('');
    setShowQr(false);
    setCopied(false);
  }, [tipoDoc]);

  const documentoOptions = useMemo(() => {
    if (tipoDoc === 'TERMO') {
      return termos.map(t => ({
        id: t.id || t.termoId,
        label: t.titulo || t.title || 'Termo sem título',
      }));
    }
    return procedimentos.map(p => {
      const nomeProced = 
        p.procedimento?.nomeProcedimento ||
        p.procedimento?.nome ||
        p.catalogoProcedimento?.nomeProcedimento ||
        p.nomeProcedimento || 
        p.nome || 
        'Procedimento';
      return {
        id: p.id || p.catalogoProcedimentoSaudeId,
        label: nomeProced,
      };
    });
  }, [tipoDoc, termos, procedimentos]);

  const linkUrl = useMemo(() => {
    if (!documentoId || !clinicSlug || !paciente?.cpf) return '';
    const base = window.location.origin;
    const cleanCpf = String(paciente.cpf).replace(/\D/g, '');
    return `${base}/documento?cpf=${cleanCpf}&clinic=${encodeURIComponent(clinicSlug)}&tipo=${tipoDoc}&documento_id=${documentoId}`;
  }, [documentoId, clinicSlug, paciente?.cpf, tipoDoc]);

  const qrUrl = useMemo(() => {
    if (!linkUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(linkUrl)}&size=200x200`;
  }, [linkUrl]);

  const handleCopy = useCallback(async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = linkUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  }, [linkUrl, toast]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-teal-600" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-800">Enviar para assinar</h2>
              <p className="text-[12px] text-slate-500">{paciente?.nomeCompleto || 'Paciente'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Carregando documentos...</span>
            </div>
          ) : (
            <>
              {/* Tipo de documento */}
              <div>
                <label className="text-[13px] font-semibold text-slate-700 mb-2 block">Tipo de documento</label>
                <div className="flex gap-2">
                  {[
                    { value: 'TERMO', label: 'Termo de Consentimento' },
                    { value: 'PROCEDIMENTO', label: 'Procedimento' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTipoDoc(opt.value)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-[13px] font-semibold transition-all ${
                        tipoDoc === opt.value
                          ? 'border-teal-600 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20'
                          : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de documento */}
              <div>
                <label className="text-[13px] font-semibold text-slate-700 mb-2 block">
                  {tipoDoc === 'TERMO' ? 'Selecione o termo' : 'Selecione o procedimento'}
                </label>
                {documentoOptions.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
                    {tipoDoc === 'TERMO' ? 'Nenhum termo cadastrado.' : 'Nenhum procedimento vinculado.'}
                  </div>
                ) : (
                  <select
                    value={documentoId}
                    onChange={(e) => setDocumentoId(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white text-slate-800 font-medium text-[14px]"
                  >
                    <option value="" disabled>Selecione...</option>
                    {documentoOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Link gerado */}
              {linkUrl && (
                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-slate-700 block">Link para o paciente</label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={linkUrl}
                      className="flex-1 bg-transparent text-[12px] text-slate-600 outline-none truncate font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                        copied
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>

                  {/* Ações rápidas (WhatsApp / Email) */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `Olá! Acesse o link abaixo para assinar o documento da clínica:\n${linkUrl}`;
                        const phone = paciente?.telefone?.replace(/\D/g, '') || '';
                        window.open(`https://wa.me/${phone ? `55${phone}` : ''}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#1ebd5b]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const subject = 'Assinatura de Documento';
                        const body = `Olá!\n\nAcesse o link abaixo para assinar seu documento:\n${linkUrl}`;
                        const email = paciente?.email || '';
                        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </button>
                  </div>

                  {/* QR Code toggle */}
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className="flex items-center gap-2 text-[13px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    {showQr ? 'Ocultar QR Code' : 'Mostrar QR Code'}
                  </button>

                  {showQr && (
                    <div className="flex flex-col items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
                      <img
                        src={qrUrl}
                        alt="QR Code do link"
                        width={200}
                        height={200}
                        className="rounded-lg"
                      />
                      <p className="text-[11px] text-slate-400 text-center">
                        O paciente pode escanear este QR Code para acessar o documento
                      </p>
                    </div>
                  )}

                  {/* Abrir link em nova aba */}
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir link em nova aba (preview)
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
