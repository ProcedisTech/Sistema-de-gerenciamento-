import React, { useState, useEffect } from 'react';
import { Save, ExternalLink, ShieldCheck, Clock, Globe, AlertCircle, Loader2, FileText, Printer } from 'lucide-react';
import { clinicaApi, anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import { QRCodeSVG } from 'qrcode.react';

export function AnamneseConfigPublicaPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fichas, setFichas] = useState([]);
  const [config, setConfig] = useState({ slug: '', validadeAnamneseDias: 180, anamnesePadraoId: '' });
  const toast = useToast();

  useEffect(() => {
    let isSubscribed = true;
    const fetchConfig = async () => {
      try {
        const [clinica, fichasList] = await Promise.all([
          clinicaApi.buscar(),
          anamneseApi.listarFichas()
        ]);
        if (isSubscribed) {
          setFichas(fichasList || []);
          setConfig({
            slug: clinica.slug || '',
            validadeAnamneseDias: clinica.validadeAnamneseDias ?? 180,
            anamnesePadraoId: clinica.anamnesePadraoId || ''
          });
          setLoading(false);
        }
      } catch {
        if (isSubscribed) {
          toast.error('Erro ao carregar configurações.');
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
      await clinicaApi.atualizar({
        slug: config.slug,
        validadeAnamneseDias: Number(config.validadeAnamneseDias),
        anamnesePadraoId: config.anamnesePadraoId || null,
      });
      toast.success('Configurações salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (!config.slug) {
      toast.error('É necessário salvar um identificador (slug) antes de testar.');
      return;
    }
    window.open(`/anamnese?clinic=${config.slug}`, '_blank');
  };

  const handlePrintQRCode = () => {
    if (!config.slug) {
      toast.error('É necessário salvar um identificador (slug) antes de imprimir o QR Code.');
      return;
    }
    
    // Determine base URL dynamically or fallback
    const baseUrl = window.location.origin.includes('localhost') 
      ? 'https://procedi.com.br' 
      : window.location.origin;
    const url = `${baseUrl}/anamnese?clinic=${config.slug}`;
    
    const svgElement = document.querySelector('#qr-code-container svg');
    if (!svgElement) return;
    
    // Clone the SVG to modify its size for printing
    const clonedSvg = svgElement.cloneNode(true);
    clonedSvg.setAttribute('width', '250');
    clonedSvg.setAttribute('height', '250');
    const svgData = new XMLSerializer().serializeToString(clonedSvg);

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - Procedi</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
              color: #1e293b;
            }
            .container {
              border: 2px dashed #cbd5e1;
              padding: 40px;
              border-radius: 24px;
              max-width: 500px;
              background: white;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 12px;
              color: #0f172a;
            }
            p {
              font-size: 18px;
              color: #64748b;
              margin-bottom: 40px;
              line-height: 1.5;
            }
            .qr-wrapper {
              display: flex;
              justify-content: center;
              margin-bottom: 32px;
            }
            .url {
              font-size: 15px;
              color: #94a3b8;
              word-break: break-all;
            }
            @media print {
              body { height: auto; display: block; padding-top: 50px; }
              .container { border: none; padding: 0; margin: 0 auto; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Ficha de Anamnese</h1>
            <p>Aponte a câmera do seu celular para o código abaixo para preencher sua ficha médica.</p>
            <div class="qr-wrapper">
              ${svgData}
            </div>
            <div class="url">${url}</div>
          </div>
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white/50 rounded-3xl border border-[#e2e8f0]">
        <Loader2 className="w-8 h-8 text-[#00a88e] animate-spin mb-3" />
        <p className="text-[14px] text-slate-500 font-medium">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-4xl animate-fade-in-up">
      {/* HEADER EXPLICATIVO */}
      <div className="mb-2">
        <h2 className="text-[20px] font-bold text-slate-800 tracking-tight">Portal do Paciente</h2>
        <p className="text-[14px] text-slate-500 mt-1">
          Configure o link de acesso e as regras para que seus pacientes preencham a ficha de anamnese de casa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES PRINCIPAIS */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110 duration-500 opacity-50" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center shadow-inner border border-white">
                <Globe className="w-6 h-6 text-[#00a88e]" />
              </div>
              <div>
                <h3 className="font-bold text-[17px] text-slate-800">Endereço Público</h3>
                <p className="text-[13px] text-slate-500">Defina a URL que será enviada aos pacientes</p>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="slugConfig" className="text-[13px] font-bold text-slate-700">
                  Identificador da Clínica (Slug)
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-[#00a88e] focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <div className="px-3 text-slate-400 text-[14px] select-none border-r border-slate-200 bg-slate-50">
                    procedi.com.br/anamnese?clinic=
                  </div>
                  <input
                    id="slugConfig"
                    type="text"
                    value={config.slug}
                    onChange={(e) => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="sua-clinica"
                    className="flex-1 px-3 py-3 bg-white text-[14px] text-slate-800 focus:outline-none font-medium placeholder:text-slate-300"
                  />
                </div>
                <p className="text-[12px] text-slate-500">
                  Use letras minúsculas, números e traços. Exemplo: <strong>clinica-sorriso</strong>.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <label htmlFor="anamnesePadrao" className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" /> 
                  Ficha de Anamnese Padrão
                </label>
                <div className="relative">
                  <select
                    id="anamnesePadrao"
                    value={config.anamnesePadraoId}
                    onChange={(e) => setConfig({ ...config, anamnesePadraoId: e.target.value })}
                    className="w-full appearance-none px-4 py-3 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 focus:outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  >
                    <option value="">-- Selecione uma ficha --</option>
                    {fichas.map(ficha => (
                      <option key={ficha.id} value={ficha.id}>{ficha.nome}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">
                  Esta será a ficha exibida para preenchimento quando o paciente acessar o link público.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <label htmlFor="validadeConfig" className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> 
                  Validade da Ficha Preenchida
                </label>
                <div className="relative">
                  <select
                    id="validadeConfig"
                    value={config.validadeAnamneseDias}
                    onChange={(e) => setConfig({ ...config, validadeAnamneseDias: Number(e.target.value) })}
                    className="w-full appearance-none px-4 py-3 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 focus:outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  >
                    <option value="30">Requerer nova ficha a cada 30 dias</option>
                    <option value="90">Requerer nova ficha a cada 3 meses</option>
                    <option value="180">Requerer nova ficha a cada 6 meses</option>
                    <option value="365">Requerer nova ficha anualmente (1 ano)</option>
                    <option value="730">Requerer nova ficha a cada 2 anos</option>
                    <option value="99999">Sempre válida (Nunca pedir novamente)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">
                  Se o paciente clicar no link após esse período, o sistema exigirá que ele preencha a anamnese novamente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: TESTE E PREVIEW & QR CODE */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* CARD: TESTAR ACESSO */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-6 shadow-lg text-white flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -z-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-tr-full -z-10" />
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-[16px]">Testar Acesso</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <p className="text-[13px] text-slate-300 leading-relaxed">
                Para simular a visão do paciente, você precisará informar um CPF válido de um paciente que <strong className="text-emerald-300">já esteja cadastrado</strong> na sua clínica.
              </p>
              
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  Se você usar um CPF que não existe no seu banco de pacientes, a página exibirá erro de segurança (Paciente não encontrado).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePreview}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-lg shadow-emerald-500/20 mt-auto"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Portal do Paciente
            </button>
          </div>

          {/* CARD: QR CODE */}
          {config.slug && (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col items-center text-center animate-fade-in-up">
              <h3 className="font-bold text-[16px] text-slate-800 mb-2">QR Code de Acesso</h3>
              <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
                Imprima e deixe na recepção para seus pacientes acessarem a ficha pelo celular.
              </p>
              
              <div id="qr-code-container" className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm mb-5 hover:shadow-md transition-shadow">
                <QRCodeSVG 
                  value={window.location.origin.includes('localhost') ? `https://procedi.com.br/anamnese?clinic=${config.slug}` : `${window.location.origin}/anamnese?clinic=${config.slug}`}
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <button
                type="button"
                onClick={handlePrintQRCode}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-[#00a88e] bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir QR Code
              </button>
            </div>
          )}

        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="relative px-8 py-3 bg-[#00a88e] text-white rounded-xl text-[15px] font-bold shadow-sm hover:bg-[#0f766e] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 overflow-hidden group"
        >
          {saving && (
            <div className="absolute inset-0 bg-[#0f766e] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <span className={`flex items-center gap-2 transition-opacity duration-200 ${saving ? 'opacity-0' : 'opacity-100'}`}>
            <Save className="w-4 h-4" />
            Salvar Alterações
          </span>
        </button>
      </div>
    </form>
  );
}
