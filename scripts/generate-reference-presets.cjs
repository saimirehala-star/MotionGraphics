const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const sources = [
  {
    file: 'aep-presets-deep-entrance.json', category: 'in', expected: 31,
    ids: {
      '波浪弹跳':'in-ref-wave-bounce','弹弓':'in-ref-slingshot','弹簧':'in-ref-spring','弹入跳动':'in-ref-pop-bounce','掉落弹跳':'in-ref-drop-bounce',
      '抖动甩入':'in-ref-jitter-sling','二段缩放':'in-ref-two-stage-scale','翻动':'in-ref-flip','放大震动':'in-ref-zoom-shake','汇聚':'in-ref-converge',
      '卡片':'in-ref-card','空翻':'in-ref-somersault','碰碰车':'in-ref-bumper','生长2':'in-ref-grow-2','甩出':'in-ref-fling',
      '跳跳糖':'in-ref-jumping-candy','跳跃':'in-ref-jump','吸入':'in-ref-inhale','向上弹入':'in-ref-up-bounce','向上翻转':'in-ref-up-flip',
      '向右缓入':'in-ref-right-ease','向右模糊2':'in-right-smear','向左模糊':'in-ref-left-blur','旋入':'in-ref-spin-in','旋转':'in-ref-rotate',
      '旋转缩放':'in-ref-rotate-scale','雪光模糊':'in-ref-snow-glow','右上弹入':'in-ref-upper-right','砸落':'in-ref-smash-down','左上弹入':'in-ref-upper-left','左移弹动':'in-ref-left-shift'
    }
  },
  {
    file: 'aep-presets-deep-exit.json', category: 'out', expected: 29,
    ids: {
      '边角缩放':'out-ref-corner-scale','波浪弹出':'out-ref-wave-pop','波浪弹跳':'out-ref-wave-bounce','弹出':'out-ref-pop','二段缩放':'out-ref-two-stage-scale',
      '放大':'out-ref-enlarge','飞出':'out-ref-fly-out','渐隐':'out-ref-fade','拉伸模糊':'out-ref-stretch-blur','螺旋下降':'out-ref-spiral-down',
      '模糊发光':'out-ref-blur-glow','闪现':'out-ref-flash','收缩震动':'out-ref-shrink-shake','甩回':'out-ref-sling-back','缩小':'out-ref-shrink',
      '躺下':'out-ref-lie-down','向上飞出':'out-ref-fly-up','向上滑动':'out-ref-slide-up','向下弹出':'out-ref-pop-down','向下翻转':'out-ref-flip-down',
      '向右滑动':'out-ref-slide-right','向左模糊':'out-ref-left-blur','消散':'out-ref-dissipate','虚影放大':'out-ref-ghost-enlarge','旋出':'out-ref-spin-out',
      '旋转':'out-ref-rotate','折叠':'out-ref-fold','左上弹出':'out-ref-upper-left-pop','左移弹动':'out-ref-left-shift'
    }
  }
];

