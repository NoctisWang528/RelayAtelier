import { P, TAU, clamp, line, circle, rect, label, screw, panel, metal, pipe, clampJoint, vent, meter } from '../porcelain.mjs';
import { TYPES, RED, accept, hash, progress, easeOut, colorOf, glyph, ellipse, lamp, pulley, tube, signalScreen } from './casino-utils.mjs';

const REEL_Y = 395, PITCH = 82;

export default class Slots {
  constructor() {
    this.calls = new Map();
    this.retired = new Set();
    this.nextAt = [0, 0, 0, 0, 0];
    this.sequence = 0;
    this.latest = null;
  }

  onEvent(event, t) {
    const update = accept(this.calls, this.retired, event, t);
    if (!update) return;
    const { call } = update;
    this.latest = call;
    if (event.status !== 'started' || call.launched) return;
    call.launched = true;
    call.lane = this.sequence++ % 5;
    call.start = Math.max(t, Math.min(this.nextAt[call.lane], t + 5));
    call.duration = 2.4 + (call.seed % 7) * .11;
    call.end = call.start + call.duration;
    call.type = Math.max(0, TYPES.indexOf(event.toolType));
    call.turns = 3 + hash(event.callId) % 3;
    this.nextAt[call.lane] = call.start + .22;
  }

  reelCalls(t, reduced = false) {
    const lanes = [null, null, null, null, null];
    for (const call of this.calls.values()) if (call.launched && (reduced || call.start <= t)) lanes[call.lane] = call;
    return lanes;
  }

  render(c, t, dt, state = {}) {
    c.save();
    const reduced = !!state.reducedMotion, counts = state.counts || {};
    const lanes = this.reelCalls(t, reduced);
    const motion = lanes.reduce((sum, call) => sum + (call ? easeOut(progress(call, t, reduced)) * call.turns : 0), 0);
    const pressure = clamp((counts.active || 0) / 12);
    const height = clamp(state.viewport?.height ?? 1100, 620, 1100);
    if (height < 1000) {
      this.drawCompact(c, height, pressure, motion, counts, lanes, t, reduced);
      c.restore();
      return;
    }
    c.translate(0, height - 1100);
    this.drawDial(c, motion * .055, this.latest?.event);
    this.drawPlumbing(c, pressure, motion, counts);
    this.drawCabinet(c, counts, lanes, t, reduced);
    c.restore();
  }

  drawCompact(c, height, pressure, motion, counts, lanes, t, reduced) {
    // Keep full-size reels; move the monitor and pressure plant alongside the cabinet.
    const top = 8 + (height - 620) * .24, shift = top - 123;
    c.save(); c.translate(300, -45); c.scale(.75, .75);
    this.drawDial(c, motion * .055, this.latest?.event); c.restore();
    pipe(c, [[706, top + 419], [751, top + 419], [751, height - 64], [1038, height - 64]], 9);
    tube(c, [[725, top + 152], [725, height - 64]], 12);
    for (const y of [top + 230, height - 70]) metal(c, 713, y, 24, 11, 1);
    pipe(c, [[726, top + 152], [755, top + 85]], 6);
    circle(c, 755, top + 85, 14, P.white, '#d6d0c5', 1.5);
    const plantScale = .72, plantX = 1030 - 948 * plantScale, plantY = height - 28 - 996 * plantScale;
    c.save(); c.translate(plantX, plantY); c.scale(plantScale, plantScale);
    c.beginPath(); c.rect(890, 465, 290, 550); c.clip();
    this.drawPlumbing(c, pressure, motion, counts); c.restore();
    tube(c, [[1148, 272], [1144, plantY + 602 * plantScale]], 6);
    c.save(); c.shadowColor = '#776d5c25'; c.shadowBlur = 10; c.shadowOffsetY = 5;
    rect(c, 32, top + 88, 672, 460, 27, '#f8f6f0', '#bfb9ae', 1.1); c.restore();
    rect(c, 38, top + 94, 660, 448, 22, null, '#fffefa', 2);
    rect(c, 43, top + 100, 650, 436, 19, null, '#ddd8cd', .8);
    for (const x of [47, 689]) for (const y of [top + 103, top + 534]) screw(c, x, y, 2.5);
    for (const x of [60, 630]) metal(c, x, top + 553, 41, 13, 3);
    c.save(); c.translate(-30, shift);
    this.drawReels(c, lanes, t, reduced);
    this.drawHeader(c, counts, lanes, t, reduced);
    this.drawClutches(c, lanes, t, reduced);
    c.restore();
    metal(c, 25, top + 539, 687, 18, 5);
    panel(c, 752, height - 250, 253, 205);
    signalScreen(c, 760, height - 241, 237, 172, this.latest?.event, counts);
    vent(c, 766, height - 62, 100, 2);
    lamp(c, 981, height - 58, this.latest ? colorOf(this.latest.event) : null, 4);
  }

