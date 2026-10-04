import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('assets/css/main.css', 'utf8')

function tokens(block: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  for (const m of block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
  return out
}

const light = tokens(css.slice(css.indexOf(':root'), css.indexOf("[data-theme='dark']")))
const dark = { ...light, ...tokens(css.slice(css.indexOf("[data-theme='dark']"))) }

function lum([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background] pairs the redesign renders as text.
const PAIRS: [string, string][] = [
  ['on-accent', 'accent'], ['ink', 'surface'], ['ink', 'paper'], ['muted', 'surface'], ['muted', 'paper'],
  ['due', 'due-soft'], ['graduated', 'accent-soft'], ['accent', 'accent-soft'],
  ['error', 'surface'], ['error', 'error-soft'], ['muted', 'sunken'], ['ink', 'sunken'],
]

describe('WCAG AA contrast for redesign text pairs', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`${theme}: ${fg} on ${bg} ≥ 4.5`, () => {
        expect(t[fg], `missing --${fg}`).toBeDefined()
        expect(t[bg], `missing --${bg}`).toBeDefined()
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
      })
    }
    it(`${theme}: white on navy (stats hero, toast) ≥ 4.5`, () => {
      expect(ratio([255, 255, 255], t.navy)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
