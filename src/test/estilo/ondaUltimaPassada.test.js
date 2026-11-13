// @vitest-environment node
// Onda 1 da ultima passada (refino Gestao de Equipe): regras de CSS lidas do arquivo real, com esperado escrito a mao.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url))
const lerCss = (rel) => postcss.parse(fs.readFileSync(path.resolve(RAIZ, rel), 'utf8'))
const indexCss = lerCss('src/styles/index.css')
const equipeCss = lerCss('src/components/configuracoes/gestaoEquipe.css')
const editorCss = lerCss('src/components/configuracoes/gestaoPerfilEditor.css')

// Regras (em ordem de arquivo) cujo seletor, em lista, e exatamente `sel`; `media` = params do @media ancestral, `container` = params do @container ancestral (ou null).
function regras(root, sel) {
  const out = []
  root.walkRules((r) => {
    const lista = r.selectors.map((s) => s.trim())
    if (!lista.includes(sel)) return
    const cond = { media: null, container: null }
    for (let p = r.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && (p.name === 'media' || p.name === 'container') && cond[p.name] === null) cond[p.name] = p.params
    }
    const d = {}
    r.walkDecls((x) => { d[x.prop] = x.value })
    out.push({ ...cond, d })
  })
  return out
}
// Cascata simples (mesma especificidade): a ultima declaracao de cada propriedade, so entre regras fora de @media e de @container.
const efetivo = (rs) => rs.filter((r) => r.media === null && r.container === null).reduce((acc, r) => ({ ...acc, ...r.d }), {})

describe('Item 1: marca do menu (index.css)', () => {
  it('.procedi-marca-nome: Cormorant, 35px, peso 600; .procedi-marca sem borda inferior propria', () => {
    const nome = efetivo(regras(indexCss, '.procedi-marca-nome'))
    expect(nome['font-size']).toBe('35px')
    expect(nome['font-family']).toContain('Cormorant Garamond')
    expect(nome['font-weight']).toBe('600')
    const marca = regras(indexCss, '.procedi-marca')
    expect(marca).toHaveLength(1) // sinal positivo: a regra existe
    expect(marca[0].d.height).toBe('86px')
    expect(marca[0].d['border-bottom']).toBeUndefined()
    expect(marca[0].d.border).toBeUndefined()
  })
})

describe('Item 2: barra inferior so abaixo de 768px (index.css)', () => {
  it('--bottom-nav-h: 0px so dentro de @media (min-width: 768px); fora dele continua a altura da barra', () => {
    const rs = regras(indexCss, ':root').filter((r) => r.d['--bottom-nav-h'] !== undefined)
    const zero = rs.filter((r) => r.d['--bottom-nav-h'] === '0px')
    expect(zero).toHaveLength(1)
    expect(zero[0].media).toBe('(min-width: 768px)')
    const base = rs.filter((r) => r.media === null)
    expect(base).toHaveLength(1)
    expect(base[0].d['--bottom-nav-h']).toContain('4rem')
    expect(rs.some((r) => r.media && r.media.includes('1024'))).toBe(false)
  })
})

describe('Item 3: nome do indicador inteiro (gestaoEquipe.css)', () => {
  it('a regra que vence em .kpi .kpi-label quebra linha e nao corta com reticencias', () => {
    const sel = '.prototype-equipe .kpi .kpi-label'
    const rs = regras(equipeCss, sel)
    // sinal positivo: ha a regra conjunta antiga (com ellipsis) E a nova que a sobrepoe, nessa ordem
    expect(rs.length).toBeGreaterThanOrEqual(2)
    expect(rs[0].d['text-overflow']).toBe('ellipsis')
    const final = efetivo(rs)
    expect(final['white-space']).toBe('normal')
    expect(final['text-overflow']).not.toBe('ellipsis')
    expect(final['text-overflow']).toBe('clip')
    expect(final.overflow).toBe('visible')
    expect(rs.some((r) => r.media !== null)).toBe(false) // nenhum @media reabre a elipse
    expect(rs.some((r) => r.container !== null && r.d['text-overflow'] === 'ellipsis')).toBe(false) // nem @container
    expect(rs.some((r) => r.container !== null)).toBe(true) // sinal positivo: as regras do cartao estreito existem e ficam fora do efetivo
  })
})

describe('Item 6: barra Salvar no celular (gestaoPerfilEditor.css)', () => {
  const sum = '.prototype-perfil-editor .sticky-sum'
  it('fora do @media a barra e display:flex (a regra display:none de antes e vencida pela posterior)', () => {
    const rs = regras(editorCss, sum).filter((r) => r.media === null && r.d.display)
    expect(rs.map((r) => r.d.display)).toEqual(['none', 'flex']) // sinal positivo: o none existe e vem antes
    expect(efetivo(rs)).toHaveProperty('display', 'flex')
  })
  it('no @media (max-width: 767px): sum-membros some e sum-resto quebra linha sem cortar', () => {
    const doMovel = (s) => regras(editorCss, s).filter((r) => r.media === '(max-width: 767px)')
    const membros = doMovel(`${sum} .sum-membros`)
    expect(membros).toHaveLength(1) // sinal positivo
    expect(membros[0].d.display).toBe('none')
    const resto = doMovel(`${sum} .sum-resto`)
    expect(resto).toHaveLength(1)
    expect(resto[0].d['white-space']).toBe('normal') // quebra linha: o texto inteiro aparece
    expect(resto[0].d.overflow).toBeUndefined() // sem corte
    expect(resto[0].d['text-overflow']).toBeUndefined() // sem reticencias, como pedido
    // fora do @media nenhuma regra esconde sum-membros nem trava sum-resto
    expect(regras(editorCss, `${sum} .sum-membros`).filter((r) => r.media === null)).toHaveLength(0)
    expect(regras(editorCss, `${sum} .sum-resto`).filter((r) => r.media === null)).toHaveLength(0)
  })
})
