/**
 * The report stylesheet, shared by `bun run evidence` and `bun run
 * parity-report`. One copy, because the two reports are read side by side and a
 * reader should not have to work out whether a visual difference between them
 * means anything.
 */
export const REPORT_CSS = `<style>
  :root { --bg:#fbfbfa; --panel:#fff; --ink:#1a1a19; --muted:#6b6b66; --line:#e4e4e0; --ok:#1f7a4d; --code:#f4f4f1 }
  @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {
    --bg:#17181a; --panel:#1f2124; --ink:#ececea; --muted:#9a9a95; --line:#32353a; --ok:#4dd08a; --code:#14161a } }
  :root[data-theme='dark'] {
    --bg:#17181a; --panel:#1f2124; --ink:#ececea; --muted:#9a9a95; --line:#32353a; --ok:#4dd08a; --code:#14161a }
  body { background:var(--bg); color:var(--ink); margin:0;
    font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif }
  main { max-width:980px; margin:0 auto; padding:48px 24px 96px }
  h1 { font-size:28px; letter-spacing:-.02em; margin:0 0 6px }
  h2 { font-size:19px; margin:48px 0 12px; letter-spacing:-.01em }
  p,li { max-width:68ch }
  .lede { color:var(--muted); margin:0 0 32px }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px }
  .card b { display:block; font-size:24px; letter-spacing:-.02em }
  .card span { color:var(--muted); font-size:13px }
  pre { background:var(--code); border:1px solid var(--line); border-radius:10px; padding:14px 16px;
    overflow-x:auto; font-size:12.5px; line-height:1.5 }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace }
  .sec { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px; margin:16px 0 }
  .sec header { display:flex; flex-wrap:wrap; gap:10px; align-items:baseline;
    justify-content:space-between; margin-bottom:12px }
  .sec h3 { margin:0; font-size:16px }
  .meta { color:var(--muted); font-size:12.5px; font-family:ui-monospace,Menlo,monospace }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:14px }
  @media (max-width:640px) { .pair { grid-template-columns:1fr } }
  figure { margin:0 }
  figcaption { color:var(--muted); font-size:12px; margin-bottom:6px }
  img { width:100%; max-width:100%; display:block; border:1px solid var(--line); border-radius:6px }
  .pass { color:var(--ok); font-weight:600 }
  .note { border-left:3px solid var(--line); padding-left:14px; color:var(--muted) }
  table { border-collapse:collapse; width:100%; font-size:14px }
  th,td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top }
  th { color:var(--muted); font-weight:600; font-size:12.5px }
  .scroll { overflow-x:auto }
</style>`
