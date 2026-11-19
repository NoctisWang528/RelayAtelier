import { P, TAU, clamp, line, circle, rect, label, screw, panel, metal, pipe, vent, meter } from '../porcelain.mjs';
import { TYPES, RED, accept, terminal, progress, easeOut, colorOf, short, glyph, ellipse, lamp, pulley, tube, signalScreen } from './casino-utils.mjs';

const CX = 240, CY = 550, R = 440, STEP = TAU / 24;
const polar = (radius, angle) => [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius];

export default class Roulette {
  constructor() {
    this.calls = new Map();
    this.retired = new Set();
    this.latest = null;
    this.nextAt = 0;
    this.baseRotation = 0;
  }

  onEvent(event, t) {
    const update = accept(this.calls, this.retired, event, t);
    if (!update) return;
    const { call, evicted } = update;
    // Preserve the axle's accumulated angle when an old ticket leaves the bounded window.
    if (evicted?.launched) this.baseRotation = (this.baseRotation + evicted.travel * easeOut(progress(evicted, t))) % TAU;
    this.latest = call;
    if (event.status !== 'started' || call.launched) return;
    call.launched = true;
    call.start = Math.max(t, Math.min(this.nextAt, t + 5));
    call.duration = 2.8 + (call.seed % 9) * .09;
    call.end = call.start + call.duration;
    call.pocket = Math.max(0, TYPES.indexOf(event.toolType)) + (call.seed % 4) * TYPES.length;
    call.travel = .33 + (call.seed % 13) * .013;
    this.nextAt = call.start + .055;
  }

  rotationAt(t, reduced = false) {
    let angle = this.baseRotation;
    for (const call of this.calls.values()) if (call.launched) angle += call.travel * easeOut(progress(call, t, reduced));
    return angle;
  }

  render(c, t, dt, state = {}) {
    c.save();
    const reduced = !!state.reducedMotion, counts = state.counts || {};
    const rotation = this.rotationAt(t, reduced);
    const height = clamp(state.viewport?.height ?? 1100, 620, 1100);
    if (height < 1000) {
      this.drawCompact(c, height, counts, rotation, t, reduced);
      c.restore();
      return;
    }
    c.translate(0, height - 1100);
    this.drawWheel(c, rotation);
    this.drawReturnBack(c);
    this.drawDispatch(c, t, reduced, counts);
    this.drawSignals(c, t, reduced, rotation);
    this.drawFunnel(c);
    this.drawCounter(c, counts, rotation);
    c.restore();
  }

  drawCompact(c, height, counts, rotation, t, reduced) {
    // Crop a large circular wheel, then independently place its dispatch and return hardware.
    const scale = Math.min(1, height * .58 / R), x = 205, y = height * .48;
    const radius = R * scale, rackBottom = Math.round(height * .32), lip = rackBottom - 42;
    const end = [x + radius * .8, y + radius * .58];
    c.save(); c.translate(x - CX * scale, y - CY * scale); c.scale(scale, scale);
    this.drawWheel(c, rotation); c.restore();
    this.drawReturnBack(c, lip + 145, end, height);
    this.drawRack(c, t, reduced, rackBottom);
    this.drawControl(c, counts, rackBottom + 10, Math.min(279, height - rackBottom - 208));
    this.drawSignals(c, t, reduced, rotation, { x, y, scale, lip, end });
    c.save(); c.translate(0, lip - 360); this.drawFunnel(c); c.restore();
    const beltY = height - 114;
    const beltStart = x + Math.sqrt(Math.max(0, radius ** 2 - (beltY - y) ** 2));
    c.save(); c.translate(0, height - 1100); this.drawCounter(c, counts, rotation, beltStart); c.restore();
  }

