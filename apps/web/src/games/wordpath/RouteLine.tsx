import type { RouteState } from './Board';

interface Props {
  size: number;
  tile: number;
  route: readonly number[];
  state: RouteState;
}

/**
 * The route as a line through tile centres, under the pavers so it shows as bridges between them.
 * While the player lays the route, the newest segment is its own `<line>` so it can draw in
 * (`drawSegment`); the polyline's dash pattern leaves that last segment to it.
 * A wrong route shows no line (its tiles carry the dashed outline instead).
 */
export function RouteLine({ size, tile, route, state }: Props) {
  if (route.length < 2 || state === 'wrong') return null;
  const at = (c: number) => [(c % size + 0.5) * tile, (Math.floor(c / size) + 0.5) * tile] as const;
  const points = route.map(at);
  const laying = state === 'active';
  const [x1, y1] = points[points.length - 2]!;
  const [x2, y2] = points[points.length - 1]!;
  // Adjacent tiles are always one tile apart, so the polyline is (length - 1) tiles long.
  const dash = state === 'revealed' ? `1 ${tile * 0.22}` : laying ? `${(route.length - 2) * tile} ${tile * 2}` : undefined;
  const width = tile * (state === 'revealed' ? 0.12 : 0.16);

  return (
    <svg className="route" width={size * tile} height={size * tile} aria-hidden="true">
      <polyline points={points.map((p) => p.join(',')).join(' ')} strokeWidth={width} strokeDasharray={dash} />
      {laying && <line key={route.slice(-2).join('-')} className="route-seg" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={width} />}
    </svg>
  );
}
