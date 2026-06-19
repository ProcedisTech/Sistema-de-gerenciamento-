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
import { TermoVisualizacao } from '../../termos/TermoVisualizacao';

/* ─── Paleta de cores (mesma do Resumo de Atendimento) ──────────────────── */
const TERMO_COLORS = {
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
export function TermoContent({ text }) {
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
              <p key={i} className="mb-0.5 text-[11px] leading-relaxed" style={{ color: TERMO_COLORS.gray }}>
                {s.text}
              </p>
            );

          case 'section-header':
            return (
              <div key={i} className="mt-5">
                {i > 1 && (
                  <div className="mb-4 border-t" style={{ borderColor: TERMO_COLORS.lgray }} />
                )}
                <p
                  className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: TERMO_COLORS.teal }}
                >
                  {s.num}. {s.text}
                </p>
              </div>
            );

          case 'list':
            return (
              <ul key={i} className="mb-2 space-y-1 pl-1">
                {s.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 leading-relaxed" style={{ color: TERMO_COLORS.dark }}>
                    <span className="mt-[2px] shrink-0 text-[10px]" style={{ color: TERMO_COLORS.teal }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case 'paragraph':
            return (
              <p key={i} className="mb-3 leading-relaxed" style={{ color: TERMO_COLORS.dark }}>
                {s.text}
              </p>
            );

          case 'aceite':
            return (
              <div
                key={i}
                className="mt-4 rounded-xl border px-4 py-3 text-center text-[13px] font-semibold"
                style={{ borderColor: TERMO_COLORS.teal, backgroundColor: TERMO_COLORS.bgteal, color: TERMO_COLORS.teal }}
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
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-slate-100 shadow-2xl sm:rounded-2xl relative"
      >
        <h2 id="lgpd-modal-title" className="sr-only">Termo de Consentimento LGPD</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar visualização do termo"
          className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-lg bg-black/10 text-slate-700 transition-colors hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* Aviso de campos ausentes */}
          {missingFields.length > 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
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

          <TermoVisualizacao
            titulo="TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)"
            conteudo={consentText}
            clinicaCtx={clinica}
            profissionalCtx={profissional}
            pacienteCtx={paciente}
          />
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 border-t px-5 py-4" style={{ borderColor: TERMO_COLORS.lgray }}>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl text-[14px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: TERMO_COLORS.teal }}
          >
            Entendi — Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