  drawWheel(c, rotation) {
    c.save(); c.shadowColor = '#83786726'; c.shadowBlur = 16; c.shadowOffsetX = 5; c.shadowOffsetY = 8;
    circle(c, CX, CY, R, '#e9e6df', '#c5bfb4', 1); c.restore();
    const track = c.createRadialGradient(CX, CY, 290, CX, CY, 430);
    track.addColorStop(0, '#ddd8cf'); track.addColorStop(.1, '#fdfbf8'); track.addColorStop(.32, '#fcfaf6');
    track.addColorStop(.59, '#fdfcf9'); track.addColorStop(.84, '#e7e2d9'); track.addColorStop(1, '#eeebe4');
    circle(c, CX, CY, 414, track, '#c7c1b5', .8);
    for (const [radius, width, color] of [[437, 1, '#fffefa'], [421, 13, '#fcfbf8'], [414, 1, '#bcb6ab'], [409, 2, '#ded9d0'], [394, 1, '#fff'], [374, 14, '#fefdfa'], [360, .6, '#dcd6cc'], [344, .6, '#ded9cf'], [328, .8, '#ded8cd'], [309, 12, '#e9e5dc'], [300, 1, '#bcb6ab'], [293, 3, '#fff']]) circle(c, CX, CY, radius, null, color, width);
    // Fine radial engravings, white enamel bolt heads and tiny inner fasteners.
    for (let i = 0; i < 360; i++) {
      const a = i * TAU / 360;
      line(c, [polar(419, a), polar(i % 15 === 0 ? 412 : 416, a)], i % 15 === 0 ? '#9b9589' : '#c5beb1', .55);
      if (i % 6 === 0) screw(c, ...polar(416, a + .012), 1.65);
    }
    for (let i = 0; i < 24; i++) {
      const a = i * STEP;
      const [x, y] = polar(428, a);
      circle(c, x, y + 1, 9.4, '#d3cec3', '#e4e0d7', .5);
      circle(c, x, y, 8, '#fffefa', '#d5cfc3', .7);
      circle(c, x, y, 5.3, '#eeebe4', '#fff', 1.4);
      line(c, [[x - 2, y + 1.5], [x + 2, y - 1.5]], '#d0c9ba', .7);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + .4;
      c.save(); c.translate(...polar(336, a)); c.rotate(a);
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(3, -14); c.lineTo(9, 0); c.lineTo(-1, 14); c.closePath();
      c.fillStyle = '#fefdf9'; c.fill(); c.strokeStyle = '#c7c0b3'; c.lineWidth = .8; c.stroke(); screw(c, 1, 0, 1.6); c.restore();
    }
    c.save(); c.translate(CX, CY);
    circle(c, 0, 0, 289, '#eeebe4', '#bfb9ae', .8);
    // Twenty-four physical pockets: a tool plaque over a recessed radial ball slot.
    for (let i = 0; i < 24; i++) {
      const pocket = rotation + i * STEP, a = pocket - STEP / 2, b = a + STEP;
      c.beginPath(); c.arc(0, 0, 287, a, b); c.arc(0, 0, 245, b, a, true); c.closePath();
      c.fillStyle = i % 2 ? '#f8f6f0' : '#f0ede6'; c.fill(); c.strokeStyle = '#c6c0b4'; c.lineWidth = .6; c.stroke();
      const inset = c.createRadialGradient(0, 0, 218, 0, 0, 245);
      inset.addColorStop(0, '#f7f5ef'); inset.addColorStop(1, '#dad5ca');
      c.beginPath(); c.arc(0, 0, 244, a, b); c.arc(0, 0, 216, b, a, true); c.closePath(); c.fillStyle = inset; c.fill();
      line(c, [[Math.cos(a) * 216, Math.sin(a) * 216], [Math.cos(a) * 245, Math.sin(a) * 245]], '#8e8a7f', 3);
      line(c, [[Math.cos(a) * 216, Math.sin(a) * 216], [Math.cos(a) * 245, Math.sin(a) * 245]], '#fdfbf6', 1);
      circle(c, Math.cos(a) * 245, Math.sin(a) * 245, 2, '#827e73');
      c.save(); c.translate(Math.cos(pocket) * 268, Math.sin(pocket) * 268); c.rotate(pocket + Math.PI / 2);
      glyph(c, TYPES[i % TYPES.length], 0, 0, 16.5, '#706c62'); c.restore();
    }
    const center = c.createRadialGradient(-60, -90, 20, 0, 0, 218);
    center.addColorStop(0, '#fdfcf9'); center.addColorStop(1, '#f4f1eb');
    circle(c, 0, 0, 216, center, '#c7c1b6', .8);
    for (const rr of [194, 161, 128, 95]) circle(c, 0, 0, rr, null, '#ded9d0', .55);
    for (let i = 0; i < 24; i++) {
      const a = rotation + i * STEP;
      line(c, [[Math.cos(a) * 111, Math.sin(a) * 111], [Math.cos(a) * 212, Math.sin(a) * 212]], '#ddd7ce', .55);
    }
    circle(c, 0, 0, 103, '#f6f3eb', null);
    for (let i = 0; i < 36; i++) {
      const a = rotation + i * TAU / 36;
      circle(c, Math.cos(a) * 98, Math.sin(a) * 98, .85, '#c7beab');
    }
    circle(c, 1, 4, 82, '#cfcbc1'); circle(c, 0, 0, 81, '#eeebe4', '#c9c2b6', .8);
    circle(c, -1, -1, 80, null, '#fffefa', 1.5);
    for (let i = 0; i < 4; i++) {
      const a = rotation + Math.PI / 4 + i * Math.PI / 2;
      line(c, [[Math.cos(a) * 21, Math.sin(a) * 21], [Math.cos(a) * 69, Math.sin(a) * 69]], '#c3bcae', 9);
      line(c, [[Math.cos(a) * 21, Math.sin(a) * 21], [Math.cos(a) * 69, Math.sin(a) * 69]], '#fffefa', 6);
      circle(c, Math.cos(a) * 69, Math.sin(a) * 69, 9.5, '#fffefa', '#c9c2b7', .8);
    }
    circle(c, 0, 0, 33, '#f7f4ed', '#d2cbc0');
    for (let i = 0; i < 12; i++) {
      const a = rotation + i * TAU / 12;
      screw(c, Math.cos(a) * 30, Math.sin(a) * 30, 1.1, rotation);
    }
    circle(c, 0, 0, 26, '#fffefa', '#bfb8ab', .8); screw(c, 0, 0, 7, rotation);
    c.restore();
  }

