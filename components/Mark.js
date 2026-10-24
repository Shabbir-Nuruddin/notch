import Svg, { Line, Path } from 'react-native-svg';
import { TEXT } from '../theme';

// The app mark: the day as an open ring, with the needle at "now".
export function Mark({ size = 28, color = TEXT, needle = '#FF6A3D' }) {
  const c = 50;
  const r = 36;
  const p = (deg, rad = r) => {
    const t = (deg * Math.PI) / 180;
    return [c + rad * Math.sin(t), c - rad * Math.cos(t)];
  };
  const [x0, y0] = p(-150);
  const [x1, y1] = p(150);
  const [nx0, ny0] = p(38, 12);
  const [nx1, ny1] = p(38, 46);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Notch">
      <Path d={`M${x0} ${y0}A${r} ${r} 0 1 1 ${x1} ${y1}`} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Line x1={nx0} y1={ny0} x2={nx1} y2={ny1} stroke={needle} strokeWidth={10} strokeLinecap="round" />
    </Svg>
  );
}
