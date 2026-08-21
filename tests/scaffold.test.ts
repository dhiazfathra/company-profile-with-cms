import { describe, expect, it } from 'vitest'
import pkg from '../package.json'

describe('scaffold', () => {
  it('pins the Node floor Payload requires', () => {
    expect(pkg.engines.node).toBe('>=20.9.0')
  })

  it('runs tests through a package script, not bun test', () => {
    expect(pkg.scripts.test).toBe('vitest run')
  })
})