  drawReturnBack(c, throatY = 505, end = [575, 739], floor = 1100) {
    // Narrow glass return chute and exposed vertical stays sit behind the wheel rim.
    for (const x of [694, 735, 780]) {
      line(c, [[x + 3, throatY + 8], [x + 3, floor]], '#ded8cd', 1);
      line(c, [[x, throatY + 8], [x, floor]], '#c9c2b4', .8);
    }
    tube(c, [[765, throatY], [765, throatY + 21], end], 30);
    for (let i = 0; i < 8; i++) {
      const p = i / 8;
      const x = 761 + p * (end[0] - 755), y = throatY + 30 + p * (end[1] - throatY - 33);
      c.save(); c.translate(x, y); c.rotate(throatY === 505 && end[0] === 575 ? .73 : Math.atan2(765 - end[0], end[1] - throatY - 21));
      metal(c, -19, -3, 38, 6, 1); screw(c, -14, 0, 1.2); screw(c, 14, 0, 1.2); c.restore();
    }
  }

  drawDispatch(c, t, reduced, counts) {
    this.drawRack(c, t, reduced);
    this.drawControl(c, counts);
  }

  drawRack(c, t, reduced, bottom = 444) {
    const dy = bottom - 444;
    // Ladder/rack is intentionally cropped at the top, as in the reference.
    c.save(); c.shadowColor = '#7e73631a'; c.shadowBlur = 8; c.shadowOffsetX = 4;
    rect(c, 989, -44, 188, 461 + dy, 7, '#f3f0e9', '#c8c1b5'); c.restore();
    for (const x of [991, 1168]) {
      metal(c, x, -44, 8, 461 + dy, 2);
      line(c, [[x + 3, -44], [x + 3, 411 + dy]], '#fefdfa', 1);
      for (let y = 14; y < 408 + dy; y += 32) screw(c, x + 4, y, 1.3);
    }
    for (let y = -29; y < 404 + dy; y += 13) {
      metal(c, 1002, y, 161, 5, 1);
      line(c, [[1004, y + 7], [1162, y + 7]], '#d8d1c5', .6);
    }
    for (const y of [69, 178, 286]) if (y < bottom - 45) for (const x of [983, 1176]) panel(c, x, y, 8, 14);
    for (let x = 1001; x < 1166; x += 3) line(c, [[x, 406 + dy], [x, 416 + dy]], '#bcb6a9', .55);
    panel(c, 985, 415 + dy, 193, 16); panel(c, 989, 434 + dy, 188, 10);
    for (const x of [994, 1170]) pulley(c, x, 421 + dy, 10, 0);
    for (const call of this.calls.values()) {
      if (!call.launched || reduced || t < call.start || t > call.start + 1) continue;
      const p = clamp(t - call.start);
      rect(c, 1051, -14 + p * (412 + dy), 60, 12, 2, '#fdfcf7', '#bdb6a8', .7);
      line(c, [[1061, -8 + p * (412 + dy)], [1102, -8 + p * (412 + dy)]], colorOf(call.event), 1.5);
    }
    // Short pneumatic dispatch cylinder aims into the cone.
    panel(c, 899, 432 + dy, 82, 13);
    c.save(); c.translate(929, 402 + dy); c.rotate(.36);
    metal(c, -69, -19, 102, 38, 2);
    rect(c, -63, -15, 42, 30, 2, '#dfdbd2', '#cbc4b8', .7);
    for (let x = -19; x < 28; x += 3) line(c, [[x, -20], [x, 20]], x % 2 ? '#fffefa' : '#bbb3a5', 1);
    metal(c, 27, -24, 7, 48, 1); metal(c, -72, -25, 6, 50, 1);
    pipe(c, [[-4, -21], [-4, -31], [36, -31], [36, 15]], 3);
    c.restore();
  }

