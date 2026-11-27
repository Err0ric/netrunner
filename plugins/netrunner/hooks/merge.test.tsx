import { expect, test } from 'claude-code/testing'

const PLUGIN = 'netrunner'
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 }, view: {} }
const stop = (extra: Record<string, unknown>) => ({ hook_event_name: 'Stop', session_id: 's1', transcript_path: '/tmp/t.jsonl', cwd: '/repo', stop_hook_active: false, ...extra })

// A stand-in for savvy-progress's crab row as it reaches this band through next(e).
const crewRow = {
  type: 'Box',
  props: { key: 'savvy-crew-wrap', flexDirection: 'column' },
  children: [
    {
      type: 'Box',
      props: { key: 'savvy-crew', flexDirection: 'row' },
      children: [{ type: 'Text', children: ['1 agent running · Backend: refactor the parser ×1'] }],
    },
  ],
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: while waiting, the crab row joins the WAITING line instead of its own row`, async ($, on) => {
    on('classic.Stop' as never, (() => ({})) as never)
    on('clock.now' as never, (() => ({ value: 1_800_000_000_000 })) as never)
    on('session.usage' as never, (() => ({ value: { rateLimits: [], context: { tokens: 0, window: 0 } } })) as never)
    on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
    on('ui.render' as never, { component: 'AbovePrompt', plugin: '*' } as never, (() => crewRow) as never)

    await (($ as unknown as { classic: { Stop: (e: unknown) => Promise<unknown> } }).classic.Stop)(stop({
      background_tasks: [{ id: 'b1', type: 'subagent', status: 'running', description: 'Backend: refactor the parser' }],
    }))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    const line = (await ui.find({ key: 'waiting' })) as unknown as { text?: string } | undefined
    expect(line).toBeDefined()
    // The crab row sits inside the WAITING line, not as a row of its own beneath it.
    type Node = { props?: { key?: string }; children?: unknown[] }
    const holds = (n: unknown, key: string): boolean =>
      (n as Node)?.props?.key === key || ((n as Node)?.children ?? []).some(c => holds(c, key))
    expect(holds(line, 'savvy-crew')).toBe(true)
    // One line: the age after WAITING, then the crabs' text; the agent's task appears once.
    expect(line?.text ?? '').toContain('· <1m')
    expect(line?.text ?? '').toContain('1 agent running')
    expect((line?.text ?? '').split('Backend: refactor the parser').length - 1).toBe(1)
  })
}

const sweeps = async (ui: { findAll: (q: { type: string }) => Promise<{ props: { source?: unknown } }[]> }) =>
  (await ui.findAll({ type: 'Svg' })).filter(el => String(el.props.source).includes('@keyframes sw')).length

test('desktop: the sweep runs whenever anything in the session runs, and only then', async ($, on) => {
  on('classic.Stop' as never, (() => ({})) as never)
  on('clock.now' as never, (() => ({ value: 1_800_000_000_000 })) as never)
  on('session.usage' as never, (() => ({ value: { rateLimits: [], context: { tokens: 0, window: 0 } } })) as never)
  on('session.model' as never, (() => ({ value: 'claude-opus-5-5' })) as never)
  let crew = false
  on('ui.render' as never, { component: 'AbovePrompt', plugin: '*' } as never, (() => (crew ? crewRow : { type: 'Box', props: {}, children: [] })) as never)
  const mount = (isWorking: boolean) =>
    $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...band, isWorking } })

  // Idle, nothing waiting, no agents: still.
  expect(await sweeps(await mount(false))).toBe(0)
  // A turn in progress: running.
  expect(await sweeps(await mount(true))).toBe(1)
  // Subagents running with the main turn over and nothing else waiting: still running.
  crew = true
  expect(await sweeps(await mount(false))).toBe(1)
  // Waiting on background work alone: running.
  crew = false
  await (($ as unknown as { classic: { Stop: (e: unknown) => Promise<unknown> } }).classic.Stop)(stop({
    background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'Run the test suite' }],
  }))
  expect(await sweeps(await mount(false))).toBe(1)
  // Everything done: still again.
  await (($ as unknown as { classic: { Stop: (e: unknown) => Promise<unknown> } }).classic.Stop)(stop({ background_tasks: [] }))
  expect(await sweeps(await mount(false))).toBe(1 - 1)
})
