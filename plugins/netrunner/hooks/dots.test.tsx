import { expect, test } from 'claude-code/testing'

import { VARIANT_IDS } from './palettes'

const PLUGIN = 'netrunner'
const NOW = 1_800_000_000_000
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 }, view: {} }
const resume = {
  hook_event_name: 'SessionStart', session_id: 's1', transcript_path: '/tmp/t.jsonl', cwd: '/repo',
  source: 'resume', seconds_since_last_response: 120, context_tokens: 48_000, model: 'claude-opus-5-5',
}

type Node = { props?: { key?: string }; children?: unknown[] }
const holds = (n: unknown, key: string): boolean =>
  (n as Node)?.props?.key === key || ((n as Node)?.children ?? []).some(c => holds(c, key))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engine = (on: any, writes: string[]) => {
  on('classic.SessionStart' as never, (() => ({})) as never)
  on('clock.now' as never, (() => ({ value: NOW })) as never)
  on('session.usage' as never, (() => ({ value: { rateLimits: [{ kind: 'seven_day', percentUsed: 31 }], context: { tokens: 48_000, window: 200_000 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  on('config.list' as never, (() => ({
    value: [{ key: 'netrunner.variant', label: 'Color variant', kind: 'choice', value: 'packet-trace', options: [...VARIANT_IDS], provider: { plugin: 'netrunner', tier: 'user' }, isLocked: false }],
  })) as never)
  on('config.set' as never, ((_$: unknown, e: { key: string; value: unknown }) => {
    writes.push(`${e.key}=${String(e.value)}`)
    return { value: e.value }
  }) as never)
}

const seed = ($: unknown) => (($ as { classic: { SessionStart: (e: unknown) => Promise<unknown> } }).classic.SessionStart)(resume)

test('desktop: the open cache card shows one dot per variant on its existing top row', async ($, on) => {
  engine(on, [])
  await seed($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })

  // Folded: no dots at all.
  expect(await ui.find({ key: 'variants' })).toBeUndefined()

  await ui.press({ key: 'cache-fold' })
  for (const id of VARIANT_IDS) expect(await ui.find({ key: `variant-${id}` })).toBeDefined()
  // They share the fold control's box, on the row that was already there: no new row.
  expect(holds(await ui.find({ key: 'fold' }), 'variants')).toBe(true)
  expect(holds(await ui.find({ key: 'row' }), 'variants')).toBe(true)
})

test('desktop: a dot saves its variant as the option; the current one saves nothing', async ($, on) => {
  const writes: string[] = []
  engine(on, writes)
  await seed($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
  await ui.press({ key: 'cache-fold' })

  await ui.press({ key: 'variant-packet-trace' })
  expect(writes).toEqual([])

  await ui.press({ key: 'variant-zero-day' })
  expect(writes).toEqual(['netrunner.variant=zero-day'])
})

test('terminal: no card, so no dots', async ($, on) => {
  engine(on, [])
  await seed($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  expect(await ui.find({ key: 'variant-zero-day' })).toBeUndefined()
})
