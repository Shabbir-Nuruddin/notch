import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { dayStats } from '../services/progress';
import { dateKey } from '../services/taskEngine';
import { useNotch } from '../state/notch';
import { useReducedMotion } from './motion';

// ─────────────────────────────────────────────────────────────
// SCENERY
// The backdrop for every screen: a range of ridges at first light
// with a trail up to a summit. It follows today's progress. Nothing
// done is pre-dawn with stars out; every finished task lifts the sun,
// brightens the sky and lights more of the trail, and finishing the
// day puts you at the flag.
//
// Drawn in screen pixels so ridges, sun and trail keep their size on
// any phone or window.
// ─────────────────────────────────────────────────────────────

// Far to near: each layer lower, darker and flatter.
const LAYERS = [
  { base: 0.3, amp: 0.1, seed: 1.7, fill: '#D9733F' },
  { base: 0.44, amp: 0.08, seed: 4.2, fill: '#A9492A' },
  { base: 0.6, amp: 0.06, seed: 2.9, fill: '#6C2915', summit: true },
  { base: 0.8, amp: 0.05, seed: 6.1, fill: '#3A150B' },
  { base: 0.93, amp: 0.03, seed: 0.4, fill: '#1A0A05' },
];
const SUMMIT_LAYER = 2;

function geometry(w, h) {
  const rangeH = h * 0.5;
  const top = h - rangeH;
  const cx = w / 2;
  const peakH = rangeH * 0.36;
  const sigma = Math.min(140, Math.max(60, w * 0.12));

  const heightAt = (layer, x) => {
    const n =
      0.55 * Math.sin(x / 170 + layer.seed) +
      0.3 * Math.sin(x / 72 + layer.seed * 2.3) +
      0.15 * Math.sin(x / 30 + layer.seed * 5.1);
    let y = top + rangeH * (layer.base - layer.amp * n);
    if (layer.summit) y -= peakH * Math.exp(-((x - cx) ** 2) / (2 * sigma ** 2));
    return y;
  };

  const paths = LAYERS.map((layer) => {
    let d = `M0 ${h}`;
    for (let x = 0; x <= w + 8; x += 8) d += ` L${x} ${heightAt(layer, x).toFixed(1)}`;
    return `${d} L${w} ${h} Z`;
  });

  // A zigzag from the foot of the summit ridge to the top, kept just
  // under the ridge line.
  const summitY = heightAt(LAYERS[SUMMIT_LAYER], cx);
  const footY = top + rangeH * 0.95;
  const trail = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const x = i === steps ? cx : cx + (i % 2 ? 1 : -1) * sigma * 0.55 * (1 - k * 0.8);
    const y = footY + (summitY + 3 - footY) * k;
    trail.push([x, Math.max(y, heightAt(LAYERS[SUMMIT_LAYER], x) + 6)]);
  }
  const segs = trail.slice(1).map((p, i) => Math.hypot(p[0] - trail[i][0], p[1] - trail[i][1]));
  const length = segs.reduce((s, l) => s + l, 0);

  return { top, rangeH, cx, summitY, paths, trail, segs, length };
}

// The trail from the bottom up to fraction t, ending at the walker.
function trailTo(g, t) {
  let left = t * g.length;
  const pts = [g.trail[0]];
  for (let i = 0; i < g.segs.length; i++) {
    const [ax, ay] = g.trail[i];
    const [bx, by] = g.trail[i + 1];
    if (left >= g.segs[i]) {
      pts.push(g.trail[i + 1]);
      left -= g.segs[i];
    } else {
      const k = left / g.segs[i];
      pts.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
      break;
    }
  }
  return pts;
}
const line = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// Fixed so the sky doesn't change between screens.
const STARS = Array.from({ length: 60 }, (_, i) => {
  const r = (n) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: r(1), y: r(2) * 0.5, size: 0.6 + r(3) * 1.1, o: 0.3 + r(4) * 0.7 };
});

