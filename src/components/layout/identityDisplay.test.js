import { describe, expect, it } from 'vitest';
import { displayInitials, displayRole, resolveIdentity } from './identityDisplay';

describe('resolveIdentity', () => {
  it('usa "Procedi" quando o nome da clínica está vazio', () => {
    expect(resolveIdentity({ clinicaNome: '' }).tituloClinica).toBe('Procedi');
    expect(resolveIdentity({ clinicaNome: '   ' }).tituloClinica).toBe('Procedi');
    expect(resolveIdentity({}).tituloClinica).toBe('Procedi');
  });

  it('usa o nome da clínica quando informado', () => {
    expect(resolveIdentity({ clinicaNome: ' Esclusività ' }).tituloClinica).toBe('Esclusività');
  });

  it('nome do usuário cai para e-mail, username e "Usuário", nessa ordem', () => {
    expect(
      resolveIdentity({ perfilNomeCompleto: 'Maria Souza', authUser: { email: 'm@x.com' } }).displayName,
    ).toBe('Maria Souza');
    expect(resolveIdentity({ perfilNomeCompleto: '', authUser: { email: 'm@x.com', username: 'maria' } }).displayName).toBe(
      'm@x.com',
    );
    expect(resolveIdentity({ authUser: { username: 'maria' } }).displayName).toBe('maria');
    expect(resolveIdentity({}).displayName).toBe('Usuário');
  });

  it('nome curto: apelido preenchido ganha, e o displayName continua o nome completo', () => {
    const r = resolveIdentity({ perfilApelido: 'Johnn', perfilNomeCompleto: 'Jhonathan Magalhães' });
    expect(r.shortName).toBe('Johnn');
    expect(r.displayName).toBe('Jhonathan Magalhães');
  });

  it('nome curto: apelido vazio ou só com espaços cai para o primeiro nome', () => {
    expect(resolveIdentity({ perfilApelido: '', perfilNomeCompleto: 'Jhonathan Magalhães' }).shortName).toBe(
      'Jhonathan',
    );
    expect(resolveIdentity({ perfilApelido: '   ', perfilNomeCompleto: '  Jhonathan Magalhães ' }).shortName).toBe(
      'Jhonathan',
    );
  });

  it('nome curto: nome de uma palavra fica inteiro', () => {
    expect(resolveIdentity({ perfilNomeCompleto: 'Maria' }).shortName).toBe('Maria');
  });

  it('nome curto: sem nome completo cai para e-mail, username e "Usuário"', () => {
    expect(resolveIdentity({ authUser: { email: 'm@x.com', username: 'maria' } }).shortName).toBe('m@x.com');
    expect(resolveIdentity({ authUser: { username: 'maria' } }).shortName).toBe('maria');
    expect(resolveIdentity({}).shortName).toBe('Usuário');
  });

  it('nome curto: mantém maiúsculas e minúsculas como cadastrado', () => {
    expect(resolveIdentity({ perfilNomeCompleto: 'JHONATHAN M CRUZ' }).shortName).toBe('JHONATHAN');
  });

  it('cargo vazio vira "Usuário"', () => {
    expect(resolveIdentity({ authUser: { id: '1', email: 'm@x.com' } }).roleLabel).toBe('Usuário');
  });

  it('logo e foto vazios resolvem para string vazia', () => {
    const r = resolveIdentity({ clinicaLogoUrl: '  ', perfilFotoUrl: '' });
    expect(r.clinicaLogoResolved).toBe('');
    expect(r.perfilFotoResolved).toBe('');
  });

  it('logo e foto absolutos são mantidos', () => {
    const r = resolveIdentity({ clinicaLogoUrl: 'https://cdn/x.png', perfilFotoUrl: 'https://cdn/y.png' });
    expect(r.clinicaLogoResolved).toBe('https://cdn/x.png');
    expect(r.perfilFotoResolved).toBe('https://cdn/y.png');
  });
});

describe('displayInitials', () => {
  it('uma palavra: os 2 primeiros caracteres em maiúsculas', () => {
    expect(displayInitials('maria@x.com')).toBe('MA');
  });

  it('várias palavras: primeira e última inicial', () => {
    expect(displayInitials('Jhonathan Magalhães da Cruz')).toBe('JC');
  });

  it('vazio: "U"', () => {
    expect(displayInitials('')).toBe('U');
  });
});

describe('displayRole', () => {
  it('vazio vira "Usuário"', () => {
    expect(displayRole(undefined)).toBe('Usuário');
  });

  it('capitaliza o cargo', () => {
    expect(displayRole('DONO')).toBe('Dono');
  });
});
