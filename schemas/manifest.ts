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
  fields: z.array(FieldSchema).min(1, 'sections must have at least one field'),
}).refine((section) => {
  const seen = new Set<string>()
  for (const field of section.fields) {
    if (seen.has(field.name)) {
      return false
    }
    seen.add(field.name)
  }
  return true
}, 'duplicate field name')

const baseSchema = z.object({
  locales: z.array(z.string().regex(LOCALE)).min(1),
  tokens: z.record(z.string(), z.unknown()),
  sections: z.array(SectionSchema).min(1),
})

const validatedSchema = baseSchema
  .refine((manifest) => manifest.locales[0] === 'en', {
    message: 'locales[0] must be "en" (the default locale)',
    path: ['locales'],
  })
  .refine((manifest) => {
    const seen = new Set<string>()
    for (const section of manifest.sections) {
      if (seen.has(section.name)) {
        return false
      }
      seen.add(section.name)
    }
    return true
  }, 'duplicate section name')

// Wrapper to throw Error with plain message strings for test compatibility
class ManifestValidator {
  parse(data: unknown) {
    try {
      return validatedSchema.parse(data)
    } catch (e: any) {
      if (e.issues) {
        const message = e.issues.map((issue: any) => issue.message).join('; ')
        const error = new Error(message)
        throw error
      }
      throw e
    }
  }

  safeParse(data: unknown) {
    return validatedSchema.safeParse(data)
  }
}

export const ManifestSchema = new ManifestValidator() as any

export type Manifest = z.infer<typeof validatedSchema>
export type Section = Manifest['sections'][number]
export type Field = Section['fields'][number]
