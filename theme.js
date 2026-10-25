import { Platform } from 'react-native';
import { NETWORKS } from './services/brainScience';

// Every screen sits on the sunrise scenery (components/Scenery.js), so
// surfaces are warm, dark and slightly see-through to let it show.
// BG is the deep earth colour under the scenery. Colour on top still
// means a brain network (services/brainScience.js).
export const BG = '#120806';
export const SURFACE = 'rgba(26,14,10,0.82)';
export const RAISED = 'rgba(54,32,24,0.9)';
export const LINE = 'rgba(255,214,184,0.14)';
export const TEXT = '#FBF5EF';
export const MUTED = '#BCA99B';
export const FAINT = '#7C685C';
export const DANGER = '#FF5A52';
export const SUCCESS = '#4CD97B';

// The network colours in a row, warm to cool. Progress (rings, bars,
// glows) is drawn in these, so finishing things lights the app up in
// the same colours as the day itself.
export const SPECTRUM = ['#FF6A3D', '#FFC53D', '#4CD97B', '#3DD6C6', '#4DA3FF', '#BF7BFF'];

// The platform's own typeface: San Francisco on iOS, Roboto on
// Android, the OS font on the web.
export const FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  default: undefined,
});

export const type = {
  hero: { fontFamily: FONT, fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -0.8, color: TEXT },
  large: { fontFamily: FONT, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5, color: TEXT },
  title: { fontFamily: FONT, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3, color: TEXT },
  headline: { fontFamily: FONT, fontSize: 17, lineHeight: 22, fontWeight: '600', color: TEXT },
  body: { fontFamily: FONT, fontSize: 17, lineHeight: 24, color: TEXT },
  sub: { fontFamily: FONT, fontSize: 15, lineHeight: 21, color: MUTED },
  caption: { fontFamily: FONT, fontSize: 13, lineHeight: 18, color: MUTED },
  digits: { fontFamily: FONT, fontVariant: ['tabular-nums'], color: TEXT },
};

export function networkColor(network) {
  return NETWORKS[network]?.color ?? MUTED;
}

// '#FF6A3D', 0.2 → 'rgba(255,106,61,0.2)'
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const NATIVE = Platform.OS !== 'web';

// 754000 ms → "12:34", 4000000 → "1:06:40"
export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// 90 → "1 h 30 min"
export function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
