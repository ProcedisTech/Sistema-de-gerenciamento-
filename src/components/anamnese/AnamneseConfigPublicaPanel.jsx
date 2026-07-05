import React, { useState, useEffect } from 'react';
import { 
  Save, 
  ExternalLink, 
  Link2, 
  FormInput, 
  Clock, 
  QrCode, 
  Bell, 
  Loader2, 
  Copy, 
  Check, 
  Download, 
  Printer 
} from 'lucide-react';
import { acessoPublicoApi, anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import { ConfigFormSectionsSkeleton } from '../shared/ConfigPanelSkeletons';

export function AnamneseConfigPublicaPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fichas, setFichas] = useState([]);
  const [config, setConfig] = useState({ 
    slug: '', 
    validadeAnamneseDias: 180, 
    anamnesePadraoId: '',
    notificarNovaFicha: true,
    notificarVencimento: true
  });
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let isSubscribed = true;
    const fetchConfig = async () => {
      try {
        const [acessoData, fichasList] = await Promise.all([
          acessoPublicoApi.buscar(),
          anamneseApi.listarFichas()
        ]);
        if (isSubscribed) {
          setFichas(fichasList || []);
          setConfig({
            slug: acessoData.slug || '',
            validadeAnamneseDias: acessoData.validadeAnamneseDias ?? 180,
            anamnesePadraoId: acessoData.anamnesePadraoId || '',
            notificarNovaFicha: acessoData.notificarNovaFicha ?? true,
            notificarVencimento: acessoData.notificarVencimento ?? true
          });
          setLoading(false);
        }
      } catch {
        if (isSubscribed) {
          toast.error('Erro ao carregar configurações de acesso público.');
          setLoading(false);
        }
      }
    };
    fetchConfig();
    return () => { isSubscribed = false; };
  }, [toast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await acessoPublicoApi.atualizar({
        slug: config.slug,
        validadeAnamneseDias: Number(config.validadeAnamneseDias),
        anamnesePadraoId: config.anamnesePadraoId || null,
        notificarNovaFicha: config.notificarNovaFicha,
        notificarVencimento: config.notificarVencimento
      });
      toast.success('Configurações salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const linkUrl = config.slug ? `${window.location.origin}/anamnese?clinic=${config.slug}` : '';
  const qrUrl = linkUrl ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(linkUrl)}&size=200x200&margin=2` : '';

  const handleOpenPortal = () => {
    if (!config.slug) {
      toast.error('É necessário ter um identificador (slug) configurado.');
      return;
    }
    window.open(linkUrl, '_blank');
  };

  const handleCopyLink = () => {
    if (!config.slug) return;
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    toast.success('Link copiado com sucesso!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    if (!qrUrl) return;
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode_${config.slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar o QR Code.');
    }
  };

  const handlePrintQR = () => {
    if (!qrUrl) return;
    const printWindow = window.open('', '_blank', 'width=800,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; }
            img { max-width: 300px; margin-bottom: 20px; }
            .url { font-size: 16px; color: #555; }
            @media print { body { justify-content: flex-start; padding-top: 50px; } }
          </style>
        </head>
        <body>
          <h1>Acesso ao Portal do Paciente</h1>
          <p>Escaneie o QR Code abaixo com a câmera do seu celular.</p>
          <img src="${qrUrl}" alt="QR Code" />
          <div class="url">${linkUrl}</div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const chipsValidade = [
    { label: '1 mês', value: 30 },
    { label: '3 meses', value: 90 },
    { label: '6 meses', value: 180 },
    { label: '1 ano', value: 365 },
    { label: 'Nunca', value: 0 },
  ];

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full bg-slate-50 relative pb-24 animate-fade-in">
      {/* HEADER EXPLICATIVO */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Acesso público</h2>
          <p className="text-[14px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure o portal onde seus pacientes preenchem a anamnese sem precisar de login.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00a88e] hover:bg-[#00967f] text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir portal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="max-w-4xl mx-auto py-8 px-8 my-6">
            <ConfigFormSectionsSkeleton sections={3} />
          </div>
        ) : (
        <div className="max-w-4xl mx-auto py-8 px-8 flex flex-col gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm my-6">
          
          {/* Seção 1 — Endereço público */}
          <div className="py-6 border-b border-slate-100 flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex gap-4 md:w-1/3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-800">Endereço público</h3>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Link compartilhado com os pacientes</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-[14px] text-slate-600 font-medium select-all">
                {config.slug ? `procedi.app/a/${config.slug}` : 'Slug não configurado'}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!config.slug}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                Copiar
              </button>
            </div>
          </div>

          {/* Seção 2 — Ficha de anamnese */}
          <div className="py-6 border-b border-slate-100 flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex gap-4 md:w-1/3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <FormInput className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-800">Ficha de anamnese</h3>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Modelo exibido quando nenhuma ficha específica foi vinculada</p>
              </div>
            </div>
            <div className="flex-1">
              <select
                value={config.anamnesePadraoId}
                onChange={(e) => setConfig({ ...config, anamnesePadraoId: e.target.value })}
                className="w-full max-w-[320px] px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[14px] text-slate-700 focus:outline-none focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]"
              >
                <option value="">-- Selecione uma ficha --</option>
                {fichas.map(ficha => (
                  <option key={ficha.id} value={ficha.id}>{ficha.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Seção 3 — Validade da ficha */}
          <div className="py-6 border-b border-slate-100 flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex gap-4 md:w-1/3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-800">Validade da ficha</h3>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Prazo antes de solicitar novo preenchimento</p>
              </div>
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
              {chipsValidade.map(chip => {
                const isActive = config.validadeAnamneseDias === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setConfig({ ...config, validadeAnamneseDias: chip.value })}
                    className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all border ${
                      isActive 
                        ? 'bg-[#E1F5EE] border-[#5DCAA5] text-[#085041]' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção 4 — QR Code */}
          <div className="py-6 border-b border-slate-100 flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex gap-4 md:w-1/3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[15px] text-slate-800">QR Code</h3>
                  {config.slug && <span className="px-2 py-0.5 bg-[#E1F5EE] text-[#085041] text-[11px] font-bold uppercase tracking-wide rounded-md ml-auto">Ativo</span>}
                </div>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Para impressão na recepção</p>
              </div>
            </div>
            <div className="flex-1">
              {config.slug ? (
                <div className="flex gap-5 items-center">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 shrink-0">
                    <img src={qrUrl} alt="QR Code" className="w-[120px] h-[120px] rounded-lg" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <h4 className="text-[14px] font-bold text-slate-800">QR Code de acesso ao portal</h4>
                      <p className="text-[13px] text-slate-500 mt-1 max-w-[280px]">
                        Imprima e coloque na recepção. O paciente escaneia, digita o CPF e preenche a ficha pelo celular.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadQR}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[13px] font-bold rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" /> Baixar
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintQR}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[13px] font-bold rounded-lg transition-colors"
                      >
                        <Printer className="w-4 h-4" /> Imprimir
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-slate-500 italic mt-2">
                  Nenhum identificador configurado para gerar o QR Code.
                </div>
              )}
            </div>
          </div>

          {/* Seção 5 — Notificações */}
          <div className="py-6 flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex gap-4 md:w-1/3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-800">Notificações</h3>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Alertas sobre atividade no portal</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-5">
              {/* Toggle Nova Ficha */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Notificar ao receber nova ficha</div>
                  <div className="text-[13px] text-slate-500 mt-0.5">Alerta no painel quando um paciente enviar a anamnese</div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, notificarNovaFicha: !config.notificarNovaFicha })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.notificarNovaFicha ? 'bg-[#00a88e]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.notificarNovaFicha ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              {/* Toggle Vencimento */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Lembrete de fichas a vencer</div>
                  <div className="text-[13px] text-slate-500 mt-0.5">Aviso 7 dias antes do prazo de validade expirar</div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, notificarVencimento: !config.notificarVencimento })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.notificarVencimento ? 'bg-[#00a88e]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.notificarVencimento ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

        </div>
        )}
      </div>

      {/* FOOTER FIXED ACTION */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-200 px-8 py-4 flex justify-end z-20 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
        <button
          type="submit"
          disabled={saving || loading}
          className="relative px-6 py-2.5 bg-[#00a88e] text-white rounded-lg text-[14px] font-bold shadow-sm hover:bg-[#00967f] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 overflow-hidden group"
        >
          {saving && (
            <div className="absolute inset-0 bg-[#00967f] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <span className={`flex items-center gap-2 transition-opacity duration-200 ${saving ? 'opacity-0' : 'opacity-100'}`}>
            <Save className="w-4 h-4" />
            Salvar alterações
          </span>
        </button>
      </div>
    </form>
  );
}
