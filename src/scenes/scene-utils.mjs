export const TOOLS = ['files', 'shell', 'search', 'web', 'agents', 'other'];
export const COLORS = { files: '#6b9f76', shell: '#bd974f', search: '#7e9cc3', web: '#aa91b9', agents: '#c7897b', other: '#969b91' };
export const PAPER = '#faf9f6';
export const ENAMEL = '#fdfcf9';
export const EDGE = '#c5c2ba';
export const INK = '#383730';
export const MUTED = '#969289';
export const AMBER = '#bc9848';
export const RED = '#bd7067';
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const lerp = (a, b, n) => a + (b - a) * n;
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
export const toolColor = event => COLORS[event.toolType] || COLORS.other;
export const uncertain = status => status === 'unknown' || status === 'waiting';
export const statusColor = event => event.status === 'failed' ? RED : uncertain(event.status) ? AMBER : toolColor(event);
export const short = (value, length = 16) => { const s = String(value || ''); return s.length > length ? `${s.slice(0, length - 1)}…` : s; };
export const serial = value => String(value || '').slice(-5).toUpperCase();

export function label(ctx, text, x, y, size = 11, color = MUTED, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), x, y);
}

export function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function box(ctx, x, y, w, h, radius, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function metal(ctx, x, y, w, h, radius = 4) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.12, '#fdfcf9');
  g.addColorStop(0.52, '#eeece6');
  g.addColorStop(0.94, '#e4e1da');
  g.addColorStop(1, '#fdfcf9');
  box(ctx, x, y, w, h, radius, g, EDGE);
}

export function disc(ctx, x, y, radius, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function screw(ctx, x, y, radius = 3) {
  disc(ctx, x, y + 1, radius + .6, '#d8d5ce');
  disc(ctx, x, y, radius, '#fdfcf9', '#b9b7af', .65);
  line(ctx, [[x - radius * .55, y + radius * .4], [x + radius * .55, y - radius * .4]], '#b0ada4', .7);
}

export function statusMark(ctx, status, x, y, size = 8, color = INK) {
  ctx.save();
  ctx.lineCap = 'round';
  if (status === 'failed') {
    line(ctx, [[x - size, y - size], [x + size, y + size]], RED, 2);
    line(ctx, [[x + size, y - size], [x - size, y + size]], RED, 2);
  } else if (status === 'completed') {
    line(ctx, [[x - size, y], [x - size * .25, y + size * .6], [x + size, y - size * .7]], color, 1.8);
  } else if (uncertain(status)) {
    ctx.setLineDash([3, 3]);
    box(ctx, x - size, y - size, size * 2, size * 2, 2, null, AMBER, 1.5);
    ctx.setLineDash([]);
    if (status === 'waiting') {
      line(ctx, [[x - 2, y - 3], [x - 2, y + 3]], AMBER, 1.4);
      line(ctx, [[x + 2, y - 3], [x + 2, y + 3]], AMBER, 1.4);
    } else label(ctx, '?', x, y + .5, size * 1.5, AMBER, 'center');
  } else {
    polygon(ctx, [[x - size * .5, y - size], [x + size * .7, y], [x - size * .5, y + size]], null, color, 1.5);
  }
  ctx.restore();
}

export function glyph(ctx, type, x, y, size = 16, color = INK) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'files') {
    polygon(ctx, [[-12, -7], [-3, -7], [0, -3], [12, -3], [12, 10], [-12, 10]], null, color, 1.5);
    line(ctx, [[-8, -11], [1, -11], [5, -7], [10, -7]], color, 1.5);
  } else if (type === 'shell') {
    box(ctx, -13, -10, 26, 21, 3, null, color, 1.5);
    line(ctx, [[-8, -4], [-3, 1], [-8, 6]], color, 1.8);
    line(ctx, [[2, 6], [8, 6]], color, 1.8);
  } else if (type === 'search') {
    disc(ctx, -3, -3, 8, null, color, 1.7);
    line(ctx, [[3, 3], [12, 12]], color, 2.5);
    line(ctx, [[-6, -3], [0, -3]], color, 1.3);
  } else if (type === 'web') {
    disc(ctx, 0, 0, 12, null, color, 1.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    line(ctx, [[-11, -4], [11, -4]], color, 1);
    line(ctx, [[-11, 4], [11, 4]], color, 1);
  } else if (type === 'agents') {
    line(ctx, [[0, -6], [0, 0], [-10, 0], [-10, 6]], color, 1.5);
    line(ctx, [[0, 0], [10, 0], [10, 6]], color, 1.5);
    [[0, -10], [-10, 10], [10, 10]].forEach(([a, b]) => box(ctx, a - 3, b - 3, 6, 6, 1, null, color, 1.5));
  } else {
    polygon(ctx, [[0, -13], [12, 0], [0, 13], [-12, 0]], null, color, 1.5);
    box(ctx, -3, -3, 6, 6, 1, color);
  }
  ctx.restore();
}

