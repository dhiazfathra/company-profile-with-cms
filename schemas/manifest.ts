import { z } from 'zod'

const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/

const FieldSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'field name must be lowerCamelCase')
    .refine((n) => !LOCALE.test(n.split('_').pop() ?? ''), {
      message: 'field name must not include a locale suffix; set translatable instead',
    }),
  type: z.enum(['text', 'richText', 'url', 'image', 'number']),
  translatable: z.boolean(),
})

const SectionSchema = z.object({
  name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/, 'section name must be PascalCase'),
  kind: z.enum(['global', 'collection']),
  fields: z.array(FieldSchema).min(1),
}).superRefine((section, ctx) => {
  const seen = new Set<string>()
  for (const field of section.fields) {
    if (seen.has(field.name)) {
      ctx.addIssue({ code: 'custom', message: `duplicate field name: ${field.name}` })
    }
    seen.add(field.name)
  }
})

export const ManifestSchema = z.object({
  locales: z.array(z.string().regex(LOCALE)).min(1),
  tokens: z.record(z.string(), z.unknown()),
  sections: z.array(SectionSchema).min(1),
}).superRefine((manifest, ctx) => {
  if (manifest.locales[0] !== 'en') {
    ctx.addIssue({ code: 'custom', message: 'locales[0] must be "en" (the default locale)' })
  }
  const seen = new Set<string>()
  for (const section of manifest.sections) {
    if (seen.has(section.name)) {
      ctx.addIssue({ code: 'custom', message: `duplicate section name: ${section.name}` })
    }
    seen.add(section.name)
  }
})

export type Manifest = z.infer<typeof ManifestSchema>
export type Section = Manifest['sections'][number]
export type Field = Section['fields'][number]
