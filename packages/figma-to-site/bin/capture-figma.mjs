#!/usr/bin/env node
/**
 * Capture Figma nodes as PNGs, from a config file.
 *
 * Usage: figma-capture [--config <path>] [--crop-only] [name ...]
 *   --config      capture config JSON (default design/figma.targets.json)
 *   --crop-only   re-crop the raw captures already on disk, no network
 *   name ...      capture only these targets (default: all)
 *
 * The config is per-project data, not code:
 *
 *   {
 *     "fileKey": "…",              the key in the Figma URL
 *     "fileName": "Modern-Product-Launch",
 *     "rawDir": "design/captures", raw canvas captures, kept for --crop-only
 *     "targets": [
 *       { "name": "Header", "node": "1-122", "w": 1200, "h": 362,
 *         "crop": { "dx": 149, "dy": -139, "w": 904, "h": 501 },
 *         "out": "public/img/header.png" }
 *     ]
 *   }
 *
 * `w`/`h` are the size of the node `node` selects, in design px — read off a
 * Figma size badge or a frame, never inferred from how a downscaled reference
 * looks. See SKILL.md.
 */
import { readFile } from 'node:fs/promises'
import { captureAll } from '../src/capture.mjs'

const argv = process.argv.slice(2)
const configIndex = argv.indexOf('--config')
const configPath = configIndex === -1 ? 'design/figma.targets.json' : argv[configIndex + 1]
if (configIndex !== -1 && !configPath) {
  console.error('--config needs a path')
  process.exit(1)
}
const cropOnly = argv.includes('--crop-only')
const only = argv.filter((a, i) => !a.startsWith('--') && i !== configIndex + 1)

let config
try {
  config = JSON.parse(await readFile(configPath, 'utf8'))
} catch (error) {
  console.error(`cannot read capture config ${configPath}: ${error.message}`)
  process.exit(1)
}

const log = ({ out, cw, ch, resizeTo, healed }) => {
  const notes = [resizeTo ? `-> ${resizeTo}px` : '', healed ? `healed ${healed} outline px` : '']
  console.log(`${out}  ${cw}x${ch} ${notes.filter(Boolean).join(' ')}`.trimEnd())
}

let outcome
try {
  outcome = await captureAll(config, { only, cropOnly, log })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

for (const { name, message } of outcome.failures) console.error(`${name}: ${message}`)
if (outcome.failures.length) {
  console.error(`\n${outcome.failures.length} of ${outcome.failures.length + outcome.results.length} targets failed.`)
  process.exit(1)
}
