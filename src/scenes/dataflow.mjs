import { LABELS, TYPES } from '../state.mjs';
import { glyph, glow } from '../draw.mjs';
import { P, circle, clamp, label, line, pipe, rect, screw } from '../porcelain.mjs';
import { roundedRoute, routePoint } from '../kinematics.mjs';
import { AMBER, RED, ellipse, polygon, statusColor } from './scene-utils.mjs';

const TRAVEL = 1.12;
const SETTLE = .8;
const SOCKETS = [
  [305, .22], [895, .22], [1050, .50], [875, .77], [325, .77], [150, .50]
];

function boardLayout(height, navBottom) {
  const first = Math.max(133, height * SOCKETS[0][1], navBottom + 73);
  const last = height * .77;
  const center = { x: 600, y: (first + last) / 2 };
  const ports = SOCKETS.map(([x, depth]) => {
    const y = depth === .22 ? first : depth === .77 ? last : center.y;
    const side = Math.sign(x - center.x);
    const level = Math.sign(y - center.y);
    // Route from the edge of one casting to the edge of the next.
    const a = [center.x + side * (level ? 89 : 137), center.y + (level ? level * 48 : 11)];
    const b = [x - side * (level ? 66 : 90), y + (level ? 12 - level * 31 : 11)];
    const elbow = a[0] + side * (level ? 46 : 64);
    const run = Math.min(105, Math.abs(b[0] - elbow) - 16);
    const route = roundedRoute([a, [elbow, a[1]], [elbow + side * run, b[1]], b], 14);
    return { x, y, route };
  });
  return { center, ports };
}

// Cast parts have a flat die face and angled shoulders. The broad front lip
// leaves room for engraved identifiers even in the short landscape window.
function housing(ctx, x, y, radius, depth, top, face, stroke = P.edge) {
  const dx = radius * .66, dy = radius * .39;
  const outline = [[-radius, 0], [-dx, -dy], [dx, -dy], [radius, 0], [dx, dy], [-dx, dy]]
    .map(([u, v]) => [x + u, y + v]);
  const bottom = outline.map(([u,v]) => [u, v + depth]);
  polygon(ctx, bottom, face, stroke, .9);
  for (const i of [3, 4, 5]) {
    const j = (i + 1) % 6;
    polygon(ctx, [outline[i], outline[j], bottom[j], bottom[i]], i === 3 ? '#d0cbc0' : face, stroke, .75);
  }
  polygon(ctx, outline, top, stroke, .9);
  line(ctx, outline.slice(0, 4).map(([u, v]) => [u, v + 1]), '#fffefc', .85);
}

function enamel(ctx, y, r) {
  const finish = ctx.createLinearGradient(0, y - r * .45, 0, y + r * .55);
  finish.addColorStop(0, P.white);
  finish.addColorStop(.67, '#f7f5ef');
  finish.addColorStop(1, P.shade);
  return finish;
}

function base(ctx, x, y, r) {
  ctx.save();
  ctx.shadowColor = '#7e746330';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  housing(ctx, x, y + 9, r, 7, P.enamel, '#e0dcd3');
  ctx.restore();
  housing(ctx, x, y + 4, r - 3, 6, P.white, '#d7d3c9');
  // Machined side slots and countersunk corner bolts.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const px = x + side * (r * .71 + i * r * .036);
      const py = y + r * (.32 - i * .037);
      line(ctx, [[px, py + 10], [px, py + 13.5]], '#afaa9e', .9);
    }
    for (const edge of [-1, 1]) screw(ctx, x + side * r * .65, y + edge * r * .335 + 4, 2.1);
  }
}

function contact(ctx, point, color) {
  circle(ctx, ...point, 4.4, P.shade, P.edge, .8);
  circle(ctx, ...point, 2.1, color, P.white, .8);
}

