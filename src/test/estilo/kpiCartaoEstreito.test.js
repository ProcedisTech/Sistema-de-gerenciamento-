// @vitest-environment node
// Indicadores da Gestao de equipe (D5): cartao estreito por container query, CSS lido do arquivo real.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url))
const lerCss = (rel) => postcss.parse(fs.readFileSync(path.resolve(RAIZ, rel), 'utf8'))

// Regras cujo seletor, em lista, e exatamente `sel`, com o @media e o @container que as envolvem (ou null).
function regras(root, sel) {
  const out = []
  root.walkRules((r) => {
    if (!r.selectors.map((s) => s.trim()).includes(sel)) return
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

const css = lerCss('src/components/configuracoes/gestaoEquipe.css')
const KPI = '.prototype-equipe .kpi'
const LABEL = `${KPI} .kpi-label`
const BADGE = `${KPI} .kpi-badge`
const C = '(max-width: 136px)'
const M767 = '(max-width: 767px)'
const unica = (rs) => {
  expect(rs).toHaveLength(1) // sinal positivo: a regra existe
  return rs[0].d
}

describe('D5: cartao estreito (gestaoEquipe.css)', () => {
  it('.kpi e container inline-size', () => {
    const rs = regras(css, KPI).filter((r) => r.d['container-type'])
    expect(unica(rs)['container-type']).toBe('inline-size')
    expect(rs[0].media).toBeNull()
    expect(rs[0].container).toBeNull()
  })
  it('@container (max-width: 136px): selo absoluto em 48px/16px; rotulo com 28px e 0.02em', () => {
    const b = unica(regras(css, BADGE).filter((r) => r.container === C && r.media === null))
    expect(b.position).toBe('absolute')
    expect(b.top).toBe('48px')
    expect(b.right).toBe('16px')
    const l = unica(regras(css, LABEL).filter((r) => r.container === C && r.media === null))
    expect(l['min-height']).toBe('28px')
    expect(l['letter-spacing']).toBe('0.02em')
  })
  it('@media (max-width: 767px) > @container (max-width: 136px): selo em 43px/12px', () => {
    const b = unica(regras(css, BADGE).filter((r) => r.container === C && r.media === M767))
    expect(b.top).toBe('43px')
    expect(b.right).toBe('12px')
  })
  it('fora de qualquer @container o selo nao e absoluto', () => {
    const fora = regras(css, BADGE).filter((r) => r.container === null)
    expect(fora.length).toBeGreaterThan(0) // sinal positivo
    expect(fora.some((r) => r.d.position === 'absolute')).toBe(false)
  })
  it('rotulo: sem reticencias e fonte nunca abaixo de 11px, em qualquer regra', () => {
    const rs = regras(css, LABEL)
    expect(rs.length).toBeGreaterThan(0)
    // cascata: a ultima declaracao de text-overflow entre as regras do rotulo (a conjunta antiga com ellipsis e vencida pela nova)
    expect(rs.filter((r) => r.d['text-overflow']).pop().d['text-overflow']).not.toBe('ellipsis')
    for (const r of rs) {
      if (r.d['font-size']) expect(parseFloat(r.d['font-size'])).toBeGreaterThanOrEqual(11)
    }
    // a regra conjunta (.kpi-label, .kpi small) traz 11px e a ellipsis; vale a que vem depois (item 3 de ondaUltimaPassada).
    const conj = regras(css, `${KPI} small`)
    for (const r of conj.filter((x) => x.d['font-size'])) expect(parseFloat(r.d['font-size'])).toBeGreaterThanOrEqual(11)
  })
})