// Rendering never advances a queue: inactive scenes receive the same analytical clock.
export function upsertCall(calls, event, t, limit = 120) {
  const key = event.callId || event.id;
  let record = calls.get(key);
  if (record) {
    if (record.event.id === event.id && record.event.status === event.status) return { record, fresh: false, changed: false };
    record.event = { ...event, visualCount: event.visualCount ?? record.event.visualCount };
    record.changedAt = t;
    return { record, fresh: false, changed: true };
  }
  let evicted;
  if (calls.size >= limit) {
    const oldest = calls.keys().next().value;
    evicted = calls.get(oldest);
    calls.delete(oldest);
  }
  record = { event: { ...event }, born: t, changedAt: t };
  calls.set(key, record);
  return { record, fresh: true, changed: true, evicted };
}

export function footing(ctx, left, right, y, textLeft, textRight) {
  line(ctx, [[left, y], [right, y]], EDGE);
  label(ctx, textLeft, left, y + 19, 10);
  label(ctx, textRight, right, y + 19, 10, MUTED, 'right');
}

export function panel(ctx, x, y, w, h, inset = false) {
  ctx.save();
  ctx.shadowColor = '#79736526'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  box(ctx, x, y, w, h, 5, ENAMEL, EDGE);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  box(ctx, x + 3, y + 3, w - 6, h - 6, 3, null, '#dedbd4', .7);
  if (inset) box(ctx, x + 9, y + 9, w - 18, h - 18, 2, '#eeece5', '#aaa79f', .9);
  for (const a of [x + 6, x + w - 6]) for (const b of [y + 6, y + h - 6]) screw(ctx, a, b, 1.7);
  ctx.restore();
}

export function pipe(ctx, points, width = 7) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  line(ctx, points, '#c6c3ba', width + 2);
  line(ctx, points, '#eeece5', width);
  line(ctx, points.map(([x, y]) => [x - 1, y - 1]), '#fdfcf9', width * .35);
  ctx.restore();
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke = EDGE, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function cylinder(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#d8d5cc'); g.addColorStop(.24, '#fffefa'); g.addColorStop(.65, '#f4f2ec'); g.addColorStop(1, '#b9b6ae');
  box(ctx, x, y, w, h, [0, 0, w / 6, w / 6], g, EDGE);
  ellipse(ctx, x + w / 2, y + h - w / 12, w / 2, w / 8, null);
  ellipse(ctx, x + w / 2, y, w / 2, w / 8, '#fdfcf9');
}

