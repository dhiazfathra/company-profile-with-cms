import { readdir, readFile } from 'node:fs/promises'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import manifest from '@/site.manifest.json'
import { ordinal } from '@/lib/ordinal'

const globals = manifest.sections.filter((s) => s.kind === 'global')
const collections = manifest.sections.filter((s) => s.kind === 'collection')

const sourceOf = (name: string) => readFile(`components/sections/${name}.tsx`, 'utf8')

/** Every `_en` value in a global's content file — the copy that must not be inlined. */
async function copyOf(name: string): Promise<string[]> {
  const raw = JSON.parse(await readFile(`content/globals/${name}.json`, 'utf8'))
  return Object.entries(raw)
    .filter(([key]) => key.endsWith('_en'))
    .map(([, value]) => String(value))
}

describe('sections', () => {
  it('default-exports a component for every global section in the manifest', async () => {
    for (const section of globals) {
      const mod = await import(`@/components/sections/${section.name}`)
      expect(mod.default, `${section.name} must default-export a component`).toBeTypeOf('function')
    }
  })

  it('renders no component for a collection section', async () => {
    const files = await readdir('components/sections')
    const names = files.map((f) => f.replace(/\.tsx$/, ''))
    expect(names.sort()).toEqual(globals.map((s) => s.name).sort())
  })

  it('reads every collection section in exactly one component', async () => {
    const files = await readdir('components/sections')
    const sources = await Promise.all(
      files.map(async (f) => readFile(`components/sections/${f}`, 'utf8')),
    )

    for (const section of collections) {
      const readers = sources.filter((s) => s.includes(`getCollection('${section.name}')`))
      expect(readers, `${section.name} must be read by exactly one component`).toHaveLength(1)
    }
  })

  it('renders global content from the seed', async () => {
    for (const section of globals) {
      const mod = await import(`@/components/sections/${section.name}`)
      const { container } = render(await mod.default())
      for (const value of await copyOf(section.name)) {
        // Image alt text is an attribute, not text content.
        expect(container.innerHTML, `${section.name} must render ${value}`).toContain(
          value.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
        )
      }
    }
  })

  it('contains no hardcoded copy in any component source', async () => {
    for (const section of globals) {
      // The section name is a legitimate identifier in its own source (imports,
      // getGlobal/getCollection arguments), so scrub it before scanning for copy.
      // Cost: copy that is exactly the section name — Benefits' eyebrow — cannot
      // be caught here, which is the narrowest possible blind spot.
      const source = (await sourceOf(section.name)).replaceAll(section.name, '')
      for (const value of await copyOf(section.name)) {
        expect(source, `${section.name}.tsx must not inline ${value}`).not.toContain(value)
      }
    }
  })

  it('never reads a locale-suffixed key', async () => {
    const files = await readdir('components/sections')
    for (const file of files) {
      expect(await readFile(`components/sections/${file}`, 'utf8')).not.toMatch(/_en\b/)
    }
  })
})

describe('ordinal', () => {
  it('formats the array index as a two-digit marker', () => {
    expect([0, 1, 9].map(ordinal)).toEqual(['01', '02', '10'])
  })
})
