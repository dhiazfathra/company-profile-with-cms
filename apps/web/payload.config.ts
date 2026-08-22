// GENERATED FILE — do not edit by hand.
// Source of truth: site.manifest.json. Regenerate with `bun run gen:cms`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type CollectionConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [],
}

const Media: CollectionConfig = {
  slug: 'media',
  upload: true,
  // Public marketing site: every section renders an <img> from this
  // collection, so reads must not require auth (Payload's default access
  // blocks unauthenticated requests, which 403'd every image on the page).
  access: {
    read: () => true,
  },
  fields: [
    {
      // The seed's identity for an asset, and the reason it is not the
      // filename: /icons/logo.png and /img/logo.png share a basename, so a
      // filename lookup would hand the second field the first file's image and
      // nothing would report it. Unique, so the database refuses a collision
      // rather than resolving it silently.
      name: 'sourcePath',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'public/-relative path this asset was seeded from' },
    },
  ],
}

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor(),
  // A bundled sqlite file works locally and cannot work on a serverless host:
  // the deployment filesystem is read-only apart from a per-invocation /tmp, so
  // an editor's save either fails or disappears with the invocation. A hosted
  // libSQL database (Turso and similar) is the same adapter with a remote URL,
  // which is why DATABASE_AUTH_TOKEN is plumbed through — without it a remote
  // url cannot authenticate and the default file: path is the only thing that
  // works. Deploying with the default is the failure mode to avoid.
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./payload.db',
      ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
    },
  }),
  secret: (() => {
    if (process.env.PAYLOAD_SECRET) return process.env.PAYLOAD_SECRET
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAYLOAD_SECRET must be set in production')
    }
    return 'dev-secret-change-me'
  })(),
  localization: {
    locales: ['en'],
    defaultLocale: 'en',
  },
  collections: [
    Users,
    Media,
    {
      slug: 'NavigationItem',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
        },
        {
          name: 'href',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
    {
      slug: 'LogoCloudLogo',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'name',
          type: 'text',
          localized: true,
        },
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      slug: 'BenefitsItem',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'title',
          type: 'text',
          localized: true,
        },
        {
          name: 'body',
          type: 'text',
          localized: true,
        },
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      slug: 'FeaturesCarouselItem',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'SpecificationsCell',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'column',
          type: 'text',
        },
        {
          name: 'row',
          type: 'number',
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
        },
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'iconAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'HowItWorksStep',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'title',
          type: 'text',
          localized: true,
        },
        {
          name: 'body',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'FooterLink',
      fields: [
        {
          name: '_seedIndex',
          type: 'number',
          unique: true,
          admin: {
            hidden: true,
          },
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
        },
        {
          name: 'href',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
  ],
  globals: [
    {
      slug: 'Navigation',
      fields: [
        {
          name: 'logoText',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaHref',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
    {
      slug: 'Header',
      fields: [
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imageAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'LogoCloud',
      fields: [
        {
          name: 'heading',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'Benefits',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          localized: true,
        },
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'subhead',
          type: 'text',
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imageAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'FeaturesCarousel',
      fields: [
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'subhead',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaHref',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imageAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'Specifications',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          localized: true,
        },
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'body',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaHref',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
    {
      slug: 'Testimonial',
      fields: [
        {
          name: 'quote',
          type: 'text',
          localized: true,
        },
        {
          name: 'authorName',
          type: 'text',
          localized: true,
        },
        {
          name: 'authorRole',
          type: 'text',
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imageAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'HowItWorks',
      fields: [
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaHref',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
    {
      slug: 'ShowcaseImage',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imageAlt',
          type: 'text',
          localized: true,
        },
      ],
    },
    {
      slug: 'CenteredCta',
      fields: [
        {
          name: 'headline',
          type: 'text',
          localized: true,
        },
        {
          name: 'body',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'ctaHref',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            return (
              /^(\/|#|https?:\/\/)/.test(String(value)) ||
              'Must be a relative path, an anchor, or an absolute URL'
            )
          },
        },
      ],
    },
    {
      slug: 'Footer',
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'logoAlt',
          type: 'text',
          localized: true,
        },
        {
          name: 'copyright',
          type: 'text',
          localized: true,
        },
      ],
    },
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Uploads land on local disk by default, in apps/web/media/ — correct
  // locally, and the second thing after DATABASE_URI that a serverless host
  // breaks without failing the build: the media *rows* live in the remote
  // database and survive, while the *files* stay on whichever machine ran the
  // seed. Every <img> on the page then 500s from /api/media/file/... on a
  // deployment whose build was green. Blob storage moves the files off the
  // filesystem, so it is required in production for the same reason
  // PAYLOAD_SECRET is: a deployment that would serve broken images should
  // fail to build instead.
  plugins: [
    ...(process.env.BLOB_READ_WRITE_TOKEN
      ? [
          vercelBlobStorage({
            collections: { [Media.slug]: true },
            token: process.env.BLOB_READ_WRITE_TOKEN,
            // A server-routed upload goes through a Vercel serverless
            // function, capped at 4.5MB — one seeded asset (showcase.png,
            // ~8MB) is already over that on its own. clientUploads sends the
            // file straight from the browser to Blob storage instead, so an
            // editor's upload is not bounded by the function body limit.
            clientUploads: true,
          }),
        ]
      : (() => {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'BLOB_READ_WRITE_TOKEN must be set in production — without it uploaded ' +
                'media files are written to a filesystem the deployment does not keep, ' +
                'and every image 500s while the build stays green.',
            )
          }
          return []
        })()),
  ],
})
