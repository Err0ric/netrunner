import { expect, mock, test } from 'claude-code/testing'

const PLUGIN = 'netrunner-crew'
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: a plain subagent shows as the compact crew row, with no panel opening`, async ($, on) => {
    mock.clock(on)
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
    const opened: string[] = []
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })

    // Nothing running: no crew row.
    let ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ key: 'savvy-crew' })).toBeUndefined()

    await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Draft the release notes', subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)

    ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    // A background agent is still running: one compact line whose button counts it and opens the panel only when pressed.
    expect(await ui.find({ key: 'savvy-crew' })).toBeDefined()
    expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×1')
    if (surface === 'desktop') {
      const svg = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
      expect(svg).toContain('1 agent running')
      expect(svg).toContain('Draft the release notes')
      expect(svg).toContain(' run"')
    } else {
      expect(await ui.find({ text: /1 agent running/ })).toBeDefined()
    }
    expect(opened).toEqual([])
  })
}

for (const cols of [60, 75, 100, 160] as const) {
  test(`desktop: five agents fit a ${cols}-column band beside the WAITING pill`, async ($, on) => {
    mock.clock(on)
    let n = 0
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    const types = ['general-purpose', 'Explore', 'savvy-flow:savvy-light', 'Plan', 'claude']
    for (let i = 0; i < 5; i++) {
      await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: i === 0 ? 'Backend: refactor the parser and add retries to the sync client for the accounts page' : `Task ${i}`, subagentType: types[i], provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
    }
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...band, bodyColumns: cols } })
    const svg = (await ui.findAll({ type: 'Svg' }))[0]
    const source = String(svg?.props.source)
    const width = Number(svg?.props.width)
    // Room for the WAITING pill and age (170px) stays free on a band about 8px a column wide.
    expect(width).toBeLessThanOrEqual(Math.max(160, cols * 8 - 60 - 170))
    expect(source).toContain('5 agents running')
    expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×5')
    // Narrow bands draw 3 crabs, wide ones all 5; a long task is cut with an ellipsis, never mid-glyph.
    const crabs = source.split('class="c-').length - 1
    expect(crabs).toBe(cols * 8 - 60 - 170 >= 520 ? 5 : 3)
    if (source.includes('Backend')) expect(source.includes('accounts page') || source.includes('…')).toBe(true)
  })
}
