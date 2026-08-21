// GENERATED FILE — do not edit by hand.
// Source of truth: site.manifest.json. Regenerate with `bun run gen:cms`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const Users = {
  slug: 'users',
  auth: true,
  fields: [],
}

const Media = {
  slug: 'media',
  upload: true,
  fields: [],
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
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
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
