import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(import.meta.dirname, '..')

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

const sheets = cssFiles(srcDir).map((path) => ({
  path,
  css: readFileSync(path, 'utf8'),
}))

describe('styles', () => {
  it('finds tokens.css and at least one other stylesheet', () => {
    expect(sheets.some((s) => s.path.endsWith('tokens.css'))).toBe(true)
    expect(sheets.length).toBeGreaterThan(1)
    expect(sheets.every((s) => s.css.length > 0)).toBe(true)
  })

  it('has raw colours only in tokens.css', () => {
    const colour = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/
    for (const { path, css } of sheets) {
      if (path.endsWith('tokens.css')) continue
      expect(css, path).not.toMatch(colour)
    }
  })

  it('defines a dark theme in tokens.css', () => {
    const tokens = sheets.find((s) => s.path.endsWith('tokens.css'))
    expect(tokens?.css).toMatch(/prefers-color-scheme:\s*dark/)
  })
})
