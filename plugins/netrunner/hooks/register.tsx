import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import type { CacheFacts, Fold, WaitItem, Window } from '../types'
import {
  BG, BLUE, EMPTY, HUE, INK, MAGENTA, MUTED, PILL_H, PILL_W, PILL_W_TIGHT, RED, TEXT, TTL_MIN, TTL_MS, WAIT, WORD, YELLOW,
  bandPx, cardSvg, chipSvg, costOf, familyOf, fmtAge, fmtIdle, kindOf, mineModel, pillSvg, sweepSvg, SWEEP_H, usd, useVariant, waitChipSvg,
} from './cache-art'
import { DONE, SPINNER, VARIANT_IDS, VARIANTS, skinName, variantOf } from './palettes'
import type { VariantId } from './palettes'
import type { CacheView } from './cache-art'
import { lookFor, lookModeOf, sceneName, sceneSvg } from './look'

// Netrunner: a band above the prompt with pill bars for how much of each usage window
// is USED (7-day, then 5-hour; amber at 60%, red with HIGH at 85%), the prompt cache
// (WARM for an hour after the last request, then COLD with what the next message costs
// to re-cache; Show / Hide folds its card), and, while anything in the session runs,
// a WAITING line for the background work that will wake it and a sweep across the band.
// Four color variants (the `variant` option); the matching transcript skins are saved
// into the skins mod, when it is installed. Zero token cost: it reads the engine's own
// figures and draws. The usage bars are based on robonuggets/ribbon (MIT).

/** The skins mod's tool: Netrunner saves its four skins through it. */
const SKINS_TOOL = 'mcp__skins__design'
/** Bump when a variant's skin changes, so the next start saves the four again. */
const SKIN_SET = 'netrunner-skins-1'

/**
 * Saves the four Netrunner skins into the skins mod once per SKIN_SET, and switches the
 * transcript to the chosen variant's skin when that choice is new (`skin: apply`). Never
 * switches back over a skin the person picked later, until they pick another variant.
 */
export const syncSkins = async ($: EngineInterface, variant: VariantId, apply: boolean): Promise<'done' | 'missing' | 'failed'> => {
  const saved = await $.store.get('skinSet')
  const applied = await $.store.get('skinApplied')
  const call = async (input: Record<string, unknown>): Promise<boolean> => {
    const r = (await $.tool.call({ tool: SKINS_TOOL, ...input } as never)) as { deny?: string; isError?: boolean }
    return !r?.deny && !r?.isError
  }
  try {
    if (saved !== SKIN_SET) {
      for (const id of VARIANT_IDS) {
        const v = VARIANTS[id]
        const ok = await call({ action: 'save', name: skinName(id), label: v.label, base: 'noir', palette: v.skin, spinner: SPINNER, done: DONE, apply: false })
        if (!ok) return 'failed'
      }
      await $.store.set('skinSet', SKIN_SET)
    }
    if (apply && applied !== variant) {
      if (!(await call({ action: 'apply', name: skinName(variant) }))) return 'failed'
      await $.store.set('skinApplied', variant)
    }
    return 'done'
  } catch {
    // No such tool: the skins mod is not installed (or not loaded yet).
    return 'missing'
  }
}

const CELLS = 10
const TIGHT_CELLS = 6
const WARN_AT = 60
const HIGH_AT = 85
/** How often the band redraws, so the countdown and the warm-to-cold flip stay current. */
const TICK_MS = 30_000

const windows = atom({ plugin: 'netrunner', key: 'windows' } as const, [] as Window[])
const cache = atom({ plugin: 'netrunner', key: 'cache' } as const, null as CacheFacts | null)
const fold = atom({ plugin: 'netrunner', key: 'fold' } as const, null as Fold | null)

// WAITING: when a turn ends with work still in flight (a background shell, a background
// agent, a monitor, a workflow, a scheduled wake-up), the session is idle but not done.
// The engine lists that work in the Stop hook's input; the band shows it until the next
// turn starts, so "waiting" no longer looks the same as "finished".
const waiting = atom({ plugin: 'netrunner', key: 'waiting' } as const, [] as WaitItem[])

type TaskLike = { id?: string; type?: string; description?: string; command?: string; name?: string; agent_type?: string }
type CronLike = { id?: string; recurring?: boolean }

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
// Reading another mod's drawing: elements are plain { type, props, children } values.
type El = { type?: string; props?: { key?: string }; children?: unknown[] }
/**
 * netrunner-crew's crab row as it came through next(e): its root (keyed savvy-crew-wrap,
 * carrying netrunner-crew's own stamp, so its ×N button still presses) when that root
 * holds nothing but the row itself. Moved whole, never taken apart; null otherwise.
 */