// Eases a number towards its target over ~1.4 s.
function useEased(target, from) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(from ?? target);
  const current = useRef(value);
  useEffect(() => {
    if (reduced) {
      current.current = target;
      return undefined;
    }
    const start = current.current;
    const t0 = Date.now();
    let raf;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 1400);
      const v = start + (target - start) * (1 - (1 - k) ** 3);
      current.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return reduced ? target : value;
}

// Today's share of tasks done, 0–1.
export function useDayProgress() {
  const { plans } = useNotch();
  const today = dayStats(plans[dateKey(0)]);
  return today.tasks ? today.done / today.tasks : 0;
}

// `progress` overrides today's; `rise` plays the sunrise from dark on
// mount (the home screen, once per launch).
export function Scenery({ progress, rise = false }) {
  const today = useDayProgress();
  const p = useEased(progress ?? today, rise ? 0 : undefined);
  const { width: w, height: h } = useWindowDimensions();
  const g = useMemo(() => geometry(w, h), [w, h]);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  // Never fully dark, so the ridges always read.
  const light = 0.08 + 0.92 * p;
  const night = 0.84 * (1 - light) ** 1.15;
  const sunX = g.cx + Math.min(130, w * 0.24);
  const sunY = g.top + g.rangeH * 0.5 - (g.rangeH * 0.5 + h * 0.2) * light;
  const walked = trailTo(g, p);
  const [wx, wy] = walked[walked.length - 1];
  const s = g.summitY;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2A1109" />
            <Stop offset="0.3" stopColor="#6A2713" />
            <Stop offset="0.52" stopColor="#C4532A" />
            <Stop offset="0.68" stopColor="#F29A4A" />
            <Stop offset="1" stopColor="#F7B565" />
          </LinearGradient>
          <RadialGradient id={`${id}sun`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE3A3" stopOpacity={0.7} />
            <Stop offset="0.35" stopColor="#FFC56B" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFC56B" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}night`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#060305" stopOpacity={1} />
            <Stop offset="0.6" stopColor="#0B0505" stopOpacity={0.88} />
            <Stop offset="1" stopColor="#0B0505" stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id={`${id}shade`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B0505" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#0B0505" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}sky)`} />
        <Circle cx={sunX} cy={sunY} r={170} fill={`url(#${id}sun)`} />
        <Circle cx={sunX} cy={sunY} r={26} fill="#FFF1CF" />

        {g.paths.slice(0, SUMMIT_LAYER + 1).map((d, i) => (
          <Path key={i} d={d} fill={LAYERS[i].fill} />
        ))}

        <Polyline points={line(g.trail)} fill="none" stroke="#FFE6C7" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 5" />
        <Polyline points={line(walked)} fill="none" stroke="#FFC53D" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <G>
          <Path d={`M${g.cx} ${s + 2} L${g.cx} ${s - 22}`} stroke="#FFE6C7" strokeWidth={1.6} />
          <Polygon points={`${g.cx},${s - 22} ${g.cx + 16},${s - 17} ${g.cx},${s - 12}`} fill={p >= 0.999 ? '#4CD97B' : '#FFE6C7'} />
        </G>
        <Circle cx={wx} cy={wy} r={8} fill="#FFC53D" fillOpacity={0.3} />
        <Circle cx={wx} cy={wy} r={3.5} fill="#FFE9B8" />

        {g.paths.slice(SUMMIT_LAYER + 1).map((d, i) => (
          <Path key={i} d={d} fill={LAYERS[SUMMIT_LAYER + 1 + i].fill} />
        ))}

        <G opacity={night}>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}night)`} />
          {STARS.map((star, i) => (
            <Circle key={i} cx={star.x * w} cy={star.y * h} r={star.size} fill="#FFF4E0" fillOpacity={star.o} />
          ))}
        </G>

        {/* Keeps the top of the screen dark enough for the header. */}
        <Rect x={0} y={0} width={w} height={200} fill={`url(#${id}shade)`} />
      </Svg>
    </View>
  );
}
