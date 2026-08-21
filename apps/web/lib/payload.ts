import { getPayload as getPayloadInstance, type Payload } from 'payload'
import config from '@/payload.config'

let cached: Promise<Payload> | undefined

/** One Payload instance per process, per Payload's own recommendation. */
export function getPayload(): Promise<Payload> {
  if (!cached) {
    const initialized = getPayloadInstance({ config })
    cached = initialized
    // Clear the cache on rejection so a later request can retry
    // initialization instead of every request failing until restart.
    void initialized.catch(() => {
      if (cached === initialized) cached = undefined
    })
  }
  return cached
}
