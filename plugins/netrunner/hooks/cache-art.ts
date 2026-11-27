// The band's drawings. Pure: each function returns an SVG string the band
// hands to Svg. Nothing here touches the engine.

export type Mode = 'warm' | 'cold'
export type Kind = 'wide' | 'stacked' | 'tight'

import { variantOf } from './palettes'
import type { BandColors } from './palettes'

// The band's colors, from the variant `useVariant` picks (Packet Trace until then).
// Live bindings: a module importing them reads the current variant's values.
export let BG = ''
export let TEXT = ''
export let MUTED = ''
export let EMPTY = ''
export let LINE = ''
/** The 7-day bar. */
export let BLUE = ''
/** The 5-hour bar. */
export let MAGENTA = ''
export let YELLOW = ''
export let RED = ''
/** The cache's two states. */
export let HUE: Record<Mode, string> = { warm: '', cold: '' }
/** Text on a filled chip. */
export let INK = ''
/** WAITING and the sweep. */
export let WAIT = ''
/** The sweep's bright head. */
export let GLOW = ''

/** Switches every drawing to a variant's colors. */
export const useVariant = (id: unknown): BandColors => {
  const c = variantOf(id).band
  BG = c.bg; TEXT = c.text; MUTED = c.muted; EMPTY = c.empty; LINE = c.line
  BLUE = c.accent; MAGENTA = c.second; YELLOW = c.warn; RED = c.err
  HUE = { warm: c.warm, cold: c.cold }
  INK = c.ink; WAIT = c.accent; GLOW = c.glow
  return c
}
useVariant('packet-trace')

export const WORD: Record<Mode, string> = { warm: 'WARM', cold: 'COLD' }

/** The prompt cache lives an hour after the last request that read or wrote it. */
export const TTL_MIN = 60
export const TTL_MS = TTL_MIN * 60 * 1000

/** One row needs about 78 columns for two windows; under that, each window stacks. */
export const WIDE_AT = 78
/** Under this the bars shrink and the cache gets its own row. */
export const TIGHT_AT = 42

export const kindOf = (columns: number): Kind => (columns >= WIDE_AT ? 'wide' : columns >= TIGHT_AT ? 'stacked' : 'tight')

/**
 * The band's width in CSS pixels for a column count: the engine keeps 5 cells
 * for its [-], and a cell is 12 px (the app's code font advance). Rounds down,
 * so the card never runs past the slot; the few pixels left are band colour.
 */
export const bandPx = (columns: number): number => (columns + 5) * 12

// $ per million tokens: input, and the cache read. The 1-hour cache write is 2 times
// input. Haiku 5.5 is $0.10 up to 100K tokens and $0.50 above; long sessions use the
// higher rate.
export type Model = { id: string; NAME: string; input: number; read: number }
export const MODELS: Model[] = [
  { id: 'fable', NAME: 'FABLE', input: 10, read: 0.25 },
  { id: 'opus', NAME: 'OPUS', input: 4, read: 0.2 },
  { id: 'sonnet', NAME: 'SONNET', input: 2, read: 0.2 },
  { id: 'haiku', NAME: 'HAIKU', input: 0.5, read: 0.05 },
]

/** Which row of MODELS a model id belongs to, or null for one the card doesn't price. */
export const familyOf = (model: string | null | undefined): string | null => {
  const m = (model ?? '').toLowerCase()
  return MODELS.find(x => m.includes(x.id))?.id ?? null
}

export const coldCost = (m: Model, tokens: number): number => (tokens / 1e6) * m.input * 2
export const warmCost = (m: Model, tokens: number): number => (tokens / 1e6) * m.read
export const costOf = (m: Model, mode: Mode, tokens: number): number => (mode === 'cold' ? coldCost(m, tokens) : warmCost(m, tokens))
export const usd = (n: number): string => '$' + n.toFixed(2)
export const tok = (n: number): string => (n >= 1e6 ? `${Number((n / 1e6).toFixed(1))}M` : `${Math.round(n / 1000)}k`)