  drawControl(c, counts, top = 452, height = 279) {
    const compact = height < 250;
    panel(c, 878, top, 301, height);
    meter(c, 923, top + (compact ? 25 : 33), compact ? 18 : 25, clamp((counts.active || 0) / 12));
    panel(c, 965, top + (compact ? 7 : 13), 203, 13);
    for (let i = 0; i < 10; i++) rect(c, 970 + i * 19, top + (compact ? 11 : 17), 16, 5, 1, i < Math.min(counts.active || 0, 10) ? '#cec4a9' : '#eeebe3', '#c9c2b6', .6);
    metal(c, 964, top + (compact ? 23 : 32), 204, compact ? 20 : 31, 2);
    label(c, short(this.latest?.event.tool || '—', 24), 974, top + (compact ? 33 : 48), 11, P.muted);
    signalScreen(c, 884, top + (compact ? 47 : 71), 288, height - (compact ? 80 : 112), this.latest?.event, counts);
    vent(c, 893, top + height - 30, 133, 5);
    panel(c, 1101, top + height - 25, 35, 9); lamp(c, 1151, top + height - 21, this.latest ? colorOf(this.latest.event) : null, 6);
    for (const y of [11, 42]) panel(c, 871, top + y, 7, 11);
  }

  drawFunnel(c) {
    const x = 765, y = 360;
    // The translucent cone has back ribs, rolled mouth, front ribs, and a throat collar.
    ellipse(c, x, y, 86, 29, '#f5f2ea70', '#bab3a5');
    c.beginPath(); c.moveTo(x - 80, y + 4); c.bezierCurveTo(x - 56, y + 34, x - 27, y + 120, x - 24, y + 151);
    c.quadraticCurveTo(x, y + 180, x + 24, y + 151); c.bezierCurveTo(x + 27, y + 120, x + 56, y + 34, x + 80, y + 4);
    c.closePath(); c.fillStyle = '#eeeae168'; c.fill(); c.strokeStyle = '#c5bdae'; c.lineWidth = 1; c.stroke();
    for (const offset of [-62, -40, -19, 0, 19, 40, 62]) {
      c.beginPath(); c.moveTo(x + offset, y + 17); c.bezierCurveTo(x + offset * .65, y + 51, x + offset * .32, y + 130, x + offset * .24, y + 157);
      c.strokeStyle = '#c4bcad'; c.lineWidth = .8; c.stroke();
      c.beginPath(); c.moveTo(x + offset + 2, y + 17); c.lineTo(x + offset * .24 + 2, y + 151); c.strokeStyle = '#fffefa'; c.lineWidth = 1; c.stroke();
    }
    for (const [dy, rx, ry] of [[34, 58, 16], [66, 45, 12], [104, 30, 9], [145, 24, 7]]) ellipse(c, x, y + dy, rx, ry, null, '#bdb4a4', .8);
    ellipse(c, x, y, 85, 29, null, '#fefdfa', 4);
    ellipse(c, x, y, 89, 31, null, '#c6beaf', .8);
    ellipse(c, x, y + 4, 80, 24, null, '#c4bcad', .8);
    for (let i = 0; i < 26; i++) {
      const a = i * TAU / 26;
      screw(c, x + Math.cos(a) * 86, y + Math.sin(a) * 29, 1.1);
    }
    ellipse(c, x, y + 150, 26, 7, '#f5f2e9c0', '#c2baac', .9);
    for (const dx of [-21, 0, 21]) screw(c, x + dx, y + 152, 1.4);
  }

