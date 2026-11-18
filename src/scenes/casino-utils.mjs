import { P, TAU, clamp, circle, line, rect, label, screw, panel } from '../porcelain.mjs';

export const TYPES = ['files', 'shell', 'search', 'web', 'agents', 'other'];
export const RED = '#bd7067';
export const hash = value => {
  let n = 2166136261;
  for (const char of String(value)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
};
export const keyOf = e => JSON.stringify([e.source, e.sessionId, e.callId || e.id]);
export const terminal = status => ['completed', 'failed', 'unknown'].includes(status);
export const colorOf = e => e?.status === 'failed' ? RED : ['waiting', 'unknown'].includes(e?.status) ? P.gold : P[e?.toolType] || P.muted;
export const short = (value, n = 26) => String(value || '').length > n ? `${String(value).slice(0, n - 1)}…` : String(value || '');
export const progress = (call, t, reduced = false) => reduced ? 1 : clamp((t - call.start) / call.duration);
export const easeOut = p => 1 - (1 - clamp(p)) ** 3;

// A start owns one motion. Status changes never create a second ticket.
export function accept(calls, retired, e, t) {
  const key = keyOf(e);
  if (retired.has(key)) return null;
  let call = calls.get(key);
  if (call) {
    if (call.event.id === e.id || (terminal(call.event.status) && !terminal(e.status))) return null;
    if (call.event.status === e.status) return null;
    call.event = { ...e };
    call.changed = t;
    return { call, fresh: false };
  }
  call = { key, event: { ...e }, seed: hash(key), born: t, changed: t, start: t, duration: 0, launched: false };
  calls.set(key, call);
  let evicted;
  if (calls.size > 120) {
    const oldest = calls.keys().next().value;
    evicted = calls.get(oldest);
    calls.delete(oldest);
    // Keep identity-only tombstones, not events or animation tickets, after visual eviction.
    retired.add(oldest);
    if (retired.size > 6000) retired.delete(retired.values().next().value);
  }
  return { call, fresh: true, evicted };
}

export function glyph(c, type, x, y, size = 20, color = P.ink) {
  c.save(); c.translate(x, y); c.scale(size / 20, size / 20);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.lineWidth = 2;
  if (type === 'files') {
    c.beginPath(); c.moveTo(-16, -10); c.lineTo(-4, -10); c.lineTo(0, -5); c.lineTo(17, -5);
    c.lineTo(17, 13); c.lineTo(-16, 13); c.closePath(); c.stroke();
    line(c, [[-11, -15], [2, -15], [6, -11], [13, -11]], color, 2);
  } else if (type === 'shell') {
    rect(c, -18, -14, 36, 29, 3, null, color, 2);
    line(c, [[-11, -6], [-4, 0], [-11, 6]], color, 2.6);
    line(c, [[2, 7], [11, 7]], color, 2.6);
  } else if (type === 'search') {
    circle(c, -4, -4, 11, null, color, 2.5);
    line(c, [[4, 4], [15, 15]], color, 3.5);
    line(c, [[-8, -4], [0, -4]], color, 1.5);
  } else if (type === 'web') {
    circle(c, 0, 0, 17, null, color, 2);
    c.beginPath(); c.ellipse(0, 0, 7, 17, 0, 0, TAU); c.stroke();
    line(c, [[-16, -6], [16, -6]], color, 1.4);
    line(c, [[-16, 6], [16, 6]], color, 1.4);
  } else if (type === 'agents') {
    line(c, [[0, -8], [0, 0], [-13, 0], [-13, 8]], color, 2);
    line(c, [[0, 0], [13, 0], [13, 8]], color, 2);
    for (const [a, b] of [[0, -12], [-13, 12], [13, 12]]) rect(c, a - 4, b - 4, 8, 8, 2, null, color, 2);
  } else {
    c.beginPath(); c.moveTo(0, -18); c.lineTo(17, 0); c.lineTo(0, 18); c.lineTo(-17, 0); c.closePath(); c.stroke();
    rect(c, -4, -4, 8, 8, 1, color, null);
  }
  c.restore();
}

export function ellipse(c, x, y, rx, ry, fill, stroke = P.edge, width = .8) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}