  drawDial(c, rotation, event) {
    const x = 1190, y = -57, r = 492;
    c.save(); c.shadowColor = '#8b82742c'; c.shadowBlur = 23; c.shadowOffsetY = 12;
    circle(c, x, y, r, '#eeece5', '#c8c2b7'); c.restore();
    for (const [radius, width, color] of [[488, 3, '#fff'], [482, 1, '#c7c2b8'], [477, 6, '#fdfcfa'], [468, 1, '#bcb6aa'], [462, 8, '#e3dfd5'], [454, 2, '#fff'], [448, 1, '#aaa498'], [440, 13, '#faf9f6'], [427, 1, '#c2bbae'], [421, 4, '#fff'], [405, 1, '#d3ccc0'], [329, 2, '#d1cabe'], [321, 4, '#fff'], [315, 4, '#d8d2c8'], [309, 1, '#c1baad']]) circle(c, x, y, radius, null, color, width);
    c.save(); c.translate(x, y); c.rotate(rotation);
    for (let i = 0; i < 720; i++) {
      const a = i * TAU / 720;
      const major = i % 30 === 0, mid = i % 5 === 0;
      line(c, [[Math.cos(a) * 450, Math.sin(a) * 450], [Math.cos(a) * (major ? 426 : mid ? 438 : 444), Math.sin(a) * (major ? 426 : mid ? 438 : 444)]], major ? '#888277' : '#b6afa1', major ? .9 : .5);
      if (i % 15 === 0) screw(c, Math.cos(a) * 477, Math.sin(a) * 477, 1.4);
      if (major) {
        c.save(); c.translate(Math.cos(a) * 413, Math.sin(a) * 413); c.rotate(a + Math.PI / 2);
        label(c, String(i / 2).padStart(3, '0'), 0, 0, 9, P.muted, 'center'); c.restore();
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24, b = a + TAU / 24;
      c.beginPath(); c.arc(0, 0, 325, a + .009, b - .009); c.strokeStyle = P[TYPES[i % 6]]; c.lineWidth = 5; c.stroke();
      line(c, [[Math.cos(a) * 331, Math.sin(a) * 331], [Math.cos(a) * 421, Math.sin(a) * 421]], '#c6c0b4', 4);
      line(c, [[Math.cos(a) * 331, Math.sin(a) * 331], [Math.cos(a) * 421, Math.sin(a) * 421]], '#fffefa', 2.5);
      for (const rr of [338, 415]) screw(c, Math.cos(a) * rr, Math.sin(a) * rr, 1.8);
      c.save(); c.translate(Math.cos(a + .13) * 274, Math.sin(a + .13) * 274); c.rotate(a + .13);
      rect(c, -20, -13, 40, 26, 12, '#ddd9d0', '#bbb5a8', .7);
      glyph(c, TYPES[i % 6], 0, 0, 9, '#a6a093'); c.restore();
    }
    for (const rr of [290, 253, 216, 179]) circle(c, 0, 0, rr, null, '#d0c9bd', .7);
    c.restore();
    for (const a of [.42, .76, 1.08, 1.39, 1.73, 2.04, 2.35]) {
      c.save(); c.translate(x + Math.cos(a) * 481, y + Math.sin(a) * 481); c.rotate(a);
      metal(c, -14, -9, 28, 18, 1); screw(c, 0, 0, 2); c.restore();
    }
    // The escapement links the cropped dial to the compressor pulley below.
    tube(c, [[1131, 403], [1088, 623]], 7); tube(c, [[1144, 408], [1153, 623]], 7);
    for (let i = 0; i < 24; i++) {
      const p = i / 24;
      line(c, [[1127 - 43 * p, 410 + 207 * p], [1134 - 43 * p, 411 + 207 * p]], '#bfb8ac', 1);
      line(c, [[1141 + 9 * p, 415 + 202 * p], [1148 + 9 * p, 415 + 202 * p]], '#bfb8ac', 1);
    }
    pulley(c, 1134, 407, 27, rotation * 3);
    lamp(c, 1165, 420, event?.status === 'failed' ? RED : null, 3);
  }

  drawPlumbing(c, pressure, motion, counts) {
    pipe(c, [[726, 752], [880, 752], [880, 748], [950, 748]], 14);
    pipe(c, [[726, 851], [952, 851]], 7);
    pipe(c, [[727, 952], [866, 952], [878, 940], [878, 873], [891, 860], [951, 860]], 13);
    for (const x of [731, 820, 884, 936]) clampJoint(c, x, 752, false);
    for (const [x, y] of [[819, 952], [878, 903], [923, 851]]) clampJoint(c, x, y, x === 878);
    // Exposed control linkage and the clear vertical pressure line.
    panel(c, 733, 475, 47, 82);
    pipe(c, [[769, 514], [792, 304]], 7);
    circle(c, 792, 304, 16, '#fdfcf9', '#e0dcd3', 2);
    circle(c, 769, 514, 17, '#fffefa', '#dad5ca', 2); screw(c, 769, 514, 4);
    pipe(c, [[769, 514], [831, 522]], 6);
    tube(c, [[831, 522], [831, 899]], 15);
    for (const y of [670, 890]) metal(c, 813, y, 36, 15, 1);
    panel(c, 733, 900, 118, 17);
    pipe(c, [[997, 658], [997, 524], [1020, 512]], 8);
    // Ribbed compressor head and flywheel.
    metal(c, 1013, 511, 91, 131, 5);
    for (let i = 0; i < 11; i++) metal(c, 1010, 527 + i * 8, 100, 3, 1);
    panel(c, 1015, 501, 76, 20);
    panel(c, 1036, 526, 36, 57);
    rect(c, 1042, 533, 23, 44, 3, '#dedbd3', '#c2bdb2');
    line(c, [[1054, 535], [1054, 574]], '#fff', 2);
    panel(c, 1014, 588, 106, 48);
    meter(c, 1054, 485, 13, pressure);
    pulley(c, 1120, 602, 38, motion * .5);
    metal(c, 1005, 639, 125, 7, 1);
    // Tall rounded vessel; the sight glass reveals actual active pressure only.
    const g = c.createLinearGradient(949, 0, 1159, 0);
    g.addColorStop(0, '#e8e4dc'); g.addColorStop(.25, '#fdfbf7'); g.addColorStop(.55, '#f6f3ed'); g.addColorStop(1, '#dfdbd1');
    c.save(); c.shadowColor = '#756b5a24'; c.shadowBlur = 18; c.shadowOffsetY = 8;
    rect(c, 948, 647, 209, 319, [76, 76, 69, 69], g, '#bfb9ac', 1); c.restore();
    for (const y of [727, 886]) {
      line(c, [[949, y], [1156, y]], '#bdb7ac', 1);
      line(c, [[950, y + 3], [1155, y + 3]], '#fff', 1.6);
      for (let x = 961; x < 1150; x += 15) screw(c, x, y + 6, 1.1);
    }
    for (const x of [980, 1114]) metal(c, x, 956, 14, 31, 2);
    metal(c, 977, 988, 151, 8, 2); metal(c, 1035, 973, 33, 12, 5);
    panel(c, 1030, 736, 47, 211);
    const glass = c.createLinearGradient(1038, 0, 1070, 0);
    glass.addColorStop(0, '#d3d1ca'); glass.addColorStop(.4, '#f9f8f2b0'); glass.addColorStop(.7, '#e4e1d990'); glass.addColorStop(1, '#c5c1b7');
    rect(c, 1038, 742, 31, 191, 10, glass, '#beb9ac', .8);
    rect(c, 1041, 929 - pressure * 174, 25, 3 + pressure * 174, 6, '#99b4c34d', null);
    line(c, [[1044, 750], [1044, 923]], '#fffefa', 2);
    ellipse(c, 1054, 930 - pressure * 174, 12, 2, null, '#91a8ba');
    for (let i = 0; i < 19; i++) line(c, [[1079, 748 + i * 10], [i % 5 === 0 ? 1088 : 1084, 748 + i * 10]], '#b9b2a4', .8);
    panel(c, 1096, 766, 49, 31); vent(c, 1103, 775, 30, 3);
    pipe(c, [[935, 752], [925, 720], [924, 704]], 7);
    meter(c, 925, 707, 27, pressure);
    panel(c, 903, 736, 43, 29); metal(c, 896, 740, 7, 19, 1);
    metal(c, 1158, 720, 11, 11, 1); circle(c, 1163, 711, 3, P.white, P.edge);
    lamp(c, 1023, 748, (counts.failed || 0) > 0 ? RED : null, 3);
  }

  drawCabinet(c, counts, lanes, t, reduced) {
    for (const x of [69, 211, 580, 703]) metal(c, x, 964, 39, 16, 3);
    c.save(); c.shadowColor = '#776d5c25'; c.shadowBlur = 12; c.shadowOffsetY = 6;
    rect(c, 62, 213, 672, 718, 29, '#f8f6f0', '#bfb9ae', 1.1); c.restore();
    rect(c, 68, 219, 660, 706, 24, null, '#fffefa', 2);
    rect(c, 73, 225, 650, 695, 21, null, '#ddd8cd', .8);
    for (const x of [77, 719]) for (const y of [227, 915]) screw(c, x, y, 2.6);
    for (const x of [81, 714]) rect(c, x, 243, 7, 653, 4, '#fffefa', '#c4beb2', .8);
    line(c, [[70, 684], [726, 684]], '#c5bfb3');
    line(c, [[70, 687], [726, 687]], '#fff', 1.5);
    this.drawReels(c, lanes, t, reduced);
    this.drawHeader(c, counts, lanes, t, reduced);
    this.drawClutches(c, lanes, t, reduced);
    signalScreen(c, 211, 694, 380, 218, this.latest?.event, counts);
    meter(c, 156, 760, 25, clamp((counts.active || 0) / 10));
    pulley(c, 157, 810, 10, 0);
    panel(c, 122, 844, 69, 32); vent(c, 131, 854, 48, 3);
    metal(c, 629, 732, 28, 13, 1);
    rect(c, 630, 747, 25, 78, 12, '#f3f0e8', '#beb7aa', .8);
    for (let x = 636; x < 653; x += 6) for (let y = 757; y < 819; y += 8) circle(c, x, y, .65, '#beb8ab');
    metal(c, 634, 824, 17, 8, 2);
    metal(c, 37, 932, 724, 34, 9);
    panel(c, 280, 925, 239, 25);
    panel(c, 299, 911, 202, 54);
    metal(c, 312, 920, 176, 34, 7);
    line(c, [[322, 949], [478, 949]], '#fff', 1);
  }

  drawHeader(c, counts, lanes, t, reduced) {
    // The top capsule has the same continuous bolt rail as the reference.
    c.save(); c.shadowColor = '#7a71612b'; c.shadowBlur = 6; c.shadowOffsetY = 5;
    rect(c, 96, 123, 602, 104, 34, '#fdfbf8', '#c6c0b5'); c.restore();
    rect(c, 102, 129, 590, 92, 29, null, '#ded9d0', .8);
    for (let x = 133; x < 675; x += 44) lamp(c, x, 138, null, 4.9);
    metal(c, 173, 154, 453, 46, 6);
    rect(c, 175, 157, 449, 41, 5, '#eeeae1', '#c6c0b4', .7);
    label(c, `气压 ${counts.active || 0}`, 190, 178, 17, P.ink, 'left', true);
    const active = lanes.some(call => call && progress(call, t, reduced) < 1);
    label(c, active ? '运行' : '待机', 399, 178, 17, P.muted, 'center');
    label(c, `调用 ${counts.total || 0}`, 612, 178, 17, P.ink, 'right', true);
    for (const x of [96, 698]) metal(c, x - 6, 160, 14, 18, 2);
    for (const x of [117, 677]) screw(c, x, 179, 1.8);
  }

  drawClutches(c, lanes, t, reduced) {
    // Five rotary clutches, their individual terminal lamps, and the shelf lip.
    metal(c, 98, 551, 600, 115, 8);
    rect(c, 102, 555, 592, 104, 5, '#eeebe3', '#d7d1c5', .7);
    for (let i = 0; i < 5; i++) {
      const x = 155 + i * 122, call = lanes[i];
      pulley(c, x, 585, 22, call ? easeOut(progress(call, t, reduced)) * TAU * call.turns : 0);
      panel(c, x - 17, 618, 35, 22);
      rect(c, x - 12, 623, 15, 11, 3, P.white, '#c5beb2', .7);
      lamp(c, x + 10, 628, call ? colorOf(call.event) : null, 2.8);
    }
    metal(c, 91, 645, 615, 17, 4);
    for (let x = 112; x < 701; x += 47) screw(c, x, 654, 1);
  }

  drawReels(c, lanes, t, reduced) {
    panel(c, 83, 237, 627, 311);
    rect(c, 96, 250, 601, 285, 1, '#fdfbf7', '#c7c2b8', .8);
    c.save(); c.beginPath(); c.rect(96, 250, 601, 285); c.clip();
    for (let i = 0; i < 5; i++) {
      const x = 96 + i * 120.2, call = lanes[i], p = call ? progress(call, t, reduced) : 1;
      // At rest the centre symbol is the actual tool type, never a random reward.
      const position = call ? call.type + (1 - easeOut(p)) * call.turns * TYPES.length : i + 1;
      const base = Math.floor(position);
      const g = c.createLinearGradient(x, 0, x + 120, 0);
      g.addColorStop(0, '#efede7'); g.addColorStop(.07, '#faf8f4'); g.addColorStop(.88, '#faf8f4'); g.addColorStop(1, '#e8e5de');
      c.fillStyle = g; c.fillRect(x, 250, 120, 285);
      for (let k = base - 3; k <= base + 3; k++) {
        const y = REEL_Y + (k - position) * PITCH;
        const type = TYPES[(k % TYPES.length + TYPES.length) % TYPES.length];
        line(c, [[x, y + PITCH / 2], [x + 120, y + PITCH / 2]], '#d7d1c6', .65);
        const color = call?.event.status === 'failed' && k === call.type && p === 1 ? RED : P[type];
        glyph(c, type, x + 60, y, 26, color);
        if (call && k === call.type && p === 1) label(c, type.toUpperCase(), x + 60, y + 29, 8, P.muted, 'center');
      }
      line(c, [[x, 250], [x, 535]], '#bcb6aa', .8);
      line(c, [[x + 2, 250], [x + 2, 535]], '#fff', .9);
    }
    const shade = c.createLinearGradient(0, 250, 0, 535);
    shade.addColorStop(0, '#514f484c'); shade.addColorStop(.18, '#a7a1970c'); shade.addColorStop(.48, '#ffffff00');
    shade.addColorStop(.78, '#ffffff00'); shade.addColorStop(1, '#514f4852');
    c.fillStyle = shade; c.fillRect(96, 250, 601, 285);
    c.beginPath(); c.moveTo(105, 250); c.lineTo(220, 250); c.lineTo(154, 535); c.lineTo(100, 535); c.closePath(); c.fillStyle = '#ffffff1b'; c.fill();
    c.restore();
    line(c, [[96, REEL_Y], [697, REEL_Y]], '#aaa397', .8);
    for (const x of [88, 703]) {
      const direction = x < 100 ? 1 : -1;
      line(c, [[x, REEL_Y - 6], [x + direction * 10, REEL_Y], [x, REEL_Y + 6]], '#b4ada0', .9);
    }
    for (let x = 117; x < 697; x += 40) for (const y of [243, 542]) lamp(c, x, y, null, 3.7);
    for (const x of [89, 704]) for (let y = 275; y <= 518; y += 47) lamp(c, x, y, null, 3.5);
  }
}
