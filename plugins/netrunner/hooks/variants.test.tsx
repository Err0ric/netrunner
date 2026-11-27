import { expect, mock, test } from 'claude-code/testing'

import { lookFor } from './look'
import { VARIANTS, VARIANT_IDS, skinName } from './palettes'

const PLUGIN = 'netrunner'
const band = { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} }
const SKINS = 'mcp__skins__design'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engine = (on: any) => {
  on('session.usage' as never, (() => ({ value: { rateLimits: [{ kind: 'seven_day', percentUsed: 31 }], context: { tokens: 0, window: 0 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  on('session.start' as never, (async () => ({ cwd: '/repo' })) as never)
  mock.store(on)
}

for (const id of VARIANT_IDS) {
  test(`desktop: the ${id} variant colors the band`, { options: { variant: id } }, async ($, on) => {
    mock.clock(on)
    engine(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
    const svgs = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
    const c = VARIANTS[id].band
    // The 7-day bar and the sweep (a turn is running) take the variant's accent; no other variant's accent shows.
    expect(svgs).toContain(c.accent)
    for (const other of VARIANT_IDS.filter(o => o !== id)) expect(svgs).not.toContain(VARIANTS[other].band.accent)
  })
}

test('every variant has a look the desktop app will paint (no text under 3:1)', () => {
  for (const id of VARIANT_IDS) {
    const refused = lookFor(VARIANTS[id]).problems.filter(p => p.startsWith("Desktop won't paint"))
    expect([id, refused]).toEqual([id, []])
  }
})

test('the Netrunner skins are saved once and the chosen one applied once', { options: { variant: 'cold-boot' } }, async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  const calls: { action?: string; name?: string; apply?: boolean }[] = []
  on('tool.call' as never, { tool: SKINS } as never, ((_$: unknown, e: { action?: string; name?: string; apply?: boolean }) => {
    calls.push({ action: e.action, name: e.name, apply: e.apply })
    return { result: 'ok' }
  }) as never)

  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(2000)
  expect(calls.filter(c => c.action === 'save').map(c => c.name)).toEqual(VARIANT_IDS.map(skinName))
  expect(calls.filter(c => c.action === 'save').every(c => c.apply === false)).toBe(true)
  expect(calls.filter(c => c.action === 'apply').map(c => c.name)).toEqual([skinName('cold-boot')])

  // A later start only looks: the skins are there and the choice was applied.
  calls.length = 0
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(2000)
  expect(calls.filter(c => c.action !== 'show')).toEqual([])
})

/** A stand-in skins mod that keeps its made skins and current skin, as the real one does. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSkins = (on: any) => {
  const mod = { made: new Set<string>(), current: 'default', calls: [] as string[] }
  on('tool.call' as never, { tool: SKINS } as never, ((_$: unknown, e: { action?: string; name?: string; apply?: boolean }) => {
    mod.calls.push(`${e.action}${e.name ? ` ${e.name}` : ''}`)
    if (e.action === 'show') return { result: JSON.stringify({ current: mod.current, made: [...mod.made] }) }
    if (e.action === 'save' && e.name) {
      mod.made.add(e.name)
      if (e.apply !== false) mod.current = e.name
    }
    if (e.action === 'apply' && e.name) {
      if (!mod.made.has(e.name)) return { deny: `no skin named "${e.name}"` }
      mod.current = e.name
    }
    return { result: 'ok' }
  }) as never)
  return mod
}

const startup = { source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true }

test('a new, empty skins copy gets the Netrunner skins again and the variant applied', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  const mod = fakeSkins(on)
  await $.session.start(startup as never)
  await clock.advance(2000)
  expect(mod.current).toBe(skinName('black-ice'))

  // Switching to the skins this marketplace lists: a fresh store, nothing made, the stock skin on.
  mod.made.clear()
  mod.current = 'default'
  mod.calls.length = 0
  await $.session.start(startup as never)
  await clock.advance(2000)
  expect([...mod.made].sort()).toEqual(VARIANT_IDS.map(skinName).sort())
  expect(mod.current).toBe(skinName('black-ice'))
})

test('a skins copy with skins of the person\'s own gets ours back, but keeps the skin they picked', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  const mod = fakeSkins(on)
  await $.session.start(startup as never)
  await clock.advance(2000)

  // They deleted ours and picked a skin of their own.
  mod.made.clear()
  mod.made.add('my-skin')
  mod.current = 'my-skin'
  await $.session.start(startup as never)
  await clock.advance(2000)
  expect(VARIANT_IDS.every(id => mod.made.has(skinName(id)))).toBe(true)
  expect(mod.current).toBe('my-skin')
})

test('keep: the skins are saved but the current skin is left alone', { options: { variant: 'black-ice', skin: 'keep' } }, async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  const actions: string[] = []
  on('tool.call' as never, { tool: SKINS } as never, ((_$: unknown, e: { action?: string }) => {
    actions.push(String(e.action))
    return { result: 'ok' }
  }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(2000)
  expect(actions.filter(a => a === 'save').length).toBe(VARIANT_IDS.length)
  expect(actions).not.toContain('apply')
})

test('without the skins mod, nothing breaks', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  // No skins tool: the install finds none (the band shows a one-time hint) and the band still draws.
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
  expect((await ui.findAll({ type: 'Svg' })).length).toBeGreaterThan(0)
})
