import React from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router';
import { flushSync } from 'react-dom';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import { criarRotas } from '../../rotas/roteador.jsx';
import { caminhos } from '../../rotas/caminhos.js';

let ultimo = null;

export function montarComRoteador(ui, { caminho = '/pacientes' } = {}) {
  ultimo = createMemoryRouter(criarRotas(ui), { initialEntries: [caminho] });
  return render(
    <ToastProvider>
      <RouterProvider router={ultimo} flushSync={flushSync} />
    </ToastProvider>,
  );
}

export const ultimoRoteador = () => ultimo;

// Traduz a view e as chaves antigas de sessionStorage (patientView/aba/CPF) para o endereço.
export function caminhoDoLegado({ view, sessao = {}, idPorCpf = {} } = {}) {
  const cpf = sessao.selectedPatientCpf ?? sessao.activePatientCpf;
  if ((view ?? 'pacientes') === 'pacientes') {
    if (sessao.patientView === 'new') return caminhos.pacienteNovo();
    if (sessao.patientView === 'profile' && cpf && idPorCpf[cpf]) {
      const aba = sessao.patientDetailTab === 'timeline' ? 'avulsos' : sessao.patientDetailTab;
      return caminhos.paciente(idPorCpf[cpf], aba);
    }
  }
  return caminhos.tela(view ?? 'pacientes');
}
