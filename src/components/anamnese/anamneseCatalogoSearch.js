import { catalogoClinicoApi } from '../../services/api';
import { resolveApiUrl } from '../../config/apiEnv';

function asList(data) {
  return Array.isArray(data) ? data : [];
}

export function searchCatalogoHub(tipoResposta, { sexo, tipoAntecedenteCodigo } = {}) {
  return async (q) => {
    if (tipoResposta === 'catalogo_alergia') {
      const [alimentos, outras] = await Promise.all([
        catalogoClinicoApi.alimentos(q).then(asList).catch(() => []),
        catalogoClinicoApi.outrasAlergias(q).then(asList).catch(() => []),
      ]);
      return [...alimentos, ...outras];
    }
    if (tipoResposta === 'catalogo_principio_ativo') {
      return catalogoClinicoApi.principiosAtivos(q).then(asList).catch(() => []);
    }
    if (tipoResposta === 'catalogo_medicamento') {
      return catalogoClinicoApi.medicamentos(q).then(asList).catch(() => []);
    }
    if (tipoResposta === 'catalogo_antecedente') {
      return catalogoClinicoApi
        .antecedentesPessoais(q, sexo, tipoAntecedenteCodigo)
        .then(asList)
        .catch(() => []);
    }
    return [];
  };
}

async function fetchJson(path) {
  const res = await fetch(resolveApiUrl(path), {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return asList(data);
}

export function searchCatalogoPublico(tipoResposta, { sexo, tipoAntecedenteCodigo } = {}) {
  return async (q) => {
    const enc = encodeURIComponent(q);
    if (tipoResposta === 'catalogo_alergia') {
      const [alimentos, outras] = await Promise.all([
        fetchJson(`/api/public/anamnese/catalogo/alimentos?q=${enc}`),
        fetchJson(`/api/public/anamnese/catalogo/outras-alergias?q=${enc}`),
      ]);
      return [...alimentos, ...outras];
    }
    if (tipoResposta === 'catalogo_principio_ativo') {
      return fetchJson(`/api/public/anamnese/catalogo/principios-ativos?q=${enc}`);
    }
    if (tipoResposta === 'catalogo_medicamento') {
      return fetchJson(`/api/public/anamnese/catalogo/medicamentos?q=${enc}`);
    }
    if (tipoResposta === 'catalogo_antecedente') {
      const params = new URLSearchParams({ q });
      if (sexo && sexo !== 'N') params.set('sexo', sexo);
      if (tipoAntecedenteCodigo) params.set('tipo', tipoAntecedenteCodigo);
      return fetchJson(`/api/public/anamnese/catalogo/antecedentes-pessoais?${params.toString()}`);
    }
    return [];
  };
}