function conduit(ctx, route) {
  for (const offset of [-7, 7]) {
    ctx.save();
    ctx.translate(0, offset);
    line(ctx, route.points, '#c7c2b6', .85);
    ctx.restore();
  }
  pipe(ctx, route, 6);
  for (const u of [.12, .88]) {
    const [x, y] = routePoint(route, u);
    const ahead = routePoint(route, u + .012);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(ahead[1] - y, ahead[0] - x));
    rect(ctx, -2.8, -5, 5.6, 10, 1.2, P.white, P.edge, .8);
    line(ctx, [[0, -3.7], [0, 3.7]], '#c8c3b8', .7);
    ctx.restore();
  }
}

function toolHousing(ctx, port, type) {
  const {x, y} = port;
  base(ctx, x, y, 90);
  housing(ctx, x, y - 4, 74, 13, enamel(ctx, y, 74), P.enamel);
  housing(ctx, x, y - 12, 59, 6, P.white, P.shade);
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const xx = x + sign * (33 + i * 4.3);
      line(ctx, [[xx, y - 17 + i], [xx, y - 9 + i]], '#cfcbbf', .85);
    }
  }
  circle(ctx, x, y - 12, 17, P.enamel, '#d6d1c6', .8);
  glyph(ctx, type, x, y - 12, 10, P.ink);
  // The track color is a permanent tool key, the pilot light denotes activity.
  rect(ctx, x - 22, y + 6, 44, 2, 1, P[type], null);
  label(ctx, LABELS[type], x - 4, y + 25, 15, P.ink, 'center', true);
  rect(ctx, x - 49, y + 39, 98, 14, 2, P.enamel, P.edge, .7);
}

function toolStatus(ctx, port, type, count, status, age) {
  const {x, y} = port;
  const active = status === 'started' || status === 'waiting';
  const color = statusColor({toolType: type, status});
  const pilot = active || age < SETTLE + TRAVEL ? color : P.white;
  if (active || age < 1) glow(ctx, x + 43, y + 25, 15, color, .35);
  circle(ctx, x + 43, y + 25, 3.7, pilot, '#a8a296', 1);
  const stateName = {started:'ACTIVE', waiting:'WAIT', failed:'ERROR', unknown:'UNKNOWN', completed:'DONE'};
  const stateInk = status === 'failed' ? '#994d42' : status === 'unknown' || status === 'waiting' ? '#886522' : P.ink;
  label(ctx, String(count).padStart(3, '0') + ' · ' + (stateName[status] || 'IDLE'), x, y + 46, 10.5, stateInk, 'center');
}

function coreSocket(ctx, center) {
  const {x, y} = center;
  base(ctx, x, y, 139);
  // A retaining ring sits between the ceramic die and the larger socket.
  ellipse(ctx, x, y - 6, 125, 47, P.shade, '#b6afa3', .75);
  ellipse(ctx, x, y - 8, 125, 47, P.white, P.edge, .8);
  ellipse(ctx, x, y - 8, 117, 42, P.enamel, P.edge, .65);
  for (let i = 0; i < 96; i++) {
    const a = i * Math.PI / 48;
    const u = Math.cos(a), v = Math.sin(a), major = i % 8 === 0;
    line(ctx, [[x + 123 * u, y - 8 + 45 * v], [x + (major ? 116 : 120) * u, y - 8 + (major ? 41 : 43) * v]], '#b3aea3', major ? 1 : .55);
  }
  for (let i = 0; i < 3; i++) {
    housing(ctx, x, y - 4 - i * 5, 108, 4.5, P.enamel, i === 1 ? '#cec7bb' : P.white);
  }
  // Paired contact pads between the socket and ceramic package.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 19; i++) {
      const px = x - 56 + i * 6.2, py = y - 16 + side * 40;
      rect(ctx, px, py, 3.4, 6, .7, i % 4 === 0 ? '#c9b18a' : '#dfd5c2', '#bcb5a8', .45);
    }
  }
  rect(ctx, x - 70, y + 24, 140, 18, 3, P.enamel, P.edge, .8);
}

