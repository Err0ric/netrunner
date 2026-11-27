// Netrunner's four looks. Each variant colors the band above the prompt and carries
// the skin the skins mod draws the transcript with, plus a palette line for the
// filetree mod. Pure data: nothing here touches the engine.

export type VariantId = 'packet-trace' | 'zero-day' | 'cold-boot' | 'black-ice'

/** The band's colors. */
export type BandColors = {
  bg: string
  text: string
  muted: string
  /** A bar's empty track. */
  empty: string
  line: string
  /** The 7-day bar, WAITING and the sweep. */
  accent: string
  /** The 5-hour bar. */
  second: string
  warn: string
  err: string
  /** The prompt cache's two states. */
  warm: string
  cold: string
  /** Text on a filled chip. */
  ink: string
  /** The sweep's bright head. */
  glow: string
}

/** The skins mod's slots: see `/skin` or the skins README. */
export type SkinPalette = Record<
  'user' | 'fg' | 'muted' | 'surface' | 'zebra' | 'ok' | 'err' | 'warn' | 'read' | 'write' | 'run' | 'search' | 'web' | 'mcp' | 'other',
  string
>

/** The whole app's look in the desktop and mobile apps: its surfaces, text and roles
 * (for makeColors), and the network map drawn behind the conversation. */
export type AppLook = {
  /** The page, cards, panels and menus, darkest first. */
  surfaces: [string, string, string, string]
  /** Primary, secondary and muted text. */
  text: [string, string, string]
  roles: Record<'accent' | 'danger' | 'success' | 'warning' | 'pro', string>
  /** The backdrop: the map's links and nodes, the packets on them, the dot grid, the edge shade. */
  scene: { link: string; packet: string; dots: string; shade: string }
}

export type Variant = {
  id: VariantId
  label: string
  band: BandColors
  look: AppLook
  skin: SkinPalette
  /** For filetree's `palette` option. */
  filetree: string
}

/** What the spinner says while Claude works, and after it, in every variant. */
export const SPINNER = [
  'Hacking the mainframe', 'Downloading more RAM', 'Bypassing the firewall', 'Blaming DNS',
  'Typing very fast', 'Sudo-ing politely', 'Grepping for meaning', 'Pinging the void',
  'Spoofing confidence', 'Rubber-ducking', 'Reversing the polarity', 'Routing via 7 proxies',
]
export const DONE = [
  'Pwned', "Sudo'd", 'Rooted', 'Blamed DNS', 'Hacked the mainframe', 'Downloaded more RAM',
  'Rubber-ducked', 'Exfiltrated', 'Typed very fast', 'Escalated', 'Grepped', 'Rebooted',
]

