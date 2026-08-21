import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = path.join(__dirname, '..')

test.describe('validate-manifest CLI', () => {
  let tmp: string

  test.beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'manifest-e2e-'))
  })

  test.afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('missing manifest exits 1 with a controlled message', () => {
    // bun run validate:manifest needs package.json's script in scope; run via
    // the repo's node_modules but a cwd with no manifest file present.
    const result = execScript(tmp)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('site.manifest.json')
    expect(result.stderr).not.toContain(' at ') // no stack trace
  })

  test('malformed JSON exits 1 with a controlled message', () => {
    writeFileSync(path.join(tmp, 'site.manifest.json'), '{ not json')
    const result = execScript(tmp)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('not valid JSON')
  })

  test('valid manifest exits 0 and prints the section count', () => {
    const manifest = {
      locales: ['en'],
      tokens: {},
      sections: [
        { name: 'Hero', kind: 'global', fields: [{ name: 'headline', type: 'text', translatable: true }] },
        { name: 'Feature', kind: 'collection', fields: [{ name: 'title', type: 'text', translatable: true }] },
      ],
    }
    writeFileSync(path.join(tmp, 'site.manifest.json'), JSON.stringify(manifest))
    const result = execScript(tmp)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('2 sections')
  })

  test('invalid manifest (duplicate section names) exits 1 and names the offending path', () => {
    const manifest = {
      locales: ['en'],
      tokens: {},
      sections: [
        { name: 'Hero', kind: 'global', fields: [{ name: 'headline', type: 'text', translatable: true }] },
        { name: 'Hero', kind: 'global', fields: [{ name: 'headline', type: 'text', translatable: true }] },
      ],
    }
    writeFileSync(path.join(tmp, 'site.manifest.json'), JSON.stringify(manifest))
    const result = execScript(tmp)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('duplicate section name')
  })
})

function execScript(cwd: string) {
  // Run the CLI via its tsx binary directly with cwd set to the temp dir, so
  // path.join(process.cwd(), 'site.manifest.json') resolves there.
  try {
    const stdout = execFileSync(
      path.join(repoRoot, 'node_modules/.bin/tsx'),
      [path.join(repoRoot, 'scripts/validate-manifest.ts')],
      { cwd, encoding: 'utf8' },
    )
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string }
    return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
  }
}
