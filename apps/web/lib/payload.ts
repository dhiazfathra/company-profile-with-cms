import { getPayload as getPayloadInstance, type Payload } from 'payload'
import config from '@/payload.config'

let cached: Promise<Payload> | undefined

/** One Payload instance per process, per Payload's own recommendation. */
export function getPayload(): Promise<Payload> {
  if (!cached) {
    cached = getPayloadInstance({ config })
  }
  return cached
}