export const VARIANTS: Record<VariantId, Variant> = {
  // Graphite, phosphor teal, violet highlights.
  'packet-trace': {
    id: 'packet-trace',
    label: 'Netrunner: Packet Trace',
    band: {
      bg: '#10161a', text: '#dae7e4', muted: '#869a96', empty: '#1f2a31', line: '#182027',
      accent: '#3ddcb4', second: '#6cb8d6', warn: '#e8b44c', err: '#ff5c6c',
      warm: '#9d8cff', cold: '#7f9cb8', ink: '#0b0f12', glow: '#e9fffa',
    },
    look: {
      surfaces: ['#0b0f12', '#10161a', '#141b20', '#182027'],
      text: ['#dae7e4', '#aebfbc', '#869a96'],
      roles: { accent: '#3ddcb4', danger: '#ff5c6c', success: '#9bd86a', warning: '#e8b44c', pro: '#9d8cff' },
      scene: { link: '#3ddcb4', packet: '#8ff7dc', dots: '#9fc2bb', shade: '#05080a' },
    },
    skin: {
      user: '#3ddcb4', fg: '#dae7e4', muted: '#869a96', surface: '#141b20', zebra: '#10161a',
      ok: '#9bd86a', err: '#ff5c6c', warn: '#e8b44c',
      read: '#8ff7dc', write: '#ff79c6', run: '#6cb8d6', search: '#9d8cff', web: '#7aa2f7', mcp: '#3ddcb4', other: '#b9adff',
    },
    filetree:
      'fg=#dae7e4 bg=#0b0f12 accent=#3ddcb4 muted=#869a96 urgent=#ff5c6c selection=#16302b hover=#131d22 jump=#9d8cff added=#9bd86a modified=#6cb8d6 renamed=#9d8cff add=#9bd86a del=#ff5c6c',
  },
  // Terminal green on near-black, magenta highlights.
  'zero-day': {
    id: 'zero-day',
    label: 'Netrunner: Zero Day',
    band: {
      bg: '#0f1512', text: '#c8d3cc', muted: '#7a958a', empty: '#1c2621', line: '#16201b',
      accent: '#4af58a', second: '#5ccfe6', warn: '#ffb454', err: '#ff3b5c',
      warm: '#d77bff', cold: '#6f8f9c', ink: '#08100b', glow: '#eaffef',
    },
    look: {
      surfaces: ['#0b100d', '#0f1512', '#131b17', '#16201b'],
      text: ['#dce8e0', '#aabbb1', '#80998e'],
      roles: { accent: '#4af58a', danger: '#ff3b5c', success: '#7ee787', warning: '#ffb454', pro: '#d77bff' },
      scene: { link: '#4af58a', packet: '#b8ffd0', dots: '#9fc2a8', shade: '#040705' },
    },
    skin: {
      user: '#4af58a', fg: '#c8d3cc', muted: '#7a958a', surface: '#131b17', zebra: '#0f1512',
      ok: '#7ee787', err: '#ff3b5c', warn: '#ffb454',
      read: '#a6f5c4', write: '#ff5fd2', run: '#5ccfe6', search: '#b48cff', web: '#5c9cff', mcp: '#d77bff', other: '#9aa8a0',
    },
    filetree:
      'fg=#c8d3cc bg=#0b100d accent=#4af58a muted=#7a958a urgent=#ff3b5c selection=#173322 hover=#121a15 jump=#d77bff added=#7ee787 modified=#5ccfe6 renamed=#d77bff add=#7ee787 del=#ff3b5c',
  },
  // Steel blue, ice cyan, periwinkle highlights.
  'cold-boot': {
    id: 'cold-boot',
    label: 'Netrunner: Cold Boot',
    band: {
      bg: '#0f141b', text: '#dce6f0', muted: '#8394a8', empty: '#1d2632', line: '#17202b',
      accent: '#67e8f9', second: '#93c5fd', warn: '#fbbf24', err: '#fb7185',
      warm: '#a5b4fc', cold: '#64748b', ink: '#0a0f16', glow: '#f0fdff',
    },
    look: {
      surfaces: ['#0a0f16', '#0f141b', '#131a22', '#17202b'],
      text: ['#dce6f0', '#b0bfcf', '#8394a8'],
      roles: { accent: '#67e8f9', danger: '#fb7185', success: '#86efac', warning: '#fbbf24', pro: '#a5b4fc' },
      scene: { link: '#67e8f9', packet: '#cffafe', dots: '#9fb6c8', shade: '#04070b' },
    },
    skin: {
      user: '#67e8f9', fg: '#dce6f0', muted: '#8394a8', surface: '#131a22', zebra: '#0f151c',
      ok: '#86efac', err: '#fb7185', warn: '#fbbf24',
      read: '#a5f3fc', write: '#f0abfc', run: '#93c5fd', search: '#a5b4fc', web: '#7dd3fc', mcp: '#67e8f9', other: '#c4b5fd',
    },
    filetree:
      'fg=#dce6f0 bg=#0a0f16 accent=#67e8f9 muted=#8394a8 urgent=#fb7185 selection=#16303a hover=#121a24 jump=#a5b4fc added=#86efac modified=#93c5fd renamed=#a5b4fc add=#86efac del=#fb7185',
  },
  // Red-black, deep crimson, ember highlights. Danger stays the brightest red, so a
  // failure still stands out against the crimson accent.
  'black-ice': {
    id: 'black-ice',
    label: 'Netrunner: Black ICE',
    band: {
      bg: '#130909', text: '#f0dcdc', muted: '#9a7f7f', empty: '#2a1414', line: '#1f1010',
      accent: '#c8202a', second: '#ff6f4d', warn: '#f6c177', err: '#ff4d4d',
      warm: '#ffb38a', cold: '#7d6464', ink: '#0c0606', glow: '#ffe6e1',
    },
    look: {
      surfaces: ['#0c0606', '#130909', '#190c0c', '#1f1010'],
      text: ['#f0dcdc', '#c9abab', '#9a7f7f'],
      roles: { accent: '#c8202a', danger: '#ff4d4d', success: '#9bd86a', warning: '#f6c177', pro: '#ff6f4d' },
      scene: { link: '#c8202a', packet: '#ff6f4d', dots: '#a88585', shade: '#050202' },
    },
    skin: {
      user: '#ff5a52', fg: '#f0dcdc', muted: '#9a7f7f', surface: '#190c0c', zebra: '#130909',
      ok: '#9bd86a', err: '#ff4d4d', warn: '#f6c177',
      read: '#ff9a8a', write: '#ffb38a', run: '#ff6f4d', search: '#d98f8f', web: '#b89a9a', mcp: '#e0262f', other: '#cfb0ad',
    },
    filetree:
      'fg=#f0dcdc bg=#0c0606 accent=#e0262f muted=#9a7f7f urgent=#ff4d4d selection=#3a1214 hover=#1c0d0d jump=#ff6f4d added=#9bd86a modified=#ff9a8a renamed=#ff6f4d add=#9bd86a del=#ff4d4d',
  },
}

export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[]

/** The variant an option names; Packet Trace for anything else. */
export const variantOf = (id: unknown): Variant => VARIANTS[id as VariantId] ?? VARIANTS['packet-trace']

/** The skins mod's name for a variant's skin. */
export const skinName = (id: VariantId): string => `netrunner-${id}`