  drawCounter(c, counts, rotation, beltStart = 405) {
    // Long exposed belt links the lower wheel gear to the mechanical tally.
    for (const x of [beltStart, 646]) {
      pipe(c, [[x, 1006], [x, 1071]], 3); metal(c, x - 8, 1070, 16, 5, 1); screw(c, x, 1072, 1.4);
    }
    panel(c, 878, 914, 301, 163);
    panel(c, 944, 924, 222, 21);
    label(c, short(this.latest?.event.target || '—', 29), 953, 935, 10, P.muted);
    lamp(c, 913, 938, this.latest?.event.status === 'failed' ? RED : null, 6.5);
    this.digits(c, 941, 952, 227, 59, counts.total || 0, 7, 'Σ');
    this.digits(c, 941, 1018, 92, 43, counts.completed || 0, 4, '+');
    this.digits(c, 1038, 1018, 90, 43, counts.active || 0, 4, '#');
    this.digits(c, 1133, 1018, 37, 43, counts.failed || 0, 1, '×', (counts.failed || 0) > 0 ? RED : P.ink);
    c.save(); c.lineCap = 'round';
    line(c, [[beltStart, 975], [887, 975]], '#bdb5a7', 4.5); line(c, [[beltStart, 975], [887, 975]], '#fffefa', 2.5);
    line(c, [[beltStart, 997], [887, 997]], '#bdb5a7', 4.5); line(c, [[beltStart, 997], [887, 997]], '#fffefa', 2.5);
    c.setLineDash([1, 3]); c.lineDashOffset = -rotation * 25;
    line(c, [[beltStart, 972], [887, 972]], '#aaa292', 2); line(c, [[beltStart, 1000], [887, 1000]], '#aaa292', 2); c.restore();
    pulley(c, beltStart, 986, 13, -rotation * 5); pulley(c, 887, 986, 18, -rotation * 5); pulley(c, 912, 1018, 29, rotation * 4, 28);
    c.save(); c.translate(beltStart - 17, 969); c.rotate(-.36); metal(c, -42, -5, 83, 10, 2);
    for (let x = -37; x < 40; x += 5) line(c, [[x, -3], [x, 3]], '#bab1a2', .7); c.restore();
  }

