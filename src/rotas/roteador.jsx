import { Navigate } from 'react-router';
import { caminhos } from './caminhos';

export function criarRotas(elemento) {
  return [
    { path: '/', element: <Navigate to={caminhos.pacientes()} replace /> },
    { path: '*', element: elemento },
  ];
}
