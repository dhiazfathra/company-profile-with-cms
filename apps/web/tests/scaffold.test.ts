import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('rejects the installed Node runtime if it falls below the pinned floor', () => {
    const result = execFileSync(
      'node',
      ['-e', "console.log(process.version.slice(1).split('.').map(Number).join('.'))"],
      { encoding: 'utf-8' },
    ).trim()

    const [major, minor] = result.split('.').map(Number)
    expect(major > 20 || (major === 20 && minor >= 9)).toBe(true)
  })

  it('routes `bun run test` to the vitest binary, not `bun test`', () => {
    const output = execFileSync('bun', ['run', 'test', '--', '--help'], {
      encoding: 'utf-8',
    })
    expect(output).toMatch(/vitest/i)
  })
})
