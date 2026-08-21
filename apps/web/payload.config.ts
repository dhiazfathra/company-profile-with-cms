// GENERATED FILE — do not edit by hand.
// Source of truth: site.manifest.json. Regenerate with `bun run gen:cms`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type CollectionConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

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
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./payload.db',
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
})
