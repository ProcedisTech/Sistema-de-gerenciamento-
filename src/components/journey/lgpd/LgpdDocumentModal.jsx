/**
 * LgpdDocumentModal.jsx
 *
 * Modal fullscreen que exibe o Termo de Consentimento LGPD com visual
 * idêntico ao Resumo de Atendimento:
 *   - Cabeçalho verde (#00a88e) com escudo + branding Procedi
 *   - Seções parseadas (labels teal, bullets, caixa de aceite)
 *   - Acessibilidade: trap de foco, Escape, aria-modal
 */

import React, { useEffect, useRef } from 'react';
import { Shield, X, AlertTriangle } from 'lucide-react';

/* ─── Paleta de cores (mesma do Resumo de Atendimento) ──────────────────── */
const C = {
  teal:   '#00a88e',
  dark:   '#0f172a',
  gray:   '#64748b',
  lgray:  '#e2e8f0',
  bgteal: '#f0fdf9',
  bgpage: '#f8fafc',
};

/* ─── Parser do texto do termo em seções renderizáveis ──────────────────── */
function parseTermoSections(text) {
  const rawLines = (text || '').split('\n');
  const sections = [];
  let current = null;

  rawLines.forEach((raw, idx) => {
    const line = raw.trim();

    /* Primeira linha = título do documento */
    if (idx === 0) {
      sections.push({ type: 'title', text: line });
      return;
    }

    /* Linha em branco */
    if (!line) {
      if (current) { sections.push(current); current = null; }
      return;
    }

    /* Metadados do cabeçalho */
    if (/^(Cl.nica Controladora|CNPJ|Sistema Operador|Profissional Respons)/i.test(line)) {
      if (current) { sections.push(current); current = null; }
      sections.push({ type: 'meta', text: line });
      return;
    }

    /* Seção numerada */
    const sec = line.match(/^(\d+)\.\s+(.+)/);
    if (sec) {
      if (current) { sections.push(current); current = null; }
      sections.push({ type: 'section-header', num: sec[1], text: sec[2] });
      return;
    }

    /* Frase de aceite */
    if (/^Por estar de acordo/i.test(line)) {
      if (current) { sections.push(current); current = null; }
      sections.push({ type: 'aceite', text: line });
      return;
    }

    /* Item de lista */
    if (line.startsWith('- ')) {
      if (!current || current.type !== 'list') {
        if (current) { sections.push(current); }
        current = { type: 'list', items: [] };
      }
      current.items.push(line.slice(2));
      return;
    }

    /* Parágrafo normal */
    if (current && current.type === 'list') {
      sections.push(current);
      current = null;
    }
    sections.push({ type: 'paragraph', text: line });
  });

  if (current) sections.push(current);
  return sections;
}

/* ─── Renderizador das seções ───────────────────────────────────────────── */
function TermoContent({ text }) {
  const sections = parseTermoSections(text);

  return (
    <div className="px-5 pb-6 pt-5 text-[13px]">
      {sections.map((s, i) => {
        switch (s.type) {
          case 'title':
            /* título omitido — já está no cabeçalho verde */
            return null;

          case 'meta':
            return (
              <p key={i} className="mb-0.5 text-[11px] leading-relaxed" style={{ color: C.gray }}>
                {s.text}
              </p>
            );

          case 'section-header':
            return (
              <div key={i} className="mt-5">
                {i > 1 && (
                  <div className="mb-4 border-t" style={{ borderColor: C.lgray }} />
                )}
                <p
                  className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: C.teal }}
                >
                  {s.num}. {s.text}
                </p>
              </div>
            );

          case 'list':
            return (
              <ul key={i} className="mb-2 space-y-1 pl-1">
                {s.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 leading-relaxed" style={{ color: C.dark }}>
                    <span className="mt-[2px] shrink-0 text-[10px]" style={{ color: C.teal }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case 'paragraph':
            return (
              <p key={i} className="mb-3 leading-relaxed" style={{ color: C.dark }}>
                {s.text}
              </p>
            );

          case 'aceite':
            return (
              <div
                key={i}
                className="mt-4 rounded-xl border px-4 py-3 text-center text-[13px] font-semibold"
                style={{ borderColor: C.teal, backgroundColor: C.bgteal, color: C.teal }}
              >
                {s.text}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────────────────── */

/**
 * @param {Object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onClose
 * @param {string}   props.consentText  Texto completo do termo (já interpolado)
 * @param {string[]} [props.missingFields]
 */
export function LgpdDocumentModal({ open, onClose, consentText, missingFields = [], paciente, clinica, profissional }) {
  const dialogRef    = useRef(null);
  const closeButtonRef = useRef(null);

  /* Fechar com Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Foco acessível */
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  /* Bloqueia scroll do body */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;



  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 sm:items-center sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lgpd-modal-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* ── Cabeçalho estilo TermoVisualizacao ── */}
        <header
          className="relative flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center"
          style={{ backgroundColor: C.teal }}
        >
          {/* Botão fechar (absoluto no topo direito) */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização do termo"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>

          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white shadow-sm">
              <Shield className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-white pr-8">
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-emerald-100 mr-1">CLÍNICA:</span>
              {clinica?.nome || '[Nome da Clínica]'} — {clinica?.endereco || '[Endereço da Clínica]'} — Contato: {clinica?.telefone || '[Telefone da Clínica]'}
            </div>
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-emerald-100 mr-1">PROFISSIONAL:</span>
              {profissional?.nome || '[Nome do Profissional]'} — Registro/CPF: {profissional?.cpf || profissional?.crm || '[CPF/CRM do Profissional]'}
            </div>
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-emerald-100 mr-1">PACIENTE:</span>
              {paciente?.nome || '[Nome do Paciente]'} — CPF: {paciente?.cpf || '[CPF do Paciente]'} — Contato: {paciente?.telefone || '[Telefone do Paciente]'}
            </div>
          </div>
        </header>

        {/* Titulo */}
        <div className="border-b border-[#e2e8f0] bg-[#f0fdfa] px-6 py-4 text-center">
          <h3 className="text-[16px] font-bold tracking-wide text-[#0f172a] uppercase">
            Termo de Consentimento LGPD
          </h3>
        </div>

        {/* Aviso de campos ausentes */}
        {missingFields.length > 0 && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
            <div>
              <p className="text-[13px] font-semibold text-amber-800">Dados incompletos no documento</p>
              <p className="mt-0.5 text-[12px] text-amber-700">
                Campos ausentes:{' '}
                <span className="font-mono font-semibold">{missingFields.join(', ')}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Conteúdo scrollável ── */}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ backgroundColor: C.bgpage }}
          aria-label="Texto do termo de consentimento"
        >
          <TermoContent text={consentText} />
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 border-t px-5 py-4" style={{ borderColor: C.lgray }}>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl text-[14px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: C.teal }}
          >
            Entendi — Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
