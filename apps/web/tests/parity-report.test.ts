import { describe, expect, it } from 'vitest'
import {
  agrees,
  imageSrcs,
  notAppReason,
  sliceSections,
  verdict,
  visibleText,
} from '../../../scripts/parity-report.mjs'

/**
 * The report's whole value is that it fails on the difference that shipped:
 * identical markup local and deployed, and every image 500ing on one of them.
 * These cases are that difference, reduced to its smallest form — a passing
 * report on a deployment serving broken images would be worse than no report.
 */
const HTML = `<div data-section="Header"><h1>Hello</h1><img src="/api/media/file/a.png"></div>
<div data-section="HowItWorks"><p>Steps</p></div>`

function env(images: { src: string; ok: boolean; status: number }[], text = 'Hello') {
  return { reachable: true, status: 200, sections: new Map([['Header', { text, images }]]) }
}

describe('page parsing', () => {
  it('attributes an image to the section that renders it', () => {
    const slices = sliceSections(HTML)
    expect([...slices.keys()]).toEqual(['Header', 'HowItWorks'])
    expect(imageSrcs(slices.get('Header'))).toEqual(['/api/media/file/a.png'])
    expect(imageSrcs(slices.get('HowItWorks'))).toEqual([])
  })

  it('ignores inline data images, which cannot 500', () => {
    expect(imageSrcs('<img src="data:image/png;base64,AAA">')).toEqual([])
  })

  it('reads text without script contents', () => {
    expect(visibleText('<p>Hi</p><script>var x = "no"</script>')).toBe('Hi')
  })
})

describe('verdict', () => {
  it('fails a section whose images do not load, and names the first one', () => {
    const v = verdict(env([{ src: '/api/media/file/a.png', ok: false, status: 500 }]), 'Header')
    expect(v.state).toBe('fail')
    expect(v.detail).toContain('/api/media/file/a.png returned 500')
  })

  it('passes a section whose images load', () => {
    expect(verdict(env([{ src: '/a.png', ok: true, status: 200 }]), 'Header').state).toBe('pass')
  })

  it('fails a section that renders but is empty', () => {
    expect(verdict(env([], ''), 'Header').state).toBe('fail')
  })

  it('fails a section the page did not render at all', () => {
    expect(verdict(env([]), 'Footer').state).toBe('fail')
  })

  it('fails every section when the environment is unreachable', () => {
    const v = verdict({ reachable: false, status: 0, error: 'ECONNREFUSED' }, 'Header')
    expect(v.state).toBe('fail')
    expect(v.detail).toContain('ECONNREFUSED')
  })

  it('reports a skipped environment as skipped, not as a pass', () => {
    expect(verdict(null, 'Header').state).toBe('skipped')
  })

  it('blames the URL, not the sections, when the URL did not serve this app', () => {
    const v = verdict(
      {
        reachable: true,
        servedApp: false,
        status: 200,
        detail: 'redirected to https://vercel.com',
      },
      'Header',
    )
    expect(v.state).toBe('fail')
    expect(v.detail).toContain('redirected to https://vercel.com')
    expect(v.detail).not.toContain('section not rendered')
  })
})

/**
 * The case this exists for: a protected Vercel deployment answers 200 with a
 * login page, which has no section markers. Reported per-section that reads as
 * eleven broken sections; the defect is the URL.
 */
describe('did the URL serve this app', () => {
  it('accepts a page that carries section markers', () => {
    expect(
      notAppReason('https://x.app', { status: 200, body: HTML, finalUrl: 'https://x.app/' }),
    ).toBe(null)
  })

  it('names the host it was redirected to', () => {
    const why = notAppReason('https://preview.vercel.app', {
      status: 200,
      body: '<h1>Log in to Vercel</h1>',
      finalUrl: 'https://vercel.com/login?next=%2F',
    })
    expect(why).toContain('redirected to https://vercel.com')
    expect(why).toContain('protected deployment or wrong URL')
  })

  it('reports a same-origin page with no markers as not this app', () => {
    const why = notAppReason('https://x.app', {
      status: 200,
      body: '<h1>Parked domain</h1>',
      finalUrl: 'https://x.app/',
    })
    expect(why).toContain('no section markers')
  })
})

describe('agreement', () => {
  it('does not agree when one environment fails', () => {
    expect(agrees(['pass', 'pass', 'fail'])).toBe(false)
  })

  it('agrees when an unvouched design reference is the only difference', () => {
    expect(agrees(['warn', 'pass', 'pass'])).toBe(true)
  })

  it('ignores skipped columns rather than counting them as a difference', () => {
    expect(agrees(['pass', 'skipped', 'pass'])).toBe(true)
  })

  it('agrees when every environment fails the same way', () => {
    expect(agrees(['fail', 'fail', 'fail'])).toBe(true)
  })
})
