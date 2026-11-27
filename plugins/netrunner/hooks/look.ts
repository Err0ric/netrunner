// The whole app's look in the desktop and mobile apps: graphite (or green, steel,
// red-black) surfaces from the variant, and a slow network map behind the conversation.
// Based on the Packet Trace look. The terminal draws no look; nothing here runs there.

import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import type { AppLook, Variant } from './palettes'

/** How the backdrop draws: moving, held still, or no Netrunner look at all. */
export type LookMode = 'animated' | 'still' | 'off'

export const lookModeOf = (v: unknown): LookMode => (v === 'still' || v === 'off' ? v : 'animated')

/** The scene name `$.theme.set` carries, so the Backdrop hook knows its own. */
export const sceneName = (v: Variant): string => `netrunner-${v.id}`

type Point = [number, number]
type NetMap = Record<string, Point>

// Top-right map, in the 1600 x 1000 scene box.
const TR: NetMap = {
  a: [1210, 110], b: [1330, 64], c: [1462, 150], d: [1388, 252], e: [1528, 310], f: [1262, 226], g: [1540, 70],
}
const TR_LINKS = ['ab', 'bc', 'cd', 'df', 'fa', 'ce', 'de', 'cg', 'bg']

// Bottom-left map.
const BL: NetMap = {
  a: [96, 716], b: [228, 796], c: [164, 904], d: [336, 884], e: [54, 846], f: [302, 690], g: [430, 950],
}
const BL_LINKS = ['fa', 'ab', 'bc', 'ce', 'ea', 'bd', 'dc', 'dg', 'fb']

const at = (m: NetMap, k: string): string => (m[k] ?? [0, 0]).join(' ')
const route = (m: NetMap, keys: string): string => 'M' + [...keys].map(k => at(m, k)).join(' L')

function map(m: NetMap, links: string[], routes: [string, number, number][], ping: string, pingDelay: number): string {
  const lines = links.map(l => `<path d="${route(m, l)}"/>`).join('')
  const nodes = Object.values(m)
    .map(([x, y], i) => `<circle class="node" style="animation-delay:-${(i * 2.3).toFixed(1)}s" cx="${x}" cy="${y}" r="3"/>`)
    .join('')
  const packets = routes
    .map(([keys, dur, delay]) =>
      `<path class="packet" pathLength="100" style="animation-duration:${dur}s;animation-delay:-${delay}s" d="${route(m, keys)}"/>`)
    .join('')
  const [px, py] = m[ping] ?? [0, 0]
  return `<g class="links">${lines}</g>${packets}${nodes}`
    + `<circle class="ping" style="animation-delay:-${pingDelay}s" cx="${px}" cy="${py}" r="4"/>`
    + `<circle class="core" cx="${px}" cy="${py}" r="3.5"/>`
}

/**
 * The backdrop: a faint dot grid fading out toward the middle, and two sparse network
 * maps pinned to the top-right and bottom-left corners, away from the words and the
 * message box. Packets drift along the links and one node pings, on 12 to 70 second
 * loops. Held still for reduced motion, or when `still`.
 */
export function sceneSvg(look: AppLook, still = false): string {
  const { link, packet, dots, shade } = look.scene
  const ground = look.surfaces[0]
  const hold = '*{animation:none!important}.packet{display:none}'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
<style>
.links path{fill:none;stroke:${link};stroke-opacity:.14;stroke-width:1}
.node{fill:${link};opacity:.35;animation:blink 14s ease-in-out infinite}
.core{fill:${packet};opacity:.8}
.packet{fill:none;stroke:${packet};stroke-width:2.4;stroke-linecap:round;stroke-dasharray:1.2 98.8;stroke-dashoffset:100;opacity:.85;animation:travel linear infinite}
.ping{fill:none;stroke:${link};stroke-width:1;transform-box:fill-box;transform-origin:center;opacity:0;animation:ping 12s ease-out infinite}
.scan{fill:${link};opacity:.03;animation:scan 70s linear infinite}
@keyframes blink{0%,100%{opacity:.22}50%{opacity:.55}}
@keyframes travel{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes ping{0%{transform:scale(1);opacity:.5}40%{transform:scale(7);opacity:0}100%{transform:scale(7);opacity:0}}
@keyframes scan{from{transform:translateY(-20px)}to{transform:translateY(1020px)}}
@media (max-aspect-ratio:1/1){.wide{display:none}}
@media (prefers-reduced-motion:reduce){${hold}}
${still ? hold : ''}
</style>
<defs>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1" fill="${dots}"/></pattern>
<radialGradient id="fade" cx="50%" cy="50%" r="70%"><stop offset="35%" stop-color="#000"/><stop offset="100%" stop-color="#fff"/></radialGradient>
<mask id="edges"><rect width="1600" height="1000" fill="url(#fade)"/></mask>
<radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="${shade}" stop-opacity="0"/><stop offset="100%" stop-color="${shade}" stop-opacity=".7"/></radialGradient>
</defs>
<rect width="100%" height="100%" fill="${ground}"/>
<svg width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<rect width="1600" height="1000" fill="url(#dots)" opacity=".09" mask="url(#edges)"/>
<g class="wide">${map(TR, TR_LINKS, [['fabcg', 26, 0], ['edcf', 34, 15]], 'c', 0)}</g>
<g class="wide">${map(BL, BL_LINKS, [['fabdg', 30, 8], ['ecdb', 22, 3]], 'a', 6)}</g>
<rect class="scan" x="0" y="0" width="1600" height="2"/>
<rect width="1600" height="1000" fill="url(#vignette)"/>
</svg>
</svg>`
}

/** The variant's look for `$.theme.set`, and the contrast lines makeColors found. */
export function lookFor(v: Variant): { look: ThemeSetArgs; problems: string[] } {
  const { surfaces, text, roles } = v.look
  const { theme, problems } = makeColors({
    label: v.label,
    only: 'dark',
    roles,
    dark: {
      gray: {
        anchors: {
          'surface-0': surfaces[0],
          'surface-1': surfaces[1],
          'surface-2': surfaces[2],
          'surface-3': surfaces[3],
          'text-primary': text[0],
          'text-secondary': text[1],
          'text-muted': text[2],
        },
      },
    },
  })
  return {
    look: {
      colors: theme,
      backdrop: { scene: sceneName(v), glass: { blur: 14, tint: surfaces[0], opacity: 0.72 } },
    },
    problems,
  }
}
