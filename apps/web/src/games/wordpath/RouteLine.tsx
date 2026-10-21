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
 * A revealed route is one dot per segment, at the midpoint between two tile centres: the soil gap, clear of both letters (Board.css). A wrong route shows no line (its tiles carry the dashed outline instead).
 */
export function RouteLine({ size, tile, route, state }: Props) {
  if (route.length < 2 || state === 'wrong') return null;
  const at = (c: number) => [(c % size + 0.5) * tile, (Math.floor(c / size) + 0.5) * tile] as const;
  const points = route.map(at);
  const laying = state === 'active';
  const [x1, y1] = points[points.length - 2]!;
  const [x2, y2] = points[points.length - 1]!;
  const width = tile * 0.16;
  if (state === 'revealed') {
    const r = Math.max(2.5, tile * 0.07);
    return (
      <svg className="route" width={size * tile} height={size * tile} aria-hidden="true">
        {points.slice(1).map(([x, y], i) => (
          <circle key={i} cx={(x + points[i]![0]) / 2} cy={(y + points[i]![1]) / 2} r={r} />
        ))}
      </svg>
    );
  }
  // Adjacent tiles are always one tile apart, so the polyline is (length - 1) tiles long.
  const dash = laying ? `${(route.length - 2) * tile} ${tile * 2}` : undefined;

  return (
    <svg className="route" width={size * tile} height={size * tile} aria-hidden="true">
      <polyline points={points.map((p) => p.join(',')).join(' ')} strokeWidth={width} strokeDasharray={dash} />
      {laying && <line key={route.slice(-2).join('-')} className="route-seg" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={width} />}
    </svg>
  );
}
