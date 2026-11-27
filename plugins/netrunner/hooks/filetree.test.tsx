import { expect, mock, test } from 'claude-code/testing'

import { RETIRED_FILETREE, VARIANTS } from './palettes'

const KEY = 'filetree.palette'
const start = { source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true }

/**
 * A session with filetree's palette row holding `value` (or no filetree at all when
 * `value` is undefined). Returns the writes Netrunner makes to filetree's row.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const world = (on: any, value: string | undefined, isLocked = false) => {
  const writes: string[] = []
  on('session.usage' as never, (() => ({ value: { rateLimits: [], context: { tokens: 0, window: 0 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  on('session.start' as never, (async () => ({ cwd: '/repo' })) as never)
  mock.store(on)
  on('config.list' as never, (() => ({
    value: value === undefined
      ? []
      : [{ key: KEY, label: 'Palette', kind: 'text', value, provider: { plugin: 'filetree', tier: 'user' }, isLocked }],
  })) as never)
  on('config.set' as never, ((_$: unknown, e: { key: string; value: unknown }) => {
    writes.push(`${e.key}=${String(e.value)}`)
    return { value: e.value }
  }) as never)
  return writes
}

const run = async ($: { session: { start: (e: never) => Promise<unknown> } }, clock: { advance: (ms: number) => Promise<unknown> }) => {
  await $.session.start(start as never)
  await clock.advance(2000)
}

test('an empty filetree palette gets the variant line', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, '')
  await run($ as never, clock)
  expect(writes).toEqual([`${KEY}=${VARIANTS['black-ice'].filetree}`])
})

test('another variant line Netrunner wrote is replaced when the variant changes', { options: { variant: 'zero-day' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, VARIANTS['black-ice'].filetree)
  await run($ as never, clock)
  expect(writes).toEqual([`${KEY}=${VARIANTS['zero-day'].filetree}`])
})

test('the Black ICE line from before 1.3.0 counts as Netrunner\'s own', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, RETIRED_FILETREE[0])
  await run($ as never, clock)
  expect(writes).toEqual([`${KEY}=${VARIANTS['black-ice'].filetree}`])
})

test('a palette already matching the variant is not written again', { options: { variant: 'cold-boot' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, VARIANTS['cold-boot'].filetree)
  await run($ as never, clock)
  expect(writes).toEqual([])
})

test('a palette the person wrote is left alone', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, 'fg=#ebdbb2 bg=#1d2021 accent=#83a598')
  await run($ as never, clock)
  expect(writes).toEqual([])
})

test('without filetree, nothing is written', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, undefined)
  await run($ as never, clock)
  expect(writes).toEqual([])
})

test('a locked palette row is left alone', { options: { variant: 'black-ice' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, '', true)
  await run($ as never, clock)
  expect(writes).toEqual([])
})

test('filetree: off never touches filetree', { options: { variant: 'black-ice', filetree: 'off' } }, async ($, on) => {
  const clock = mock.clock(on)
  const writes = world(on, '')
  await run($ as never, clock)
  expect(writes).toEqual([])
})
