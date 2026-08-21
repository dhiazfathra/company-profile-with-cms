/**
 * figma-to-site — capture a Figma design by screenshot, and prove the render
 * matches it.
 *
 * The workflow, its rationale, and the failures that produced each guardrail are
 * in `SKILL.md`. Read that before wiring these functions into a project: several
 * of them are safe only in the arrangement it describes (notably: the chrome
 * assertion belongs on the single path every crop returns through, and the trust
 * manifest must be able to *withhold* a check, not only relax it).
 */
export {
  assertNoViewerChrome,
  cropRelative,
  cropToSelection,
  findSelection,
  findViewerChrome,
  healOutlines,
} from './figma-crop.mjs'

export {
  ASPECT_TOLERANCE,
  BLOCK_TOLERANCE,
  DEFAULT_REFS_DIR,
  awaitImages,
  checkSection,
  loadManifest,
  screenshotSection,
} from './design-check.mjs'

export { captureAll, captureTarget, recrop, validateConfig } from './capture.mjs'
export { scanAssets } from './scan-assets.mjs'