function coreDie(ctx, x, top) {
  housing(ctx, x, top + 5, 89, 9, P.enamel, '#d4cfc3');
  housing(ctx, x, top, 88, 5, enamel(ctx, top, 88), P.white);
  for (const side of [-1, 1]) {
    for (const edge of [-1, 1]) screw(ctx, x + side * 55, top + edge * 28, 2.5);
    for (let k = 0; k < 7; k++) {
      const px = x + side * (34 + k * 4);
      line(ctx, [[px, top - 15], [px + side * 9, top - 6], [px + side * 9, top + 4]], '#cbc6ba', .7);
    }
  }
  circle(ctx, x, top - 5, 16.5, P.enamel, P.edge, .7);
  glyph(ctx, 'agents', x, top - 5, 10, P.ink);
  label(ctx, 'AGENT CORE', x, top + 21, 16, P.ink, 'center', true);
}

function coreStatus(ctx, center, state, activity) {
  const {x, y} = center;
  label(ctx, state.agents.length + ' AGENTS · ' + state.counts.active + ' ACTIVE', x, y + 33, 11, P.ink, 'center');
  for (let j = -3; j <= 3; j++) rect(ctx, x + j * 6 - 1.6, y + 50, 3.2, 2, .5, activity > Math.abs(j) / 4 ? P.gold : P.shade, P.edge, .4);
}

function signal(ctx, route, event, age, reduced) {
  const waiting = event.status === 'waiting';
  const returning = event.status !== 'started' && !waiting;
  const color = statusColor(event);
  if (!reduced && !waiting && age < TRAVEL) {
    const u = age / TRAVEL;
    for (let i = 15; i >= 0; i--) {
      const tail = u - i * .012;
      if (tail < 0) continue;
      const p = routePoint(route, returning ? 1 - tail : tail);
      ctx.globalAlpha = 1 - i / 16;
      circle(ctx, ...p, 3.5 - .14 * i, color);
      if (i === 0) {
        glow(ctx, ...p, 17, color, .65);
        circle(ctx, ...p, 2, P.white);
      }
    }
    ctx.globalAlpha = 1;
  } else {
    const settleAt = reduced || waiting ? 0 : TRAVEL;
    const u = clamp((age - settleAt) / (TRAVEL + SETTLE - settleAt));
    const p = returning ? route.points[0] : route.points.at(-1);
    ctx.globalAlpha = 1 - u;
    circle(ctx, ...p, reduced ? 6 : 5 + u * 16, null, color, 1.3);
    circle(ctx, ...p, 3.3, color);
    ctx.globalAlpha = 1;
  }
}

function branchNodes(ctx, port, branches, height, time, reduced) {
  let index = 0;
  for (const b of branches) {
    const col = b.status === 'failed' ? RED : b.status === 'unknown' || b.status === 'waiting' ? AMBER : P.agents;
    const socket = Math.ceil(index / 2) * (index % 2 ? -1 : 1);
    const x = port.x + socket * 76;
    const y = Math.min(height - 48, port.y + 104);
    const end = [x, y];
    const path = roundedRoute([[port.x, port.y + 34], [port.x, y - 27], [x, y - 27], end], 5);
    const u = reduced ? 1 : clamp((time - b.born) / .62);
    const tip = routePoint(path, u);
    const points = path.points.filter((_, i) => path.distances[i] < u * path.length);
    line(ctx, [...points, tip], '#b4aca0', 1.3);
    if (u >= 1) {
      housing(ctx, x, y, 15, 3, P.white, P.shade);
      circle(ctx, x, y, 3, col, P.edge, .7);
      const agent = b.id.length <= 10 ? b.id : '…' + b.id.slice(-8);
      label(ctx, agent, x, y + 17, 9, P.ink, 'center');
    }
    index++;
  }
}

