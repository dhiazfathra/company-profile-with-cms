import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'

const script = path.join(process.cwd(), 'scripts/validate-manifest.ts')

function run(cwd: string) {
  try {
    execFileSync('bunx', ['tsx', script], { cwd, encoding: 'utf8', stdio: 'pipe' })
    return { status: 0, stderr: '' }
  } catch (err) {
    const e = err as { status: number; stderr: Buffer }
    return { status: e.status, stderr: e.stderr.toString() }
  }
}

describe('validate-manifest CLI', () => {
  let dir: string

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('exits 1 with a controlled message when site.manifest.json is missing', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'validate-manifest-'))
    const { status, stderr } = run(dir)
    expect(status).toBe(1)
    expect(stderr).toMatch(/Cannot read/)
    expect(stderr).not.toMatch(/at Object|node:internal|ENOENT/)
  })

  it('exits 1 with a controlled message when site.manifest.json is malformed JSON', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'validate-manifest-'))
    writeFileSync(path.join(dir, 'site.manifest.json'), '{ not valid json')
    const { status, stderr } = run(dir)
    expect(status).toBe(1)
    expect(stderr).toMatch(/not valid JSON/)
    expect(stderr).not.toMatch(/at Object|node:internal|SyntaxError\n/)
  })
})