export function lamp(c, x, y, color = null, radius = 4) {
  circle(c, x, y + .8, radius + 2, '#e1ddd4', P.edge, .6);
  circle(c, x, y, radius, color || '#f8f7f2', '#fff', 1.3);
  circle(c, x - radius * .25, y - radius * .3, radius * .25, '#ffffffa0');
}

export function pulley(c, x, y, r, angle = 0) {
  c.save(); c.translate(x, y); c.rotate(angle);
  circle(c, 1, 3, r + 2, '#d9d5cb', '#c4bfb4', .8);
  circle(c, 0, 0, r, '#fcfbf8', '#bdb8ac', .9);
  circle(c, 0, 0, r - 4, '#eeeae2', '#d3cec3', .8);
  circle(c, 0, 0, r - 8, null, '#fff', 2);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const p = [[Math.cos(a) * 5, Math.sin(a) * 5], [Math.cos(a) * (r - 7), Math.sin(a) * (r - 7)]];
    line(c, p, '#c6c0b4', 5); line(c, p, '#fffefa', 3);
    screw(c, Math.cos(a) * (r - 10), Math.sin(a) * (r - 10), 1.4);
  }
  circle(c, 0, 0, 7, P.white, P.edge); screw(c, 0, 0, 2.4); c.restore();
}

export function tube(c, points, width = 14) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  line(c, points, '#c1bcb060', width + 2);
  line(c, points, '#fffefa90', width);
  line(c, points, '#d5d0c450', width - 5);
  line(c, points.map(([x, y]) => [x - width * .28, y]), '#ffffffb0', 2);
  c.restore();
}

export function signalScreen(c, x, y, w, h, event, counts = {}) {
  const compact = h < 150;
  panel(c, x, y, w, h, '#e8e5dc');
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#e1e3dc'); g.addColorStop(.3, '#f7f8ef'); g.addColorStop(1, '#ebece3');
  rect(c, x + 8, y + 8, w - 16, h - 16, 6, g, '#b7b9ac', 1.2);
  c.save(); rect(c, x + 12, y + 12, w - 24, h - 24, 4, null, null); c.clip();
  for (let i = 0; i < h; i += 4) line(c, [[x + 12, y + i], [x + w - 12, y + i]], '#b3bca411', .7);
  label(c, 'LOCAL TOOL SIGNAL', x + 24, y + (compact ? 20 : 29), compact ? 9 : 11, P.muted);
  line(c, [[x + 24, y + (compact ? 32 : 44)], [x + w - 24, y + (compact ? 32 : 44)]], '#ccd0c1', .7);
  glyph(c, event?.toolType || 'other', x + (compact ? 43 : 49), y + (compact ? 60 : h * .48), compact ? 18 : 25, event ? colorOf(event) : '#b2b5a8');
  const textX = x + (compact ? 73 : 89);
  label(c, short(event?.tool || 'STANDBY', Math.floor((w - 112) / 12)), textX, y + (compact ? 54 : h * .43), compact ? 17 : 21, P.ink, 'left', true);
  label(c, (event?.status || 'AWAITING SIGNAL').toUpperCase(), textX, y + (compact ? 75 : h * .43 + 26), compact ? 9 : 10, event ? colorOf(event) : P.muted);
  label(c, short(event?.target || 'LOCAL / READ ONLY', Math.floor((w - 48) / 7)), x + 24, y + (compact ? 94 : h * .70), compact ? 10 : 12, P.muted);
  line(c, [[x + 24, y + h - (compact ? 30 : 42)], [x + w - 24, y + h - (compact ? 30 : 42)]], '#ccd0c1', .7);
  label(c, `${counts.active || 0} ACTIVE`, x + 24, y + h - (compact ? 17 : 25), compact ? 9 : 10, P.muted);
  label(c, `${counts.completed || 0} DONE`, x + w - 25, y + h - (compact ? 17 : 25), compact ? 9 : 10, P.muted, 'right');
  lamp(c, x + w - 27, y + 27, event ? colorOf(event) : null, 3);
  c.restore();
}
