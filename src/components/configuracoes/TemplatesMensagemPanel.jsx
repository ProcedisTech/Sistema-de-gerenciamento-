import { useEffect, useState } from 'react';
import { MessageCircle, Save } from 'lucide-react';
import { getApiErrorToastMessage, templatesMensagemApi } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';

const PLACEHOLDERS = ['{paciente_nome}', '{data}', '{hora}', '{profissional}', '{link}'];

const DEFAULT_TEMPLATES = {
  confirmacao:
    'Oi {paciente_nome}! Tudo certo? Te lembrando que amanhã ({data}) às {hora} temos seu atendimento. Você pode confirmar sua presença aqui: {link}',
  lembrete:
    'Oi {paciente_nome}! Seu atendimento e HOJE as {hora}. To te esperando! Se precisar reagendar, e so clicar: {link}',
};

function TemplateEditor({ titulo, descricao, valor, onChange, onSalvar, salvando }) {
  return (
    <section>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f172a]">
            <MessageCircle className="h-4 w-4" />
            {titulo}
          </h3>
          <p className="text-[12px] text-[#64748b]">{descricao}</p>
        </div>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando || !valor.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-[#00a88e] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#008f78] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value.slice(0, 1000))}
        maxLength={1000}
        rows={4}
        className="w-full rounded-lg border border-[#e2e8f0] bg-white p-3 text-[13px] focus:border-[#00a88e] focus:outline-none focus:ring-2 focus:ring-[#00a88e]/20"
      />
      <p className="mt-1 text-[11px] text-[#94a3b8]">{valor.length}/1000</p>
    </section>
  );
}

export function TemplatesMensagemPanel() {
  const [textoConfirmacao, setTextoConfirmacao] = useState('');
  const [textoLembrete, setTextoLembrete] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const [salvandoLembrete, setSalvandoLembrete] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let alive = true;
    templatesMensagemApi
      .listar()
      .then((lista) => {
        if (!alive) return;
        const arr = Array.isArray(lista) ? lista : [];
        const conf = arr.find((t) => t.tipo === 'confirmacao');
        const lemb = arr.find((t) => t.tipo === 'lembrete');
        setTextoConfirmacao(conf?.texto || DEFAULT_TEMPLATES.confirmacao);
        setTextoLembrete(lemb?.texto || DEFAULT_TEMPLATES.lembrete);
      })
      .catch((e) => toastError(getApiErrorToastMessage(e, 'Erro ao carregar templates')))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [toastError]);

  const handleSalvar = async (tipo, texto, setSaving) => {
    if (!texto.trim()) return;
    setSaving(true);
    try {
      await templatesMensagemApi.salvar(tipo, texto.trim());
      success(`Template "${tipo}" salvo`);
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[#64748b]">Carregando templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <p className="mb-2 text-[13px] font-bold text-[#0f172a]">Variaveis disponiveis</p>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS.map((placeholder) => (
            <code key={placeholder} className="rounded bg-white px-2 py-1 text-[11px] text-[#0f766e]">
              {placeholder}
            </code>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#64748b]">
          Use as variaveis no texto e elas serao preenchidas automaticamente ao enviar.
        </p>
      </div>

      <TemplateEditor
        titulo="Confirmação (24h antes)"
        descricao="Enviado para confirmar presença do paciente no dia anterior"
        valor={textoConfirmacao}
        onChange={setTextoConfirmacao}
        onSalvar={() => handleSalvar('confirmacao', textoConfirmacao, setSalvandoConfirmacao)}
        salvando={salvandoConfirmacao}
      />

      <TemplateEditor
        titulo="Lembrete (1h antes)"
        descricao="Enviado para lembrar o paciente proximo da hora"
        valor={textoLembrete}
        onChange={setTextoLembrete}
        onSalvar={() => handleSalvar('lembrete', textoLembrete, setSalvandoLembrete)}
        salvando={salvandoLembrete}
      />
    </div>
  );
}