const liftCrew = (below: RenderElement | null): RenderElement | null => {
  const root = below as El | null
  if (!root || root.props?.key !== 'savvy-crew-wrap') return null
  const kids = (root.children ?? []).filter(k => k !== null && k !== undefined && k !== false)
  return kids.length === 1 && (kids[0] as El).props?.key === 'savvy-crew' ? below : null
}

const taskText = (t: TaskLike): string => {
  const raw = (t.type === 'workflow' && t.name) || t.description || t.command || t.agent_type || t.type || 'background task'
  return clip(String(raw).replace(/\s+/g, ' ').trim(), 44)
}

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H', spend_limit: 'SPEND' }
const ORDER: Record<string, number> = { seven_day: 0, five_hour: 1 }
const COLORS: Record<string, string> = { seven_day: BLUE, five_hour: MAGENTA }

const clean = (list: readonly Window[]): Window[] =>
  list
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))

/** The terminal's bar: heavy rules, lit for the share used. */
const rule = (used: number, cells: number): { on: string; off: string } => {
  const n = Math.max(0, Math.min(cells, Math.round((used / 100) * cells)))
  return { on: '━'.repeat(n), off: '━'.repeat(cells - n) }
}

const fmtReset = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'resetting'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** What the cache drawings read, or null until a request and its context size are known. */
export const viewOf = (c: CacheFacts | null, now: number): CacheView | null => {
  if (!c || c.lastAt <= 0 || c.tokens <= 0) return null
  const idleMs = Math.max(0, now - c.lastAt)
  return {
    mode: idleMs >= TTL_MS ? 'cold' : 'warm',
    idle: fmtIdle(idleMs),
    idleMin: Math.floor(idleMs / 60000),
    tokens: c.tokens,
    window: c.window,
    mine: familyOf(c.model),
  }
}

const pull = async ($: EngineInterface): Promise<void> => {
  const u = await $.session.usage()
  await update($, windows, () => clean(u.rateLimits))
}

/** Fresh context figures from the engine onto the cache facts, when it has them. */
const measure = async ($: EngineInterface, lastAt: number | null, model: string | null): Promise<void> => {
  const u = await $.session.usage()
  const m = model ?? (await $.session.model())
  await update($, cache, c => ({
    lastAt: lastAt ?? c?.lastAt ?? 0,
    tokens: u.context.tokens && u.context.tokens > 0 ? u.context.tokens : (c?.tokens ?? 0),
    window: u.context.window || c?.window || 0,
    model: m || c?.model || null,
  }))
}