const transformNames = { 'ADBE Position':'position', 'ADBE Scale':'scale', 'ADBE Rotate Z':'rotation', 'ADBE Opacity':'opacity' };
const visual = matchName => !['ADBE Slider Control','ADBE Checkbox Control','ADBE Angle Control','ADBE Point Control','ADBE Color Control','ADBE Layer Control'].includes(matchName);
const simple = value => typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || (Array.isArray(value) && value.every(v => typeof v === 'number'));
const round = value => Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(6));
const shift = (time, start) => round(time - start);
const valueMap = (value, channel, base) => {
  if (channel === 'position') return [round(value[0] - base[0]), round(value[1] - base[1])];
  if (channel === 'scale') return [round(base[0] ? value[0] / base[0] : 1), round(base[1] ? value[1] / base[1] : 1)];
  if (channel === 'rotation') return round(value - base);
  if (channel === 'opacity') return round(base ? value / base : 1);
  return value;
};
function velocity(key, previous, channel, base) {
  if (!previous) return Array.isArray(key.value) ? [0, 0] : 0;
  const ease = key.inTemporalEase;
  if (channel === 'position') {
    const speed = Array.isArray(ease) ? Number(ease[0].speed) : Number(ease.speed);
    const dx = key.value[0] - previous.value[0], dy = key.value[1] - previous.value[1], length = Math.sqrt(dx * dx + dy * dy);
    return length ? [round(dx / length * speed), round(dy / length * speed)] : [0, 0];
  }
  if (channel === 'scale') return [round(Number(ease[0].speed) / base[0]), round(Number(ease[1].speed) / base[1])];
  const speed = Number((Array.isArray(ease) ? ease[0] : ease).speed);
  return round(channel === 'opacity' ? speed / base : speed);
}
function curve(property, channel, base, start) {
  const keys = property.keys.map((key, index) => ({
    t: shift(key.time, start), v: valueMap(key.value, channel, base),
    mode: String(key.outInterpolation) === '6614' ? 'h' : String(key.outInterpolation) === '6613' ? 'b' : 'l',
    vel: velocity(key, property.keys[index - 1], channel, base)
  }));
  const result = { keys };
  const expression = property.expression || '';
  if (/velocityAtTime/.test(expression) && /Math\.sin/.test(expression)) {
    const amp = /amp\s*=\s*([\d.]+)/.exec(expression), freq = /freq\s*=\s*([\d.]+)/.exec(expression), decay = /decay\s*=\s*([\d.]+)/.exec(expression);
    if (amp && freq && decay) result.bounce = { amp: Number(amp[1]), freq: Number(freq[1]), decay: Number(decay[1]) };
  }
  if (/wiggle\s*\(/.test(expression)) {
    const read = name => Number(new RegExp(name + '\\s*=\\s*([\\d.]+)').exec(expression)?.[1]);
    result.wiggle = { freq: read('freq'), amp: read('amp'), start: shift(read('start'), start), end: shift(read('end'), start), fade: read('fade') };
  }
  if (/bounceMax/.test(expression) && /gravity/.test(expression)) result.gravity = { elastic: .2, gravity: 800, max: 8, direction: 1 };
  return result;
}
function effectCurve(property, start, point, width, height) {
  return { keys: property.keys.map(key => ({
    t: shift(key.time, start),
    v: point ? [round(key.value[0] / width), round(key.value[1] / height)] : key.value,
    mode: String(key.outInterpolation) === '6614' ? 'h' : String(key.outInterpolation) === '6613' ? 'b' : 'l'
  })) };
}
function findTransform(layer, matchName) { return layer.transform.find(property => property.matchName === matchName); }
function lastTime(curve) { return curve && curve.keys && curve.keys.length ? curve.keys[curve.keys.length - 1].t : 0; }
function animationStart(entry) {
  const times = [];
  for (const property of entry.layer.transform) { if (property.keys.length >= 2) times.push(property.keys[0].time); }
  for (const effect of entry.layer.effects) if (visual(effect.matchName)) {
    for (const property of effect.properties) { if (property.keys.length >= 2) times.push(property.keys[0].time); }
  }
  return times.length ? Math.min.apply(null, times) : 0;
}

const list = [];
for (const config of sources) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'test-results', config.file), 'utf8'));
  if (!source.safeInstance || source.error || source.presets.length !== config.expected) throw new Error(`Expected ${config.expected} safely inspected ${config.category} presets.`);
  source.presets.forEach((entry, index) => {
    const id = config.ids[entry.comp.name]; if (!id) throw new Error('Missing id for ' + config.category + ' / ' + entry.comp.name);
    const start = animationStart(entry), channels = {}; let duration = 0;
    for (const [matchName, channel] of Object.entries(transformNames)) {
      const property = findTransform(entry.layer, matchName); if (!property || (property.keys.length < 2 && !property.expression)) continue;
      const base = property.keys.length ? property.keys[config.category === 'out' ? 0 : property.keys.length - 1].value : property.value;
      channels[channel] = curve(property, channel, base, start); duration = Math.max(duration, lastTime(channels[channel]));
      if (channels[channel].bounce) duration = Math.max(duration, lastTime(channels[channel]) + 4.6 / channels[channel].bounce.decay);
      if (channels[channel].wiggle) duration = Math.max(duration, channels[channel].wiggle.end);
      if (channels[channel].gravity) duration = Math.max(duration, lastTime(channels[channel]) + .5);
    }
    const effects = [];
    for (const effect of entry.layer.effects) {
      if (!visual(effect.matchName)) continue;
      const spec = { label: effect.name, matchName: effect.matchName, enabled: effect.enabled, properties: [] };
      for (const property of effect.properties) {
        if (!simple(property.value) || property.matchName === 'ADBE Effect Mask Opacity' || property.matchName === 'ADBE Force CPU GPU' || property.matchName === 'ADBE Effect Built In Params') continue;
        const animated = property.keys.length >= 2, pointCurve = animated && property.propertyValueType === '6415' && Array.isArray(property.keys[0].value) && property.keys[0].value.length === 2;
        const neutral = animated ? property.keys[config.category === 'out' ? 0 : property.keys.length - 1].value : property.value;
        const item = { matchName: property.matchName, value: neutral };
        if (!animated && Array.isArray(neutral) && neutral.length === 2) { item.point = [round(neutral[0] / entry.comp.width), round(neutral[1] / entry.comp.height)]; delete item.value; }
        if (animated) {
          item.curve = effectCurve(property, start, pointCurve, entry.comp.width, entry.comp.height);
          item.end = pointCurve ? item.curve.keys[item.curve.keys.length - 1].v : property.keys[property.keys.length - 1].value;
          if (pointCurve) { item.pointCurve = true; item.value = [round(neutral[0] / entry.comp.width), round(neutral[1] / entry.comp.height)]; }
          if (property.matchName === 'ADBE Glo2-0002' || property.matchName === 'ADBE Glo2-0004') { item.expressionScale = round(100 / 255); }
          duration = Math.max(duration, lastTime(item.curve));
        }
        spec.properties.push(item);
      }
      effects.push(spec);
    }
    duration = Math.min(2, Math.max(1 / 30, Math.ceil(duration * 30 - 1e-4) / 30));
    list.push({ category: config.category, id, name: entry.comp.name, en: 'REFERENCE ' + String(index + 1).padStart(2, '0'), version: id === 'in-right-smear' || id === 'out-ref-dissipate' ? 2 : 1, duration: round(duration), seed: index + (config.category === 'in' ? 11 : 101), holdEnd: config.category === 'out', channels, effects });
  });
}

const target = path.join(root, 'extension', 'js', 'reference-presets.js');
const contents = '/* Generated from read-only TARGET inspections. ES3-compatible data only. */\n' +
  'var MGReferencePresets = ' + JSON.stringify({ list }, null, 2) + ';\n' +
  "if (typeof module !== 'undefined' && module.exports) { module.exports = MGReferencePresets; }\n";
fs.writeFileSync(target, contents, 'utf8');
console.log(`Reference presets: ${list.length} -> ${target} (${fs.statSync(target).size.toLocaleString()} bytes)`);
