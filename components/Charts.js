import { Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { attentionWindows } from '../services/brainScience';
import { blockEnd } from '../services/taskEngine';
import { FAINT, FONT, LINE, MUTED, TEXT, alpha, networkColor, type } from '../theme';

// ─────────────────────────────────────────────────────────────
// ENERGY CHART
// The typical attention curve across a waking day (low after waking,
// a late-morning peak, an early-afternoon dip, a second peak; Valdez
// 2019, Schmidt 2007), shifted for chronotype. Each block is a bar
// under the curve: colour = brain network, height = how demanding.
// The point: the tall bars should sit under the peaks.
// ─────────────────────────────────────────────────────────────

export function EnergyChart({ blocks = [], profile, width = 340, height = 180 }) {
  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const bedtime = profile.sleep > profile.wake ? profile.sleep : profile.sleep + 1440;
  const from = Math.min(profile.wake, blocks[0]?.start ?? Infinity);
  const to = Math.max(bedtime, ...blocks.map(blockEnd));
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (m) => pad.l + ((m - from) / (to - from)) * w;
  const y = (v) => pad.t + (1 - v) * h;

  const win = attentionWindows(profile);
  const mid = (r) => (r[0] + r[1]) / 2;
  const points = [
    [from, 0.3],
    [profile.wake + 60, 0.4],
    [mid(win.peak1), 0.92],
    [mid(win.dip), 0.55],
    [mid(win.peak2), 0.86],
    [bedtime - 60, 0.4],
    [to, 0.28],
  ]
    .filter(([m]) => m >= from && m <= to)
    .sort((a, b) => a[0] - b[0]);
  const curve = smooth(points.map(([m, v]) => [x(m), y(v)]));

  const hours = [];
  for (let hr = Math.ceil(from / 60); hr * 60 <= to; hr++) if (hr % 3 === 0) hours.push(hr);

  return (
    <Svg width={width} height={height} accessibilityLabel="Your attention through the day, with each block underneath">
      {/* Peak bands */}
      {[win.peak1, win.peak2].map(([a, b], i) => (
        <Rect key={i} x={x(a)} y={pad.t} width={Math.max(0, x(b) - x(a))} height={h} fill={alpha(TEXT, 0.05)} rx={4} />
      ))}

      {/* Blocks */}
      {blocks.map((b) => {
        const color = networkColor(b.network);
        const x0 = x(b.start) + 0.5;
        const x1 = x(blockEnd(b)) - 0.5;
        if (x1 <= x0) return null;
        if (b.kind === 'break') {
          return (
            <Line key={b.id} x1={x0} y1={y(0) - 2} x2={x1} y2={y(0) - 2} stroke={color} strokeWidth={3} strokeDasharray="1 4" strokeLinecap="round" />
          );
        }
        const top = y(Math.max(0.12, b.intensity / 5) * 0.85);
        return <Rect key={b.id} x={x0} y={top} width={x1 - x0} height={y(0) - top} fill={color} opacity={0.85} rx={2} />;
      })}

      {/* Attention curve */}
      <Path d={curve} stroke={TEXT} strokeWidth={1.8} fill="none" strokeLinecap="round" />

      {/* Axis */}
      <Line x1={pad.l} y1={y(0)} x2={width - pad.r} y2={y(0)} stroke={LINE} strokeWidth={1} />
      {hours.map((hr) => (
        <G key={hr}>
          <Line x1={x(hr * 60)} y1={y(0)} x2={x(hr * 60)} y2={y(0) + 4} stroke={FAINT} strokeWidth={1} />
          <SvgText x={x(hr * 60)} y={height - 6} fill={MUTED} fontSize={10} fontFamily={FONT} textAnchor="middle">
            {String(hr % 24).padStart(2, '0')}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

// Catmull-Rom through the points, as cubic Béziers.
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ─────────────────────────────────────────────────────────────
// SWITCH STRIP
// Tasks in order, one coloured segment each. A white tick marks every
// change of brain network, which is where time is lost getting back
// up to speed.
// ─────────────────────────────────────────────────────────────

export function SwitchStrip({ label, order = [], switches, width = 340 }) {
  const n = order.length;
  if (!n) return null;
  const gap = 3;
  const seg = (width - gap * (n - 1)) / n;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.sub, { color: TEXT }]}>{label}</Text>
        <Text style={[type.sub, type.digits]}>{switches === 1 ? '1 switch' : `${switches} switches`}</Text>
      </View>
      <Svg width={width} height={22}>
        {order.map((net, i) => {
          const x0 = i * (seg + gap);
          const changed = i > 0 && order[i - 1] !== net;
          return (
            <G key={i}>
              <Rect x={x0} y={4} width={seg} height={14} rx={3} fill={networkColor(net)} />
              {changed && <Rect x={x0 - gap / 2 - 1} y={0} width={2} height={22} rx={1} fill={TEXT} />}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