export const register: Register = (on, options) => {
  const variant = variantOf(options.variant).id
  useVariant(variant)
  const applySkin = options.skin !== 'keep'
  const lookMode = lookModeOf(options.look)
  const scene = lookMode === 'off' ? '' : sceneSvg(variantOf(variant).look, lookMode === 'still')

  on('session.start', async ($, e, next) => {
    // The whole app's look (desktop and mobile): the variant's surfaces and the network map.
    if (lookMode !== 'off') {
      const { look, problems } = lookFor(variantOf(variant))
      const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
      if (unpainted !== undefined) void $.ui.toast(`Netrunner: ${unpainted}`)
      // A host that can't take a look must not cost the band its start.
      try {
        await $.theme.set(look)
      } catch {
        /* the app keeps its own look */
      }
    }
    // The skins mod registers its tool as its own session starts: give it a moment.
    $.clock.after(1500, async () => {
      const r = await syncSkins($, variant, applySkin)
      if (r === 'missing' && !(await $.store.get('skinsHintShown'))) {
        await $.store.set('skinsHintShown', true)
        void $.ui.toast('Netrunner: install the skins mod to color the transcript too (see the Netrunner README).')
      }
    })
    await pull($)
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (!scene || (e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== sceneName(variantOf(variant))) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={scene} alt="A sparse network map with packets drifting slowly between nodes" isInteractive />
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, windows, () => clean(e.rateLimits))
    }
    if (e.changed.includes('context') && e.context.tokens && e.context.tokens > 0) {
      const tokens = e.context.tokens
      await update($, cache, c => (c ? { ...c, tokens, window: e.context.window || c.window } : c))
    }
    return next(e)
  })

  // A resumed or forked session knows how long it was away and how big it is.
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.source === 'clear' || e.source === 'compact') {
      await update($, cache, () => null)
      await update($, fold, () => null)
    } else if ((e.source === 'resume' || e.source === 'fork') && typeof e.seconds_since_last_response === 'number') {
      const now = await $.clock.now()
      const lastAt = now - e.seconds_since_last_response * 1000
      const window = (await $.session.usage()).context.window
      const model = typeof e.model === 'string' ? e.model : await $.session.model()
      const tokens = typeof e.context_tokens === 'number' ? e.context_tokens : 0
      await update($, cache, () => ({ lastAt, tokens, window, model }))
    }
    return r
  }).catch(($, e, next) => next(e)) // a band that fails to seed never holds up the session

  // The end of a main-thread turn: note what is still in flight and will wake the session.
  on('classic.Stop', async ($, e, next) => {
    const r = await next(e)
    const ev = e as unknown as { agent_id?: string; background_tasks?: TaskLike[]; session_crons?: CronLike[] }
    if (ev.agent_id) return r
    const now = await $.clock.now()
    const prev = await read($, waiting)
    const seen = new Map(prev.map(w => [w.id, w.since]))
    const items = [
      ...(ev.background_tasks ?? []).map((t, i) => ({ id: `task-${t.id ?? i}`, text: taskText(t), kind: t.type ?? 'task' })),
      ...(ev.session_crons ?? []).map((c, i) => ({ id: `cron-${c.id ?? i}`, text: c.recurring ? 'loop (recurring)' : 'scheduled wake-up', kind: 'cron' })),
    ].map(w => ({ ...w, since: seen.get(w.id) ?? now }))
    await update($, waiting, () => items)
    return r
  }).catch(($, e, next) => next(e)) // a band that fails to read the list never holds up the stop

  // A new main-thread turn is working, not waiting: the spinner says so. The next stop refills the list.
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await update($, waiting, () => [])
    return next(e)
  })

  // Each main-thread request reads or writes the cache, so its start resets the hour.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, cache, c => ({ lastAt: now, tokens: c?.tokens ?? 0, window: c?.window ?? 0, model: c?.model ?? null }))
    }
    yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    // Catch up on the skins when the mod was not ready at start: cheap once done.
    void syncSkins($, variant, applySkin)
    const now = await $.clock.now()
    const c = await read($, cache)
    // turn.step stamps the exact request time; when no step of this turn did, the turn's end is the floor.
    const lastAt = !c || now - c.lastAt > e.durationMs ? now : c.lastAt
    await measure($, lastAt, e.usage?.model ?? null)
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    // Share the band: draw the other mods' bands (netrunner-crew and any others)
    // beneath this one. Claude Code's own placeholder ({ type: 'engine' }) is
    // never nested: the desktop drops a band that nests it.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below: RenderElement | null =
      drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? (drawn as RenderElement) : null
    // What goes beneath this band; the WAITING line may lift the crew row (netrunner-crew) out of it.
    let beneath: RenderElement | null = below

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const stack = (tree: RenderElement): RenderElement =>
      beneath ? (
        <Box flexDirection="column">
          {tree}
          {beneath}
        </Box>
      ) : tree
    // Svg draws on desktop, mobile and VS Code; the terminal gets the text form.
    // Ask the surface, not the table: the terminal's table still lists Svg.
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : null
    const list = await read($, windows)
    const now = await $.clock.now()
    const view = viewOf(await read($, cache), now)

    // Its own row, under the usage and cache, only while something is in flight.
    const waits = await read($, waiting)
    let waitRow = null
    const first = waits[0]
    if (first) {
      const oldest = Math.min(...waits.map(w => w.since))
      const more = waits.length - 1
      const wc = Svg ? waitChipSvg() : null
      const chip = wc && Svg
        ? <Svg key="wchip" source={wc.source} alt="WAITING" width={wc.w} height={wc.h} isInteractive />
        : <Text key="wchip" backgroundColor={WAIT} color={INK} bold>{' ● WAITING '}</Text>
      const age = <Text key="wage" color={WAIT} bold>{` · ${fmtAge(now - oldest)}`}</Text>

      // netrunner-crew draws running subagents as a crab row. While waiting, it joins
      // this line whole: WAITING and its age, then the crabs, their task and ×N, then
      // any other waiting work. The agent's task is not repeated as WAITING text.
      const crew = liftCrew(below)
      let line
      if (crew) {
        beneath = null
        const other = waits.filter(w => w.kind !== 'subagent')
        line = (
          <Box key="waiting" flexDirection="row" paddingX={1} alignItems="center">
            {chip}
            {age}
            {crew}
            {other[0] ? <Text key="wtext" color={TEXT}>{`· ${other[0].text}`}</Text> : null}
            {other.length > 1 ? <Text key="wmore" color={MUTED}>{` +${other.length - 1} more`}</Text> : null}
          </Box>
        )
      } else {
        line = (
          <Box key="waiting" flexDirection="row" paddingX={1} alignItems="center">
            {chip}
            <Text key="wtext" color={TEXT}>{` ${first.text}`}</Text>
            {more > 0 ? <Text key="wmore" color={MUTED}>{` +${more} more`}</Text> : null}
            {age}
          </Box>
        )
      }
      waitRow = (
        <Box key="waiting-wrap" flexDirection="column">
          {line}
        </Box>
      )
    }

    // The sweep runs across the bottom of the band whenever anything in this session is
    // running: a turn in progress, work the session is WAITING on, or subagents (the crab
    // row beneath). It stops only when nothing is.
    const crewBelow = (below as { props?: { key?: string } } | null)?.props?.key === 'savvy-crew-wrap'
    const busy = Boolean(e.props.isWorking) || waits.length > 0 || crewBelow
    // The desktop band is about 8 CSS px a reported column (bandPx's 12 is the card's
    // scale): a sweep drawn wider than the band is cropped, and its light spends most of
    // each pass off the visible part.
    const sweepW = Math.max(160, (e.props.bodyColumns ?? e.viewport?.columns ?? 100) * 8 - 24)
    const sweep = busy && Svg ? (
      <Box key="wsweep" flexDirection="row">
        <Svg source={sweepSvg(sweepW)} alt="" width={sweepW} height={SWEEP_H} isInteractive />
      </Box>
    ) : null

    if (list.length === 0 && !view) {
      return stack(
        <Box flexDirection="column" backgroundColor={BG}>
          <Box paddingX={1}>
            <Text color={MUTED}>USAGE · waiting for the first reply</Text>
          </Box>
          {waitRow}
          {sweep}
        </Box>
      )
    }

    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 100
    const kind = kindOf(columns)
    const isWide = kind === 'wide'
    const cells = kind === 'tight' ? TIGHT_CELLS : CELLS
    const pillW = kind === 'tight' ? PILL_W_TIGHT : PILL_W

    const parts = (w: Window) => {
      const used = Math.max(0, Math.min(100, Math.round(w.percentUsed * 10) / 10))
      const name = NAMES[w.kind] ?? w.kind.toUpperCase()
      return {
        used,
        name,
        col: used >= HIGH_AT ? RED : used >= WARN_AT ? YELLOW : (COLORS[w.kind] ?? TEXT),
        high: used >= HIGH_AT,
        reset: fmtReset(w.resetsAt, now),
      }
    }

    const bar = (p: ReturnType<typeof parts>) => {
      if (Svg) {
        // isInteractive lets the pixels' CSS twinkle run.
        return [<Svg key="pill" source={pillSvg(p.used, p.col, pillW)} alt={`${p.name} ${p.used}% used`} width={pillW} height={PILL_H} isInteractive />]
      }
      const r = rule(p.used, cells)
      return [<Text key="on" color={p.col}>{r.on}</Text>, <Text key="off" color={EMPTY}>{r.off}</Text>]
    }

    // Wide: every window on one row. Narrow: each window is a block of three
    // lines (name and pill, percent used, reset time) so nothing wraps or clips.
    const wide = (w: Window, i: number) => {
      const p = parts(w)
      return (
        <Box key={`w-${i}`} flexDirection="row" flexShrink={0} marginRight={3} alignItems="center">
          <Text color={MUTED} bold>{p.name} </Text>
          {bar(p)}
          <Text color={p.col} bold> {p.used}%</Text>
          <Text color={MUTED}> used</Text>
          {p.high ? <Text color={RED} bold> HIGH</Text> : null}
          {p.reset ? <Text color={MUTED}> · ↻ {p.reset}</Text> : null}
        </Box>
      )
    }

    const stacked = (w: Window, i: number) => {
      const p = parts(w)
      return (
        <Box key={`w-${i}`} flexDirection="column" flexShrink={0} marginRight={3}>
          <Box flexDirection="row" alignItems="center">
            <Text color={MUTED} bold>{p.name} </Text>
            {bar(p)}
          </Box>
          <Box flexDirection="row">
            <Text color={p.col} bold>{p.used}% used</Text>
            {p.high ? <Text color={RED} bold> HIGH</Text> : null}
          </Box>
          {p.reset ? <Text color={MUTED}>↻ {p.reset}</Text> : null}
        </Box>
      )
    }

    // On one row the window names say enough; the label only heads the stacked blocks.
    const label = isWide ? null : (
      <Box key="label" flexShrink={0} marginRight={3}>
        <Text color={TEXT} bold>USAGE</Text>
      </Box>
    )
    const usage = list.length > 0
      ? list.map(isWide ? wide : stacked)
      : [<Box key="wait" flexShrink={0} marginRight={3}><Text color={MUTED}>waiting for the first reply</Text></Box>]

    // Before the first reply there is no cache to show.
    if (!view) {
      return stack(
        <Box flexDirection="column" backgroundColor={BG}>
          <Box flexDirection="row" paddingX={1} alignItems="center">
            {label}
            {usage}
          </Box>
          {waitRow}
          {sweep}
        </Box>
      )
    }

    const mode = view.mode
    const cold = mode === 'cold'
    const hue = HUE[mode]
    const mine = mineModel(view)
    const stored = await read($, fold)
    // Folding needs the card, and the card is a drawing: the terminal stays folded.
    // Always starts folded; only a click opens it, and that choice holds across warm/cold flips.
    const open = Svg !== null && (stored?.open ?? false)
    const toggle = () =>
      update($, fold, f => ({ mode, open: !(f?.open ?? false) }))

    const badge = Svg
      ? (() => {
          const c = chipSvg(mode)
          return [<Svg key="chip" source={c.source} alt={WORD[mode]} width={c.w} height={c.h} />]
        })()
      : [<Text key="chip" backgroundColor={hue} color={INK} bold>{` ${WORD[mode]} `}</Text>]

    const summary = cold
      ? [
          <Text key="idle" color={hue} bold>{` ${view.idle}`}</Text>,
          mine ? <Text key="dot" color={MUTED}> · </Text> : null,
          mine ? <Text key="cost" color={TEXT} bold>{usd(costOf(mine, mode, view.tokens))}</Text> : null,
        ]
      : [<Text key="left" color={hue} bold>{` ${Math.max(0, TTL_MIN - view.idleMin)}m`}</Text>]

    const button = Svg ? (
      <Box key="fold" flexShrink={0} alignItems="flex-start">
        {/* One dim glyph instead of a full button; the label still names it for readers. */}
        <Button key="cache-fold" label={open ? 'Hide' : 'Show'} plain dimColor onPress={toggle}>
          {open ? '▴' : '▾'}
        </Button>
      </Box>
    ) : null
    const grow = <Box key="grow" flexGrow={1} />

    let rows
    if (kind === 'wide') {
      rows = (
        <Box key="row" flexDirection="row" paddingX={1} alignItems="center">
          {label}
          {usage}
          {open ? null : (
            <Box key="inline" flexDirection="row" flexShrink={0} marginRight={2} alignItems="center">
              {badge}
              {summary}
            </Box>
          )}
          {grow}
          {button}
        </Box>
      )
    } else if (kind === 'stacked') {
      // The cache becomes a third stacked block, the same shape as 7D and 5H.
      rows = (
        <Box key="row" flexDirection="row" paddingX={1}>
          {label}
          {usage}
          {open ? null : (
            <Box key="block" flexDirection="column" flexShrink={0} marginRight={2}>
              <Box flexDirection="row" alignItems="center">{badge}</Box>
              <Text color={hue} bold>{cold ? `${view.idle} idle` : `${Math.max(0, TTL_MIN - view.idleMin)}m left`}</Text>
              {mine ? (
                <Box flexDirection="row">
                  <Text color={TEXT} bold>{usd(costOf(mine, mode, view.tokens))}</Text>
                  <Text color={MUTED}> next</Text>
                </Box>
              ) : null}
            </Box>
          )}
          {grow}
          {button}
        </Box>
      )
    } else {
      // Narrow: the cache gets its own row under the usage blocks.
      rows = [
        <Box key="row" flexDirection="row" paddingX={1}>
          {label}
          {usage}
        </Box>,
        <Box key="cache" flexDirection="row" paddingX={1} alignItems="center">
          {badge}
          {summary}
          {grow}
          {button}
        </Box>,
      ]
    }

    let card = null
    if (open && Svg) {
      const c = cardSvg(view, kind, bandPx(columns))
      card = (
        <Box key="card" flexDirection="row">
          <Svg source={c.source} alt={c.alt} width={c.w} height={c.h} />
        </Box>
      )
    }

    return stack(
      <Box flexDirection="column" backgroundColor={BG}>
        {rows}
        {card}
        {waitRow}
        {sweep}
      </Box>
    )
  })
}
