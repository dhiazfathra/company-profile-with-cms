import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

async function loadConfig() {
  vi.resetModules()
  return import('@/payload.config')
}

describe('payload secret', () => {
  it('throws in production when PAYLOAD_SECRET is unset', async () => {
    delete process.env.PAYLOAD_SECRET
    process.env.NODE_ENV = 'production'
    await expect(loadConfig()).rejects.toThrow(/PAYLOAD_SECRET must be set in production/)
  })

  it('uses the dev fallback outside production when PAYLOAD_SECRET is unset', async () => {
    delete process.env.PAYLOAD_SECRET
    process.env.NODE_ENV = 'test'
    const config = (await loadConfig()).default
    const resolved = await config
    expect(resolved.secret).toBe('dev-secret-change-me')
  })

  it('uses PAYLOAD_SECRET when set, even in production', async () => {
    process.env.PAYLOAD_SECRET = 'super-secret'
    process.env.NODE_ENV = 'production'
    const config = (await loadConfig()).default
    const resolved = await config
    expect(resolved.secret).toBe('super-secret')
  })
})