export function dialArc(ctx, cx, cy, radius, start, end, accent = '#afada5', slots = false) {
  ctx.save();
  const band = (r, w, fill, stroke = EDGE) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.arc(cx, cy, r - w, end, start, true); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = .8; ctx.stroke();
  };
  band(radius + 14, 14, '#e4e1d8');
  band(radius, 17, '#fdfcf9');
  band(radius - 18, 10, '#efede6');
  band(radius - 29, 33, '#fffefa');
  band(radius - 63, 100, '#faf9f6');
  band(radius - 164, 10, '#dfdcd3');
  band(radius - 175, 17, '#fffefa');
  band(radius - 195, 5, accent);
  band(radius - 201, 15, '#fdfcf9');
  band(radius - 217, 170, '#f0eee7');
  for (let i = 0; i <= Math.ceil((end - start) * radius / 4); i++) {
    const a = start + i * 4 / radius;
    const tick = i % 25 === 0 ? 24 : i % 5 === 0 ? 12 : 5;
    line(ctx, [[cx + Math.cos(a) * (radius - 32), cy + Math.sin(a) * (radius - 32)], [cx + Math.cos(a) * (radius - 32 - tick), cy + Math.sin(a) * (radius - 32 - tick)]], i % 25 === 0 ? '#77756e' : '#b7b4ac', i % 25 === 0 ? 1.1 : .55);
    if (i % 20 === 0) screw(ctx, cx + Math.cos(a) * (radius - 9), cy + Math.sin(a) * (radius - 9), 2.4);
    if (i % 75 === 0) {
      line(ctx, [[cx + Math.cos(a) * (radius - 67), cy + Math.sin(a) * (radius - 67)], [cx + Math.cos(a) * (radius - 160), cy + Math.sin(a) * (radius - 160)]], '#c7c4bc', 1.2);
      ctx.save(); ctx.translate(cx + Math.cos(a) * (radius - 113), cy + Math.sin(a) * (radius - 113)); ctx.rotate(a + Math.PI / 2);
      label(ctx, String(i).padStart(4, '0'), 0, 0, 9, '#a09c92', 'center'); ctx.restore();
    }
  }
  for (let r = radius - 240; r > radius - 380; r -= 28) {
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.strokeStyle = '#d2cec4'; ctx.lineWidth = .65; ctx.stroke();
  }
  if (slots) for (let a = start + .07; a < end; a += .23) {
    ctx.save(); ctx.translate(cx + Math.cos(a) * (radius - 286), cy + Math.sin(a) * (radius - 286)); ctx.rotate(a + Math.PI / 2);
    box(ctx, -57, -14, 114, 28, 14, '#dedbd2', '#bfbbae', .8); ctx.restore();
  }
  ctx.restore();
}

export function controlBox(ctx, x, y, w, h, caption, value) {
  panel(ctx, x, y, w, h);
  box(ctx, x + 11, y + 28, w * .45, h * .5, 2, '#eeece5', EDGE);
  for (let k = 0; k < 15; k++) line(ctx, [[x + 17, y + 39 + k * 3], [x + w * .4, y + 39 + k * 3]], '#aaa89f', .65);
  const gx = x + w * .74, gy = y + h * .3, r = Math.min(w, h) * .14;
  disc(ctx, gx, gy, r + 2, '#e3e0d7', '#c5c2ba'); disc(ctx, gx, gy, r, '#fdfcf9');
  for (let k = 0; k < 9; k++) { const a = Math.PI * (1 + k / 8); line(ctx, [[gx + Math.cos(a) * r * .7, gy + Math.sin(a) * r * .7], [gx + Math.cos(a) * r * .9, gy + Math.sin(a) * r * .9]], '#a5a196', .7); }
  line(ctx, [[gx, gy], [gx - r * .4, gy - r * .6]], '#817e75'); screw(ctx, gx, gy, 2);
  for (let i = 0; i < 7; i++) box(ctx, x + w * .59 + i * w * .043, y + h * .52, 3, h * .15, 1, '#fdfcf9', EDGE, .7);
  label(ctx, caption, x + 13, y + 15, 8, MUTED);
  label(ctx, value, x + 12, y + h - 16, 10, INK);
  for (let i = 0; i < 4; i++) line(ctx, [[x + w * .61, y + h * .76 + i * 4], [x + w - 13, y + h * .76 + i * 4]], EDGE, 1.5);
}
