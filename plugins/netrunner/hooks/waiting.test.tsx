import { expect, test } from 'claude-code/testing'

const PLUGIN = 'netrunner'
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 }, view: {} }

const stop = (extra: Record<string, unknown>) => ({
  hook_event_name: 'Stop',
  session_id: 's1',
  transcript_path: '/tmp/t.jsonl',
  cwd: '/repo',
  stop_hook_active: false,
  ...extra,
})

const fire = async ($: unknown, name: string, e: unknown) => {
  const ns = name.split('.')
  // $.classic.Stop(e), $.turn.start(e): an event fires as a call on its namespace.
  let f = $ as Record<string, unknown>
  for (const part of ns.slice(0, -1)) f = f[part] as Record<string, unknown>
  return (f[ns[ns.length - 1] as string] as (e: unknown) => Promise<unknown>)(e)
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: WAITING shows background work after a stop and clears on the next turn`, async ($, on) => {
    on('classic.Stop' as never, (() => ({})) as never)
    on('turn.start' as never, (() => ({ turnId: 't1' })) as never)
    on('clock.now' as never, (() => ({ value: 1_800_000_000_000 })) as never)
    on('session.usage' as never, (() => ({ value: { rateLimits: [], context: { tokens: 0, window: 0 } } })) as never)
    on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)

    // Nothing in flight: no WAITING row.
    await fire($, 'classic.Stop', stop({ background_tasks: [], session_crons: [] }))
    let ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ key: 'waiting' })).toBeUndefined()

    // A background shell and a scheduled wake-up: the row names the first and counts the rest.
    await fire($, 'classic.Stop', stop({
      background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'Run the test suite', command: 'sh scripts/dev/queue.sh' }],
      session_crons: [{ id: 'c1', schedule: '5 12 26 11 *', recurring: false, prompt: 'check' }],
    }))
    ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ key: 'waiting' })).toBeDefined()
    expect(await ui.find({ text: /Run the test suite/ })).toBeDefined()
    expect(await ui.find({ text: /\+1 more/ })).toBeDefined()
    // On desktop the sweep animates across the band while waiting; the terminal has no animation.
    const sweeps = async () =>
      (await ui.findAll({ type: 'Svg' })).filter(el => String(el.props.source).includes('@keyframes sw')).length
    expect(await sweeps()).toBe(surface === 'desktop' ? 1 : 0)

    // A subagent's stop never touches the main session's list.
    await fire($, 'classic.Stop', stop({ agent_id: 'a1', background_tasks: [] }))
    ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ key: 'waiting' })).toBeDefined()

    // The session wakes: a main-thread turn starts and the row goes until the next stop.
    // The turn itself is running, so on desktop the sweep stays.
    await fire($, 'turn.start', { text: '', turnId: 't1' })
    ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ key: 'waiting' })).toBeUndefined()
    expect(await sweeps()).toBe(surface === 'desktop' ? 1 : 0)

    // The turn ends with nothing left in flight: the sweep stops.
    await fire($, 'classic.Stop', stop({ background_tasks: [], session_crons: [] }))
    ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await sweeps()).toBe(0)
  })
}

// The desktop app can hand the band isWorking: false for a whole turn. The sweep must
// follow the turn's own start and end instead.
test('desktop: the sweep runs for a turn even when the band is told isWorking: false', async ($, on) => {
  on('turn.start' as never, (() => ({ turnId: 't1' })) as never)
  on('turn.complete' as never, (() => ({ text: 'done' })) as never)
  on('clock.now' as never, (() => ({ value: 1_800_000_000_000 })) as never)
  on('session.usage' as never, (() => ({ value: { rateLimits: [{ kind: 'seven_day', percentUsed: 65 }], context: { tokens: 0, window: 0 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  const sweeps = async () => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
    return (await ui.findAll({ type: 'Svg' })).filter(el => String(el.props.source).includes('@keyframes sw')).length
  }

  expect(await sweeps()).toBe(0)
  await fire($, 'turn.start', { text: 'hi', turnId: 't1' })
  expect(await sweeps()).toBe(1)
  // Every drawing names itself: alt is required, and a surface drops an Svg without one.
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
  for (const el of await ui.findAll({ type: 'Svg' })) expect(String(el.props.alt ?? '').trim()).not.toBe('')
  // A subagent's end does not stop the main turn's sweep.
  await fire($, 'turn.complete', { turnId: 'a-t', agentId: 'a1', durationMs: 10, reason: 'completed' })
  expect(await sweeps()).toBe(1)
  await fire($, 'turn.complete', { turnId: 't1', durationMs: 4000, reason: 'completed' })
  expect(await sweeps()).toBe(0)
})
