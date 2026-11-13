// @vitest-environment node
// Menu fio dourado (D1, D2): regras de CSS lidas do arquivo real, com esperado escrito a mao.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url))
const indexCss = postcss.parse(fs.readFileSync(path.resolve(RAIZ, 'src/styles/index.css'), 'utf8'))

const norm = (s) => String(s).replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()

// Regras cuja lista de seletores e EXATAMENTE `lista` (ordem do arquivo); media = params do @media que contem, ou null.
function regras(lista) {
  const out = []
  indexCss.walkRules((r) => {
    if (r.selectors.map((s) => s.trim()).join(',') !== lista) return
    const m = r.parent && r.parent.type === 'atrule' && r.parent.name === 'media' ? r.parent.params : null
    const d = {}
    r.walkDecls((x) => { d[x.prop] = norm(x.value) })
    out.push({ media: m, d })
  })
  return out
}
const unica = (lista, media = null) => {
  const rs = regras(lista).filter((r) => r.media === media)
  expect(rs, `regra ${lista}`).toHaveLength(1) // sinal positivo: a regra existe
  return rs[0].d
}

describe('D1: fio da marca (menu aberto)', () => {
  it('.procedi-marca::after vai ate a borda (right 0) com o gradiente dourado exato', () => {
    const d = unica('.procedi-marca::after')
    expect(d.right).toBe('0')
    expect(d.left).toBe('24px')
    expect(d.height).toBe('1px')
    expect(d.background).toBe('linear-gradient(90deg, #c6a15b 0, #c6a15b 34px, rgba(198, 161, 91, 0.45) 60%, #c6a15b 100%)')
  })
})

describe('D2: fio da marca recolhida', () => {
  it('.procedi-marca--recolhida::after: left 14px, right 0, gradiente dourado', () => {
    const d = unica('.procedi-marca--recolhida::after')
    expect(d.left).toBe('14px')
    expect(d.right).toBe('0')
    expect(d.background).toBe('linear-gradient(90deg, rgba(198, 161, 91, 0.25), #c6a15b)')
  })
})

describe('Botao do menu (.procedi-menu-botao)', () => {
  it('base: 30x30, borda 1.5px dourada, fundo branco, cor verde, sombra e transicao de 160ms', () => {
    const d = unica('.procedi-menu-botao')
    expect(d.width).toBe('30px')
    expect(d.height).toBe('30px')
    expect(d.border).toBe('1.5px solid #c6a15b')
    expect(d.background).toBe('#fff')
    expect(d.color).toBe('#0d7a5f')
    expect(d['box-shadow']).toBe('0 2px 8px rgba(198, 161, 91, .28)')
    expect(d.transition).toBe('background-color 160ms, border-color 160ms, color 160ms, transform 160ms, box-shadow 160ms')
  })

  it('hover e focus-visible: fundo e borda #0d7a5f, texto #fff, scale(1.1)', () => {
    const d = unica('.procedi-menu-botao:hover,.procedi-menu-botao:focus-visible')
    expect(d.background).toBe('#0d7a5f')
    expect(d['border-color']).toBe('#0d7a5f')
    expect(d.color).toBe('#fff')
    expect(d.transform).toBe('scale(1.1)')
  })

  it('so :hover troca a sombra (o anel de foco e box-shadow e nao pode sumir)', () => {
    expect(unica('.procedi-menu-botao:hover')['box-shadow']).toBe('0 4px 12px rgba(13, 122, 95, .3)')
    expect(unica('.procedi-menu-botao:hover,.procedi-menu-botao:focus-visible')['box-shadow']).toBeUndefined()
  })

  it('::before amplia o toque para 44x44 (top/bottom -8.5px, left -1.5px, right -15.5px)', () => {
    const d = unica('.procedi-menu-botao::before')
    expect(d.position).toBe('absolute')
    expect(d.top).toBe('-8.5px')
    expect(d.bottom).toBe('-8.5px')
    expect(d.left).toBe('-1.5px')
    expect(d.right).toBe('-15.5px')
    // 30 (miolo) + 2*8.5 = 47 menos borda 1.5*2 = 44 de altura; 30 + 1.5 + 15.5 - 3 = 44 de largura
    expect(30 + 8.5 + 8.5 - 3).toBe(44)
    expect(30 + 1.5 + 15.5 - 3).toBe(44)
  })

  it('prefers-reduced-motion: reduce desliga transicao e transform', () => {
    const m = '(prefers-reduced-motion: reduce)'
    expect(unica('.procedi-menu-botao', m).transition).toBe('none')
    expect(unica('.procedi-menu-botao:hover,.procedi-menu-botao:focus-visible', m).transform).toBe('none')
  })
})
