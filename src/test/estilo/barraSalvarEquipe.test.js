// @vitest-environment node
// Barra Salvar do editor de perfil (D4 + decisao 6): CSS lido do arquivo real, esperado escrito a mao.
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

const css = lerCss('src/components/configuracoes/gestaoPerfilEditor.css')
const ED = '.prototype-perfil-editor'
const SUM = `${ED} .sticky-sum`
const M767 = '(max-width: 767px)'
const M399 = '(max-width: 399px)'
const em = (sel, media) => regras(css, sel).filter((r) => r.media === media && r.container === null)
const unica = (sel, media, prop) => {
  const rs = em(sel, media).filter((r) => !prop || r.d[prop] !== undefined)
  expect(rs).toHaveLength(1) // sinal positivo: a regra existe
  return rs[0].d
}

describe('barra Salvar: dentro de @media (max-width: 767px)', () => {
  it('.sum-sep some; .sum-txt ocupa a linha toda', () => {
    expect(unica(`${SUM} .sum-sep`, M767).display).toBe('none')
    expect(unica(`${SUM} .sum-txt`, M767).flex).toBe('0 0 100%')
  })
  it('botoes: min-height 44px e flex 1 1 auto', () => {
    const d = unica(`${SUM} button`, M767)
    expect(d['min-height']).toBe('44px')
    expect(d.flex).toBe('1 1 auto')
  })
  it('.prototype-perfil-editor tem padding-bottom 96px', () => {
    expect(unica(ED, M767, 'padding-bottom')['padding-bottom']).toBe('96px')
  })
  it('nenhuma regra da barra traz font-size nem padding de botao nesse @media', () => {
    const botoes = em(`${SUM} button`, M767)
    expect(botoes).toHaveLength(1)
    expect(botoes[0].d).not.toHaveProperty('font-size')
    expect(botoes[0].d).not.toHaveProperty('padding')
    let achou = 0
    css.walkRules((r) => {
      if (!r.selectors.some((s) => s.includes('.sticky-sum'))) return
      const p = r.parent
      if (!(p.type === 'atrule' && p.name === 'media' && p.params === M767)) return
      achou++
      r.walkDecls((x) => { expect(x.prop, r.selector).not.toBe('font-size') })
      if (r.selector.trim() !== SUM) r.walkDecls((x) => { expect(x.prop, r.selector).not.toMatch(/^padding/) }) // o padding da propria barra (10px 16px) nao e de botao
    })
    expect(achou).toBeGreaterThanOrEqual(6)
  })
})

describe('barra Salvar: fora de @media', () => {
  it('.sum-txt flex 1 e .prototype-perfil-editor padding-bottom 72px', () => {
    expect(unica(`${SUM} .sum-txt`, null).flex).toBe('1')
    expect(unica(ED, null, 'padding-bottom')['padding-bottom']).toBe('72px')
  })
})

describe('barra Salvar: dentro de @media (max-width: 399px)', () => {
  it('.sum-btn-ico some', () => {
    expect(unica(`${SUM} .sum-btn-ico`, M399).display).toBe('none')
    expect(em(`${SUM} .sum-btn-ico`, null)).toHaveLength(0) // fora do @media o icone nao e escondido
  })
})