/** Idle time the way the card writes it: 18m, 2h 5m, 3d 9h. */
export const fmtIdle = (ms: number): string => {
  const mins = Math.max(0, Math.floor(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** What every drawing of the cache reads. */
export type CacheView = {
  mode: Mode
  /** How long since the last request, written out: 3d 9h, 18m. */
  idle: string
  /** The same in whole minutes, for the warm countdown. */
  idleMin: number
  /** Context the next request re-sends. */
  tokens: number
  /** The model's context window. */
  window: number
  /** This session's MODELS id, or null when the model isn't priced. */
  mine: string | null
}

export const mineModel = (v: CacheView): Model | undefined => MODELS.find(m => m.id === v.mine)

// ---------- SVG helpers ----------
export const svgDoc = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<style>text{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}</style>` +
  body +
  '</svg>'

// ---------- Pixel bars (usage used) ----------
// A small take on savvy-progress's bar: a rounded track with a dithered fill
// of 2px pixels on a 3px grid, sparse at the start and dense toward the head,
// twinkling in four out-of-phase groups.
export const PILL_W = 84
export const PILL_W_TIGHT = 54
export const PILL_H = 9
const CELL = 3

const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const TWINKLE =
  '<style>.t0,.t1,.t2,.t3{animation:tw 2.4s ease-in-out infinite}' +
  '.t1{animation-duration:2.9s;animation-delay:-.7s}.t2{animation-duration:2s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}' +
  '@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}</style>'

/** A rounded track with a pixel fill for `used` percent. */
export const pillSvg = (used: number, fill: string, w: number = PILL_W): string => {
  const h = PILL_H
  const r = h / 2
  const pct = Math.max(0, Math.min(100, used))
  // A sliver still shows: at least one column of pixels once anything is used.
  const cols = pct <= 0 ? 0 : Math.max(1, Math.floor((w * pct) / 100 / CELL))
  const rows = Math.floor(h / CELL)
  let dots = ''
  for (let c = 0; c < cols; c++) {
    const density = 0.4 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let y = 0; y < rows; y++) {
      if (noise(c, y) < density || c === cols - 1) {
        dots += `<rect class="t${Math.floor(noise(y, c) * 4)}" x="${c * CELL + 1}" y="${y * CELL + 0.5}" width="2" height="2"/>`
      }
    }
  }
  return svgDoc(
    w,
    h,
    TWINKLE +
      `<defs><clipPath id="c"><rect width="${w}" height="${h}" rx="${r}"/></clipPath></defs>` +
      `<rect width="${w}" height="${h}" rx="${r}" fill="${EMPTY}"/>` +
      `<g clip-path="url(#c)" fill="${fill}">${dots}</g>`,
  )
}

// ---------- Rounded chips (WARM, COLD, YOU) ----------
// A text background can't be rounded, so a chip is a small drawing. The mod can't
// measure text, so the chip is sized from the word: about 0.8 em a letter plus
// 0.62 em of padding each side, 1.65 em tall.
export const chipShapes = (x: number, y: number, word: string, fill: string, size: number, ls: number): { w: number; h: number; svg: string } => {
  const w = Math.round(word.length * size * 0.8 + size * 1.24)
  const h = Math.round(size * 1.65)
  return {
    w,
    h,
    svg:
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>` +
      `<text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" font-size="${size}" font-weight="700" letter-spacing="${ls}"` +
      ` text-anchor="middle" fill="${INK}">${word}</text>`,
  }
}

/** The WARM or COLD chip in the band's row. */
export const chipSvg = (mode: Mode): { source: string; w: number; h: number } => {
  const c = chipShapes(0, 0, WORD[mode], HUE[mode], 11, 1)
  return { source: svgDoc(c.w, c.h, c.svg), w: c.w, h: c.h }
}

// ---------- WAITING: background work that will wake the session ----------
// WAITING uses the variant's accent (WAIT, above): the session is idle but still has work in flight.

const PULSE =
  '<style>.p{animation:pl 1.6s ease-in-out infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.2}}' +
  '@media (prefers-reduced-motion: reduce){.p{animation:none}}</style>'

/** The WAITING chip: a rounded pill with a pulsing dot so it reads as alive. */
export const waitChipSvg = (): { source: string; w: number; h: number } => {
  const size = 11
  const word = 'WAITING'
  const lead = 12
  const w = Math.round(word.length * size * 0.8 + size * 1.24) + lead
  const h = Math.round(size * 1.65)
  const body =
    PULSE +
    `<rect width="${w}" height="${h}" rx="${h / 2}" fill="${WAIT}"/>` +
    `<circle class="p" cx="${h / 2 + 1}" cy="${h / 2}" r="3" fill="${INK}"/>` +
    `<text x="${lead + (w - lead) / 2}" y="${h / 2 + size * 0.36}" font-size="${size}" font-weight="700" letter-spacing="1"` +
    ` text-anchor="middle" fill="${INK}">${word}</text>`
  return { source: svgDoc(w, h, body), w, h }
}

/**
 * The sweep: a visible line in the variant's accent across the band, and one wide, soft
 * glow with a bright core travelling along it, so a busy session visibly moves. The glow
 * is blurred in the drawing itself, so it reads as soft on a 100% (1x) screen as well
 * as a 2x one. prefers-reduced-motion leaves the line still and hides the glow.
 */
export const SWEEP_H = 10
export const sweepSvg = (w: number): string => {
  const h = SWEEP_H
  const y = h / 2
  // The glow is about a third of the band, within sensible bounds.
  const glow = Math.max(120, Math.min(320, Math.round(w * 0.3)))
  const dur = 2.8
  const css =
    `<style>@keyframes sw{from{transform:translateX(-${glow}px)}to{transform:translateX(${w}px)}}` +
    `.c{animation:sw ${dur}s cubic-bezier(.45,.05,.55,.95) infinite}` +
    '@media (prefers-reduced-motion: reduce){.c{animation:none;opacity:0}}</style>'
  const defs =
    '<defs>' +
    // Symmetric: dark at both ends, brightest in the middle.
    '<linearGradient id="sg" x1="0" x2="1" y1="0" y2="0">' +
    `<stop offset="0" stop-color="${WAIT}" stop-opacity="0"/>` +
    `<stop offset=".5" stop-color="${WAIT}" stop-opacity=".95"/>` +
    `<stop offset="1" stop-color="${WAIT}" stop-opacity="0"/></linearGradient>` +
    '<linearGradient id="sc" x1="0" x2="1" y1="0" y2="0">' +
    `<stop offset="0" stop-color="${GLOW}" stop-opacity="0"/>` +
    `<stop offset=".5" stop-color="${GLOW}" stop-opacity="1"/>` +
    `<stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></linearGradient>` +
    '<filter id="sb" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="2.4"/></filter>' +
    '</defs>'
  return svgDoc(
    w,
    h,
    css +
      defs +
      // The resting line stays faint; the glow is what draws the eye.
      `<rect x="0" y="${y - 1}" width="${w}" height="2" fill="${WAIT}" opacity=".25"/>` +
      `<g class="c">` +
      `<rect x="0" y="${y - 3}" width="${glow}" height="6" rx="3" fill="url(#sg)" filter="url(#sb)"/>` +
      `<rect x="${glow * 0.2}" y="${y - 1}" width="${glow * 0.6}" height="2" rx="1" fill="url(#sc)"/>` +
      `</g>`,
  )
}

/** How long something has been in flight: "<1m", "16m", "1h 05m". */
export const fmtAge = (ms: number): string => {
  const m = Math.floor(Math.max(0, ms) / 60000)
  if (m < 1) return '<1m'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

// ---------- The card, laid out for the band's width ----------
type TextOpts = { size?: number; w?: number; fill?: string; ls?: number; anchor?: string }

/** The gap between the row and the card, drawn inside the card. */
const CARD_TOP = 6

export const cardSvg = (v: CacheView, kind: Kind, W: number): { source: string; w: number; h: number; alt: string } => {
  const mode = v.mode
  const cold = mode === 'cold'
  const HUEM = HUE[mode]
  const FIRE = HUE.warm
  const ICE = HUE.cold
  const t = (x: number, y: number, str: string, o: TextOpts = {}) =>
    `<text x="${x}" y="${y}" font-size="${o.size || 11}" font-weight="${o.w || 700}" fill="${o.fill || MUTED}"` +
    ` letter-spacing="${o.ls ?? 0}" text-anchor="${o.anchor || 'start'}">${str}</text>`
  const vline = (x: number, y: number, h: number) => `<rect x="${x}" y="${y}" width="1" height="${h}" fill="${LINE}"/>`
  const hline = (y: number) => `<rect x="13" y="${y}" width="${W - 26}" height="1" fill="${LINE}"/>`
  const pill = (x0: number, x1: number, y: number, fill: string) =>
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`

  // How long since the last reply, as a pill that fills toward cold.
  const zoneIdle = (x: number, y: number, w: number, o: { compact?: boolean; header?: boolean } = {}) => {
    const k = o.compact ? { lab: 24, big: 60, bs: 30, line: 80, cap: 100 } : { lab: 30, big: 72, bs: 38, line: 96, cap: 120 }
    let g = ''
    if (o.header) {
      const c = chipShapes(x, y + k.lab - 13, WORD[mode], HUEM, 11, 1)
      g += c.svg + t(x + c.w + 8, y + k.lab, 'IDLE', { ls: 1.4 })
    } else {
      g += t(x, y + k.lab, 'IDLE', { ls: 1.4 })
    }
    g += t(x, y + k.big, v.idle, { size: k.bs, w: 600, fill: TEXT })
    const ly = y + k.line
    const x0 = x + 3
    const x1 = x + w - 14
    g += pill(x0, x1, ly, EMPTY)
    if (cold) {
      g += pill(x0, x1, ly, ICE)
      g += t(x, y + k.cap, 'warm 1h', { size: 12, w: 600, fill: FIRE })
      g += t(x1 + 5, y + k.cap, 'cold now', { size: 12, w: 600, fill: ICE, anchor: 'end' })
    } else {
      const now = x0 + (x1 - x0) * Math.min(1, v.idleMin / TTL_MIN)
      g += pill(x0, Math.max(x0 + 1, now), ly, FIRE)
      g += t(x, y + k.cap, 'last reply', { size: 12, w: 500 })
      g += t(x1 + 5, y + k.cap, `cold in ${Math.max(0, TTL_MIN - v.idleMin)}m`, { size: 12, w: 600, fill: ICE, anchor: 'end' })
    }
    return g
  }

  // The conversation's size, as a pill of the context window.
  const zoneSize = (x: number, y: number, w: number, o: { compact?: boolean } = {}) => {
    const share = v.window > 0 ? Math.min(1, v.tokens / v.window) : 0
    let g = t(x, y + (o.compact ? 24 : 30), cold ? 'RE-CACHE' : 'IN CACHE', { ls: 1.4 })
    const big = (yy: number, bs: number, ts: number) =>
      `<text x="${x}" y="${yy}" font-weight="600" fill="${TEXT}"><tspan font-size="${bs}">${tok(v.tokens)}</tspan><tspan font-size="${ts}" font-weight="500" fill="${MUTED}" dx="7">tokens</tspan></text>`
    const bar = (bx: number, by: number, bw: number) => pill(bx + 3, bx + bw - 3, by, EMPTY) + (share > 0 ? pill(bx + 3, Math.max(bx + 4, bx + 3 + (bw - 6) * share), by, HUEM) : '')
    if (o.compact) {
      const bw = Math.min(190, w / 2)
      return g + big(y + 56, 26, 14) + bar(x + w - bw, y + 47, bw)
    }
    const bw = Math.min(240, w)
    return g + big(y + 72, 38, 15) + bar(x, y + 94, bw) + t(x, y + 120, `${Math.round(share * 100)}% of the ${tok(v.window)} context used`, { size: 12, w: 500 })
  }

  // What the next message costs, by model. One scale for both states (the cold
  // write's top price), so a warm read shows as the tiny bar it is.
  const zoneCost = (x: number, y: number, colW: number, o: { compact?: boolean } = {}) => {
    const k = o.compact
      ? { lab: 24, base: 100, tall: 42, chip: 58, price: 88, name: 102 }
      : { lab: 30, base: 116, tall: 56, chip: 70, price: 104, name: 120 }
    let g = t(x, y + k.lab, cold ? 'NEXT MESSAGE COSTS' : 'NEXT MESSAGE COSTS, CACHED', { ls: 1.4 })
    const top = Math.max(...MODELS.map(m => coldCost(m, v.tokens)))
    MODELS.forEach((m, i) => {
      const mine = m.id === v.mine
      const share = top > 0 ? costOf(m, mode, v.tokens) / top : 0
      const bx = x + i * colW + 6
      const fillH = Math.max(6, Math.round(share * k.tall))
      g += `<rect x="${bx}" y="${y + k.base - k.tall}" width="10" height="${k.tall}" rx="5" fill="${EMPTY}"/>`
      g += `<rect x="${bx}" y="${y + k.base - fillH}" width="10" height="${fillH}" rx="5" fill="${mine ? HUEM : MUTED}"/>`
      if (mine) g += chipShapes(bx + 24, y + k.chip, 'YOU', HUEM, 10, 0.8).svg
      g += t(bx + 24, y + k.price, usd(costOf(m, mode, v.tokens)), { size: 17, w: mine ? 700 : 500, fill: mine ? TEXT : MUTED })
      g += t(bx + 24, y + k.name, m.NAME, { size: 11, w: 700, fill: mine ? HUEM : MUTED, ls: 0.8 })
    })
    return g
  }

  let H: number
  let g: string
  if (kind === 'wide') {
    H = 132
    // 92 px a model column on the page's full width; tighter near the switch point,
    // where the last column still needs about 90 px for its price.
    const colW = Math.min(92, Math.floor((W - 640 - 103) / 3))
    g = zoneIdle(13, 0, 290, { header: true }) + vline(314, 18, H - 36) + zoneSize(340, 0, 260) + vline(614, 18, H - 36) + zoneCost(640, 0, colW)
  } else if (kind === 'stacked') {
    H = 266
    g =
      zoneIdle(13, 0, 290, { header: true }) +
      vline(314, 18, 96) +
      zoneSize(340, 0, W - 340 - 13) +
      hline(134) +
      zoneCost(13, 134, Math.min(160, (W - 26) / 4))
  } else {
    // Narrow: the cache row above already shows the chip.
    H = 296
    g =
      zoneIdle(13, 0, W - 26, { compact: true }) +
      hline(110) +
      zoneSize(13, 110, W - 26, { compact: true }) +
      hline(180) +
      zoneCost(13, 182, (W - 26) / 4, { compact: true })
  }
  const h = H + CARD_TOP
  const body = `<rect width="${W}" height="${h}" rx="10" fill="${BG}"/><g transform="translate(0 ${CARD_TOP})">` + hline(0) + g + '</g>'
  const alt = cold
    ? `Cache cold. Idle ${v.idle}. Next message re-caches ${tok(v.tokens)} tokens.`
    : `Cache warm. Goes cold in ${Math.max(0, TTL_MIN - v.idleMin)} minutes. ${tok(v.tokens)} tokens cached.`
  return { source: svgDoc(W, h, body), w: W, h, alt }
}
