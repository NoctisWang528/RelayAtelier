// The drawn glass tube and its moving light share the same rounded centreline.
export function roundedRoute(vertices, radius = 18) {
  const points = [vertices[0]];
  for (let i = 1; i < vertices.length - 1; i++) {
    const a = vertices[i - 1], b = vertices[i], d = vertices[i + 1];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bd = Math.hypot(d[0] - b[0], d[1] - b[1]);
    if (!ab || !bd) continue;
    const cut = Math.min(radius, ab / 2, bd / 2);
    const p = b.map((v, k) => v + (a[k] - v) * cut / ab);
    const q = b.map((v, k) => v + (d[k] - v) * cut / bd);
    points.push(p);
    for (let step = 1; step <= 16; step++) {
      const u = step / 16;
      points.push(p.map((v, k) => (1-u)**2*v + 2*(1-u)*u*b[k] + u*u*q[k]));
    }
  }
  points.push(vertices.at(-1));
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]));
  return {points, distances, length: distances.at(-1)};
}

export function routePoint(route, fraction) {
  const distance = Math.max(0, Math.min(1, fraction)) * route.length;
  for (let i = 1; i < route.points.length; i++) {
    if (distance > route.distances[i]) continue;
    const span = route.distances[i] - route.distances[i-1];
    const u = span ? (distance - route.distances[i-1]) / span : 0;
    return route.points[i].map((v, k) => route.points[i-1][k] + (v-route.points[i-1][k])*u);
  }
  return route.points.at(-1);
}
