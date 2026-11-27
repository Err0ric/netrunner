import { expect, mock, test } from 'claude-code/testing'

import { VARIANTS } from './palettes'

const PLUGIN = 'netrunner'
const start = { source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engine = (on: any, looks: { colors?: unknown; backdrop?: { scene?: string; glass?: unknown } }[]) => {
  on('session.usage' as never, (() => ({ value: { rateLimits: [], context: { tokens: 0, window: 0 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  on('session.start' as never, (async () => ({ cwd: '/repo' })) as never)
  on('theme.set' as never, ((_$: unknown, e: (typeof looks)[number]) => {
    looks.push(e)
    return { value: { isDrawn: true } }
  }) as never)
  mock.store(on)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const backdrop = async ($: any, scene: string) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Backdrop', props: { scene, plugin: PLUGIN, glass: false } })
  return (await ui.findAll({ type: 'Svg' })).map((el: { props: { source: unknown } }) => String(el.props.source)).join('')
}

test('the variant colors the whole app and draws its network map', { options: { variant: 'zero-day' } }, async ($, on) => {
  mock.clock(on)
  const looks: Parameters<typeof engine>[1] = []
  engine(on, looks)
  await $.session.start(start as never)
  expect(looks.length).toBe(1)
  expect(looks[0].backdrop?.scene).toBe('netrunner-zero-day')
  expect(typeof looks[0].colors).toBe('object')

  const svg = await backdrop($, 'netrunner-zero-day')
  expect(svg).toContain(VARIANTS['zero-day'].look.scene.link)
  expect(svg).toContain(VARIANTS['zero-day'].look.surfaces[0])
  expect(svg).not.toContain(VARIANTS['packet-trace'].look.scene.link)
  expect(svg).toContain('@keyframes travel')
  // Moving: the hold rule appears only inside the reduced-motion query.
  expect(svg.split('*{animation:none!important}').length - 1).toBe(1)
})

test('still: the same map with its motion held', { options: { variant: 'black-ice', look: 'still' } }, async ($, on) => {
  mock.clock(on)
  const looks: Parameters<typeof engine>[1] = []
  engine(on, looks)
  await $.session.start(start as never)
  expect(looks[0].backdrop?.scene).toBe('netrunner-black-ice')
  const svg = await backdrop($, 'netrunner-black-ice')
  expect(svg).toContain(VARIANTS['black-ice'].look.scene.packet)
  expect(svg.split('*{animation:none!important}').length - 1).toBe(2)
})

test("off: the app keeps its own look", { options: { look: 'off' } }, async ($, on) => {
  mock.clock(on)
  const looks: Parameters<typeof engine>[1] = []
  engine(on, looks)
  await $.session.start(start as never)
  expect(looks).toEqual([])
  expect(await backdrop($, 'netrunner-packet-trace')).not.toContain('network')
  expect(await backdrop($, 'netrunner-packet-trace')).not.toContain('@keyframes travel')
})

test("another theme's backdrop is left alone", async ($, on) => {
  mock.clock(on)
  engine(on, [])
  await $.session.start(start as never)
  expect(await backdrop($, 'someone-elses-scene')).not.toContain('@keyframes travel')
})