export default class DataFlow {
  constructor() {
    this.pulses = [];
    this.latest = new Map();
    this.branches = new Map();
    this.layout = null;
  }

  onEvent(event, t) {
    const update = { ...event, at: t };
    this.latest.set(event.toolType, update);
    this.pulses.push(update);
    if (this.pulses.length > 100) this.pulses.shift();
    if (event.parentAgentId) {
      const key = JSON.stringify([event.source, event.sessionId, event.agentId]);
      const born = this.branches.get(key)?.born ?? t;
      this.branches.set(key, {id: event.agentId, born, status: event.status});
      if (this.branches.size > 6) this.branches.delete(this.branches.keys().next().value);
    }
  }

  render(ctx, t, dt, state) {
    const height = state.viewport.height;
    const nav = state.viewport.navigation?.bottom ?? 0;
    const scale = Math.min(2, ctx.getTransform().a);
    if (!this.layout || height !== this.height || nav !== this.nav || scale !== this.scale) {
      this.height = height;
      this.nav = nav;
      this.scale = scale;
      this.layout = boardLayout(height, nav);
      // Tube walls, castings and their soft shadows only change on resize.
      this.plate = new OffscreenCanvas(Math.ceil(1200 * scale), Math.ceil(height * scale));
      const plateCtx = this.plate.getContext('2d');
      plateCtx.scale(scale, scale);
      for (const p of this.layout.ports) conduit(plateCtx, p.route);
      coreSocket(plateCtx, this.layout.center);
      this.layout.ports.forEach((p, i) => {
        toolHousing(plateCtx, p, TYPES[i]);
        contact(plateCtx, p.route.points[0], P.shade);
        contact(plateCtx, p.route.points.at(-1), P[TYPES[i]]);
      });
      this.die = new OffscreenCanvas(Math.ceil(188 * scale), Math.ceil(93 * scale));
      const dieCtx = this.die.getContext('2d');
      dieCtx.scale(scale, scale);
      coreDie(dieCtx, 94, 36);
    }
    const {center, ports} = this.layout;
    this.pulses = this.pulses.filter(e => t - e.at < TRAVEL + SETTLE);
    const counts = new Map();
    const running = new Map();
    for (const call of state.calls) {
      counts.set(call.toolType, (counts.get(call.toolType) || 0) + 1);
    }
    for (const call of state.active) {
      if (running.get(call.toolType) !== 'started') running.set(call.toolType, call.status);
    }
    const activity = this.pulses.reduce((v, e) => Math.max(v, 1 - (t - e.at) / (TRAVEL + SETTLE)), 0);
    branchNodes(ctx, ports[4], this.branches.values(), height, t, state.reducedMotion);
    ctx.drawImage(this.plate, 0, 0, this.plate.width / scale, this.plate.height / scale);
    const lift = state.reducedMotion ? 0 : activity * (1.6 + Math.sin(t * 4) * 1.2);
    ctx.drawImage(this.die, center.x - 94, center.y - 72 - lift, this.die.width / scale, this.die.height / scale);
    coreStatus(ctx, center, state, activity);
    ports.forEach((p, i) => {
      const type = TYPES[i], latest = this.latest.get(type), age = latest ? t - latest.at : Infinity;
      const recent = age < TRAVEL + SETTLE;
      const status = recent && latest.status === 'failed' ? 'failed' : running.get(type) || (recent ? latest.status : undefined);
      if (running.has(type)) {
        ctx.save();
        ctx.globalAlpha = .65;
        line(ctx, p.route.points, statusColor({toolType:type, status:running.get(type)}), 1.25);
        ctx.restore();
      }
      toolStatus(ctx, p, type, counts.get(type) || 0, status, age);
    });
    for (const e of this.pulses) signal(ctx, ports[TYPES.indexOf(e.toolType)].route, e, t - e.at, state.reducedMotion);
  }
}
