// @vitest-environment node
import { describe, it, expect } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import config from '../../../tailwind.config.js'

const MEDIA = '(max-width: 1023px), (pointer: coarse)'

async function compilar() {
  const cfg = { ...config, content: [{ raw: '<a class="h-10 toque:h-11 font-brand">' }] }
  const r = await postcss([tailwindcss(cfg)]).process('@tailwind utilities;', { from: undefined })
  return r.root
}

describe('variante toque e fonte brand', () => {
  it('toque:h-11 só existe dentro do @media de tela estreita ou toque', async () => {
    const root = await compilar()
    const dentro = []
    root.walkRules(String.raw`.toque\:h-11`, (rule) => dentro.push(rule.parent))
    expect(dentro).toHaveLength(1)
    expect(dentro[0].type).toBe('atrule')
    expect(dentro[0].params).toBe(MEDIA)
  })

  it('fora de @media só h-10: mouse >= 1024px não ganha altura', async () => {
    const root = await compilar()
    const soltas = []
    root.each((n) => { if (n.type === 'rule') soltas.push(n.selector) })
    expect(soltas.filter((s) => /h-1/.test(s))).toEqual(['.h-10'])
    root.each((n) => { if (n.type === 'rule') expect(n.toString()).not.toContain('2.75rem') })
  })

  it('font-brand gera Cormorant Garamond', async () => {
    const root = await compilar()
    let ff
    root.walkRules('.font-brand', (r) => r.walkDecls('font-family', (d) => { ff = d.value }))
    expect(ff).toBe('"Cormorant Garamond", serif')
  })
})
