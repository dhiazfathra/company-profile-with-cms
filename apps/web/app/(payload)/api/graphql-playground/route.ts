import { GRAPHQL_PLAYGROUND_GET } from '@payloadcms/next/routes'
import config from '@/payload.config'

/**
 * The GraphQL playground, reachable only outside production.
 *
 * Payload's own `graphQL.disablePlaygroundInProduction` defaults to on, so this
 * is belt to that braces — but it is the belt that is checked in here, next to
 * the route, rather than a default in a dependency that a minor release can
 * change without this repository noticing. The playground renders a full schema
 * browser for every collection and global on the site; the access rules still
 * apply to what it can *read*, so this is not an authorization fix, it is
 * removing a free map of the data model from anyone scanning the deployment.
 *
 * 404 rather than 403: a 403 confirms the route exists.
 */
const playground = GRAPHQL_PLAYGROUND_GET(config)

export const GET =
  process.env.NODE_ENV === 'production'
    ? async () => new Response('Not Found', { status: 404 })
    : playground
