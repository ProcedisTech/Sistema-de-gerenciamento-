import React, { useId, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import {
  getApiErrorToastMessage,
  organizacaoApi,
} from '../../services/api.js';
import { formatCnpjInput, isValidCnpj } from '../../utils/cnpj.js';
import { maskCep, onlyDigitsCep } from '../../utils/cepUtils.js';
import { useCepLookup } from '../hooks/useCepLookup.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickOrganizacaoId(body) {
  if (body == null || typeof body !== 'object') return '';
  const id =
    body?.id != null
      ? String(body.id)
      : body?.organizacaoSaudeId != null
        ? String(body.organizacaoSaudeId)
        : body?.organizacaoId != null
          ? String(body.organizacaoId)
          : body?.data?.id != null
            ? String(body.data.id)
            : '';
  return id;
}

/**
 * Cadastro de organização pós-onboarding. POST /api/v1/organizacoes
 * @param {{ onComplete: (organizacaoId: string) => void }} props
 */
export function CadastrarClinica({ onComplete }) {
  const toast = useToast();
  const formId = useId();
  const { lookup, status: cepLookupStatus } = useCepLookup();

  const [saving, setSaving] = useState(false);

  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpjDisplay, setCnpjDisplay] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');

  const [telefonePrincipal, setTelefonePrincipal] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

  const [cep, setCep] = useState('');
  const [enderecoLogradouro, setEnderecoLogradouro] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoEstado, setEnderecoEstado] = useState('');
  const [enderecoPais, setEnderecoPais] = useState('Brasil');

  const [responsavelTecnicoNome, setResponsavelTecnicoNome] = useState('');
  const [responsavelTecnicoRegistro, setResponsavelTecnicoRegistro] = useState('');

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35';
  const cardClass = 'rounded-xl border border-[#e2e8f0] bg-white p-6 space-y-4';
  const labelClass = 'mb-2 block text-[13px] font-bold text-[#00a88e]';
  const optionalBannerClass =
    'rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600';

  const cep8Ok = onlyDigitsCep(cep).length === 8;

  const handleBuscarCep = async () => {
    const out = await lookup(cep);
    if (!out.ok) return;
    if (out.skipped) {
      toast.error('Informe um CEP com 8 dígitos.');
      return;
    }
    if (!out.data) {
      if (out.fetchFailed) {
        toast.error('Não foi possível consultar o CEP. Tente novamente.');
        return;
      }
      toast.error('CEP não encontrado.');
      return;
    }
    const d = out.data;
    setEnderecoLogradouro(d.rua || '');
    setEnderecoBairro(d.bairro || '');
    setEnderecoCidade(d.cidade || '');
    setEnderecoEstado((d.estado || '').toUpperCase().slice(0, 2));
    if (d.complemento && !enderecoComplemento.trim()) {
      setEnderecoComplemento(d.complemento);
    }
    toast.success('Endereço preenchido pelo CEP.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const rs = razaoSocial.trim();
    const nf = nomeFantasia.trim();
    if (!rs) {
      toast.error('Preencha a razão social.');
      return;
    }
    if (!nf) {
      toast.error('Preencha o nome fantasia.');
      return;
    }

    const cnpjDigits = cnpjDisplay.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      toast.error('Informe o CNPJ com 14 dígitos.');
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      toast.error('CNPJ inválido.');
      return;
    }

    const em = email.trim();
    if (em && !EMAIL_RE.test(em)) {
      toast.error('E-mail inválido.');
      return;
    }

    const stripIg = (s) => s.replace(/^@+/, '').trim();

    // Helper: converte string vazia em null para campos opcionais
    // (o backend usa @Pattern/@Size que rejeita "" mas ignora null)
    const strOrNull = (s) => (s && s.trim() ? s.trim() : null);

    const uf = enderecoEstado.trim().toUpperCase().slice(0, 2);

    const dto = {
      razaoSocial: rs,
      nome: nf,
      cnpj: cnpjDigits,
      inscricaoEstadual: strOrNull(inscricaoEstadual),
      inscricaoMunicipal: strOrNull(inscricaoMunicipal),
      telefonePrincipal: strOrNull(telefonePrincipal),
      whatsapp: strOrNull(whatsapp),
      email: em || null,
      siteUrl: strOrNull(siteUrl),
      instagramHandle: strOrNull(stripIg(instagramHandle)),
      cep: strOrNull(onlyDigitsCep(cep)),
      enderecoLogradouro: strOrNull(enderecoLogradouro),
      enderecoNumero: strOrNull(enderecoNumero),
      enderecoComplemento: strOrNull(enderecoComplemento),
      enderecoBairro: strOrNull(enderecoBairro),
      enderecoCidade: strOrNull(enderecoCidade),
      // @Pattern não aceita string vazia — enviar null quando UF não preenchida
      enderecoEstado: uf.length === 2 ? uf : null,
      enderecoPais: enderecoPais.trim() || 'Brasil',
      responsavelTecnicoNome: strOrNull(responsavelTecnicoNome),
      responsavelTecnicoRegistro: strOrNull(responsavelTecnicoRegistro),
    };

    setSaving(true);
    try {
      const body = await organizacaoApi.criar(dto);
      const id = pickOrganizacaoId(body);
      if (!id) {
        toast.error('Resposta do servidor sem identificador da clínica.');
        return;
      }
      toast.success('Clínica cadastrada com sucesso.');
      if (typeof onComplete === 'function') onComplete(id);
    } catch (err) {
      toast.error(getApiErrorToastMessage(err, 'Falha ao cadastrar. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4 py-8">
      <div className="mx-auto w-full max-w-2xl pb-10">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-[#e6f7f5] p-4 text-[#00a88e]">
            <Building2 className="h-8 w-8" strokeWidth={2} aria-hidden />
          </div>
        </div>
        <h1 className="mb-1 text-center text-[22px] font-bold text-[#0f172a]">Cadastrar Clínica</h1>
        <p className="mb-6 text-center text-[13px] font-medium text-[#64748b]">
          Preencha os dados da sua clínica
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={cardClass}>
            <h3 className="text-[15px] font-bold text-[#0f172a]">Identificação</h3>
            <div>
              <label className={labelClass} htmlFor={`${formId}-razao`}>
                Razão social <span className="text-red-600">*</span>
              </label>
              <input
                id={`${formId}-razao`}
                type="text"
                value={razaoSocial}
                onChange={(ev) => setRazaoSocial(ev.target.value)}
                className={inputClass}
                autoComplete="organization"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-fantasia`}>
                Nome fantasia <span className="text-red-600">*</span>
              </label>
              <input
                id={`${formId}-fantasia`}
                type="text"
                value={nomeFantasia}
                onChange={(ev) => setNomeFantasia(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-cnpj`}>
                CNPJ <span className="text-red-600">*</span>
              </label>
              <input
                id={`${formId}-cnpj`}
                type="text"
                inputMode="numeric"
                value={cnpjDisplay}
                onChange={(ev) => setCnpjDisplay(formatCnpjInput(ev.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-ie`}>
                Inscrição estadual
              </label>
              <input
                id={`${formId}-ie`}
                type="text"
                value={inscricaoEstadual}
                onChange={(ev) => setInscricaoEstadual(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-im`}>
                Inscrição municipal
              </label>
              <input
                id={`${formId}-im`}
                type="text"
                value={inscricaoMunicipal}
                onChange={(ev) => setInscricaoMunicipal(ev.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className={cardClass}>
            <p className={optionalBannerClass} role="note">
              Você pode preencher agora ou depois em Configurações.
            </p>
            <h3 className="text-[15px] font-bold text-[#0f172a]">Contato</h3>
            <div>
              <label className={labelClass} htmlFor={`${formId}-telp`}>
                Telefone principal
              </label>
              <input
                id={`${formId}-telp`}
                type="tel"
                value={telefonePrincipal}
                onChange={(ev) => setTelefonePrincipal(ev.target.value)}
                className={inputClass}
                autoComplete="tel"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-wa`}>
                WhatsApp
              </label>
              <input
                id={`${formId}-wa`}
                type="tel"
                value={whatsapp}
                onChange={(ev) => setWhatsapp(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-mail`}>
                E-mail
              </label>
              <input
                id={`${formId}-mail`}
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-site`}>
                Site
              </label>
              <input
                id={`${formId}-site`}
                type="url"
                value={siteUrl}
                onChange={(ev) => setSiteUrl(ev.target.value)}
                className={inputClass}
                autoComplete="url"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-ig`}>
                Instagram (@handle)
              </label>
              <input
                id={`${formId}-ig`}
                type="text"
                value={instagramHandle}
                onChange={(ev) => setInstagramHandle(ev.target.value.replace(/^@+/, ''))}
                className={inputClass}
                placeholder="ex.: minha_clinica"
              />
            </div>
          </div>

          <div className={cardClass}>
            <p className={optionalBannerClass} role="note">
              Você pode preencher agora ou depois em Configurações.
            </p>
            <h3 className="text-[15px] font-bold text-[#0f172a]">Endereço</h3>
            <div>
              <label className={labelClass} htmlFor={`${formId}-cep`}>
                CEP
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input
                  id={`${formId}-cep`}
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(ev) => setCep(maskCep(ev.target.value))}
                  className={`${inputClass} sm:min-w-0 sm:flex-1`}
                  autoComplete="postal-code"
                  placeholder="00000-000"
                />
                <button
                  type="button"
                  onClick={() => void handleBuscarCep()}
                  disabled={!cep8Ok || cepLookupStatus === 'loading'}
                  className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {cepLookupStatus === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden />
                  )}
                  Buscar
                </button>
              </div>
              {cepLookupStatus === 'not_found' || cepLookupStatus === 'error' ? (
                <p className="mt-1 text-[12px] font-semibold text-amber-800" role="status">
                  Não foi possível consultar o CEP. Preencha o endereço manualmente.
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-log`}>
                Logradouro
              </label>
              <input
                id={`${formId}-log`}
                type="text"
                value={enderecoLogradouro}
                onChange={(ev) => setEnderecoLogradouro(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`${formId}-num`}>
                  Número
                </label>
                <input
                  id={`${formId}-num`}
                  type="text"
                  value={enderecoNumero}
                  onChange={(ev) => setEnderecoNumero(ev.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${formId}-comp`}>
                  Complemento
                </label>
                <input
                  id={`${formId}-comp`}
                  type="text"
                  value={enderecoComplemento}
                  onChange={(ev) => setEnderecoComplemento(ev.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-bairro`}>
                Bairro
              </label>
              <input
                id={`${formId}-bairro`}
                type="text"
                value={enderecoBairro}
                onChange={(ev) => setEnderecoBairro(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`${formId}-cidade`}>
                  Cidade
                </label>
                <input
                  id={`${formId}-cidade`}
                  type="text"
                  value={enderecoCidade}
                  onChange={(ev) => setEnderecoCidade(ev.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${formId}-uf`}>
                  Estado (UF)
                </label>
                <input
                  id={`${formId}-uf`}
                  type="text"
                  maxLength={2}
                  value={enderecoEstado}
                  onChange={(ev) => setEnderecoEstado(ev.target.value.slice(0, 2))}
                  onBlur={() =>
                    setEnderecoEstado((prev) => prev.trim().toUpperCase().slice(0, 2))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-pais`}>
                País
              </label>
              <input
                id={`${formId}-pais`}
                type="text"
                value={enderecoPais}
                onChange={(ev) => setEnderecoPais(ev.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className={cardClass}>
            <p className={optionalBannerClass} role="note">
              Você pode preencher agora ou depois em Configurações.
            </p>
            <h3 className="text-[15px] font-bold text-[#0f172a]">Responsável técnico</h3>
            <div>
              <label className={labelClass} htmlFor={`${formId}-rt-nome`}>
                Nome do responsável
              </label>
              <input
                id={`${formId}-rt-nome`}
                type="text"
                value={responsavelTecnicoNome}
                onChange={(ev) => setResponsavelTecnicoNome(ev.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-rt-reg`}>
                Registro profissional
              </label>
              <input
                id={`${formId}-rt-reg`}
                type="text"
                value={responsavelTecnicoRegistro}
                onChange={(ev) => setResponsavelTecnicoRegistro(ev.target.value)}
                className={inputClass}
                placeholder="ex.: CRBM-DF 12345"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#00997f] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {saving ? 'Salvando…' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