  digits(c, x, y, w, h, value, places, prefix, color = P.ink) {
    panel(c, x, y, w, h);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#e5e1d8'); g.addColorStop(.46, '#fcfaf5'); g.addColorStop(1, '#e6e1d7');
    rect(c, x + 4, y + 4, w - 8, h - 8, 2, g, '#bcb4a6', .7);
    const pw = Math.min(25, w * .23), cell = (w - pw - 9) / places;
    label(c, prefix, x + pw / 2 + 3, y + h / 2, h * .45, P.muted, 'center', true);
    const text = String(Math.max(0, Math.trunc(value))).padStart(places, '0').slice(-places);
    for (let i = 0; i < places; i++) {
      const left = x + pw + i * cell;
      line(c, [[left, y + 6], [left, y + h - 6]], '#bcb3a4', .7);
      line(c, [[left + 1, y + 6], [left + 1, y + h - 6]], '#fffefa', .8);
      label(c, text[i], left + cell / 2, y + h / 2 + 1, Math.min(h * .68, cell * 1.3), color, 'center', true);
    }
  }

  drawSignals(c, t, reduced, rotation, layout = { x: CX, y: CY, scale: 1, lip: 360, end: [575, 739] }) {
    for (const call of this.calls.values()) {
      if (!call.launched || (!reduced && t < call.start)) continue;
      const p = progress(call, t, reduced), e = call.event;
      const resultAt = Math.max(call.end, call.changed);
      const returned = terminal(e.status) && (reduced || t > resultAt + 1.65);
      if (returned && call !== this.latest) continue;
      if (returned && e.status === 'completed') continue;
      if (terminal(e.status) && e.status === 'completed' && p === 1 && !reduced) {
        // Completion sends the same ticket down the transparent cone and return chute.
        const q = clamp((t - resultAt) / 1.65);
        let x, y;
        if (q < .58) {
          const v = q / .58, radius = (1 - v) * 67;
          x = 765 + Math.cos(v * TAU * 1.5) * radius;
          y = layout.lip + 5 + v * 147 + Math.sin(v * TAU * 1.5) * radius * .18;
        } else {
          const v = (q - .58) / .42;
          x = 765 + (layout.end[0] - 765) * v;
          y = layout.lip + 159 + (layout.end[1] - layout.lip - 159) * v;
        }
        this.ball(c, x, y, colorOf(e));
        continue;
      }
      const pocket = call.pocket * STEP + rotation;
      const a = pocket - (1 - easeOut(p)) * TAU * (2 + call.seed % 2);
      const radial = (230 + 158 * (1 - easeOut(clamp((p - .5) * 2)))) * layout.scale;
      const x = layout.x + Math.cos(a) * radial, y = layout.y + Math.sin(a) * radial;
      if (p < 1 && !reduced) {
        c.save(); c.beginPath(); c.arc(layout.x, layout.y, radial, a - .12 * (1 - p), a); c.strokeStyle = '#d6c8a877'; c.lineWidth = 3; c.stroke(); c.restore();
      }
      this.ball(c, x, y, e.status === 'failed' ? RED : e.status === 'unknown' || e.status === 'waiting' ? P.gold : null);
      if (p === 1 && e.status === 'failed') {
        line(c, [[x - 3, y - 3], [x + 3, y + 3]], '#fffefa', 1);
        line(c, [[x + 3, y - 3], [x - 3, y + 3]], '#fffefa', 1);
      }
    }
  }

  ball(c, x, y, color) {
    c.save(); c.shadowColor = '#6b62583d'; c.shadowBlur = 4; c.shadowOffsetY = 2;
    const g = c.createRadialGradient(x - 2, y - 2, .5, x, y, 6);
    g.addColorStop(0, '#fffefa'); g.addColorStop(.3, color || '#fffefa'); g.addColorStop(1, color || '#c9c1af');
    circle(c, x, y, 5.6, g, color || '#b4a98f', .65); c.restore();
  }
}
