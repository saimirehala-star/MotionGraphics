/* ES3-compatible motion evaluator, shared by Canvas previews and AE expressions. */
function mgPose(kind, seconds, p) {
    function clamp(x) { return Math.max(0, Math.min(1, x)); }
    function uniform(r, value) { r.scale = value; r.scaleX = value; r.scaleY = value; }
    function ease(x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); }
    function smooth(x) { x = clamp(x); return x * x * (3 - 2 * x); }
    function arr(value) { return value !== null && value !== undefined && value.length !== undefined; }
    function copy(value) { return arr(value) ? [value[0], value[1]] : value; }
    function combine(a, b, amount) {
        if (arr(a)) { return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount]; }
        return a + (b - a) * amount;
    }
    function add(value, delta) {
        if (arr(value)) { return [value[0] + delta[0], value[1] + delta[1]]; }
        return value + delta;
    }
    function multiply(value, amount) {
        if (arr(value)) { return [value[0] * amount, value[1] * amount]; }
        return value * amount;
    }
    function curveValue(curve, time, neutral, seed) {
        var keys = curve.keys || [], value = copy(neutral), active = -1, i, a, b, x, mode;
        if (keys.length) {
            if (time <= keys[0].t) { value = copy(keys[0].v); active = 0; }
            else {
                active = keys.length - 1; value = copy(keys[active].v);
                for (i = 0; i < keys.length - 1; i++) {
                    if (time < keys[i + 1].t) {
                        active = i; a = keys[i]; b = keys[i + 1]; x = (time - a.t) / Math.max(.000001, b.t - a.t); mode = a.mode;
                        if (mode === 'h') { x = 0; } else if (mode === 'b') { x = smooth(x); }
                        value = combine(a.v, b.v, x); break;
                    }
                }
            }
            if (active >= 0 && curve.bounce && keys[active].vel !== undefined) {
                var elapsed = Math.max(0, time - keys[active].t), wave = curve.bounce.amp * Math.sin(curve.bounce.freq * elapsed * 2 * Math.PI) / Math.exp(curve.bounce.decay * elapsed);
                value = add(value, multiply(keys[active].vel, wave));
            }
            if (active >= 0 && curve.gravity && keys[active].vel !== undefined) {
                var gravityVelocity = keys[active].vel, gravitySpeed = arr(gravityVelocity) ? Math.sqrt(gravityVelocity[0] * gravityVelocity[0] + gravityVelocity[1] * gravityVelocity[1]) : Math.abs(gravityVelocity);
                if (gravitySpeed > 0) {
                    var gravityElapsed = Math.max(0, time - keys[active].t), reboundSpeed = gravitySpeed * curve.gravity.elastic, reboundPeriod = Math.max(.05, 2 * reboundSpeed / curve.gravity.gravity), reboundOffset = reboundSpeed * reboundPeriod / Math.PI * Math.sin(2 * Math.PI * gravityElapsed / reboundPeriod) / Math.exp(5 * gravityElapsed);
                    if (arr(value)) { value = [value[0] - gravityVelocity[0] / gravitySpeed * reboundOffset, value[1] - gravityVelocity[1] / gravitySpeed * reboundOffset]; }
                    else { value -= (gravityVelocity < 0 ? -1 : 1) * reboundOffset; }
                }
            }
        }
        if (curve.wiggle) {
            var w = curve.wiggle, gateIn = smooth((time - w.start) / Math.max(.000001, w.fade)), gateOut = 1 - smooth((time - (w.end - w.fade)) / Math.max(.000001, w.fade)), gate = gateIn * gateOut;
            if (time < w.start || time > w.end) { gate = 0; }
            var n1 = Math.sin((time * w.freq + seed) * 12.9898) + .35 * Math.sin((time * w.freq + seed * 2.13) * 5.3983);
            var n2 = Math.sin((time * w.freq + seed + 19.17) * 9.1731) + .35 * Math.sin((time * w.freq + seed * 1.71) * 4.117);
            value = add(value, [w.amp * gate * n1 / 1.35, w.amp * gate * n2 / 1.35]);
        }
        return value;
    }
    function elastic(x) {
        x = clamp(x);
        if (x === 0 || x === 1) { return x; }
        return 1 - Math.pow(1 - x, 3) * Math.cos(x * Math.PI * (2 + p.elastic * 4));
    }
    var d = Math.max(0.001, p.duration), u = clamp(seconds / d), v = ease(u);
    var phase = 2 * Math.PI * Math.max(0, seconds) / Math.max(0.05, p.period);
    var result = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
    var distance = p.distance, amount = p.amount, isOut = kind.indexOf('out-') === 0;
    var direction = p.direction, dx = 0, dy = 0;
    if (p.__ref) {
        if (!p.__ref.loop && u >= 1 && !p.__ref.holdEnd) { return result; }
        var sourceTime = u * p.__ref.duration, channels = p.__ref.channels, sampled;
        if (p.__ref.loop) {
            if (seconds < 0) { return result; }
            var userPeriod = Math.max(.05, p.period || p.__ref.duration);
            sourceTime = (seconds % userPeriod) / userPeriod * p.__ref.duration;
        }
        if (channels.position) { sampled = curveValue(channels.position, sourceTime, [0, 0], p.__ref.seed); result.x = sampled[0]; result.y = sampled[1]; }
        if (channels.scale) { sampled = curveValue(channels.scale, sourceTime, [1, 1], p.__ref.seed); result.scaleX = sampled[0]; result.scaleY = sampled[1]; }
        if (channels.rotation) { result.rotation = curveValue(channels.rotation, sourceTime, 0, p.__ref.seed); }
        if (channels.opacity) { result.opacity = curveValue(channels.opacity, sourceTime, 1, p.__ref.seed); }
        return result;
    }
    if (direction === 1) { dx = -1; } else if (direction === 2) { dx = 1; }
    else if (direction === 3) { dy = -1; } else { dy = 1; }
    if (kind === 'in-fade') { result.opacity = v; }
    if (kind === 'out-fade') { result.opacity = 1 - v; }
    if (kind === 'in-slide' || kind === 'out-slide') {
        result.x = dx * distance * (isOut ? v : 1 - v);
        result.y = dy * distance * (isOut ? v : 1 - v);
        result.opacity = isOut ? 1 - v : v;
    }
    if (kind === 'in-scale' || kind === 'out-scale') {
        uniform(result, isOut ? 1 - v : v);
        result.opacity = isOut ? 1 - v : v;
    }
    if (kind === 'in-elastic' || kind === 'out-elastic') {
        uniform(result, isOut ? elastic(1 - u) : elastic(u));
        result.opacity = isOut ? clamp((1 - u) * 5) : clamp(u * 5);
    }
    if (kind === 'in-rotate' || kind === 'out-rotate') {
        result.rotation = p.angle * (isOut ? v : 1 - v);
        uniform(result, isOut ? 1 - v * 0.3 : 0.7 + v * 0.3);
        result.opacity = isOut ? 1 - v : v;
    }
    if (seconds < 0 && kind.indexOf('loop-') === 0) { return result; }
    if (kind === 'loop-breathe') { uniform(result, 1 + amount / 100 * (1 - Math.cos(phase)) / 2); }
    if (kind === 'loop-float') { result.y = -amount * Math.sin(phase); }
    if (kind === 'loop-sway') { result.rotation = amount * Math.sin(phase); }
    if (kind === 'loop-spin') { result.rotation = p.angle * Math.max(0, seconds) / Math.max(0.05, p.period); }
    if (kind === 'loop-blink') { result.opacity = 1 - amount / 100 * (1 - Math.cos(phase)) / 2; }
    if (seconds >= 0 && seconds <= d) {
        if (kind === 'feedback-press') { uniform(result, 1 - amount / 100 * Math.pow(Math.sin(Math.PI * u), 2)); }
        if (kind === 'feedback-rebound') { uniform(result, 1 - amount / 100 * Math.sin(u * Math.PI * (2 + p.elastic * 4)) * Math.pow(1 - u, 2)); }
        if (kind === 'feedback-shake') { result.x = amount * Math.sin(u * Math.PI * 2 * p.frequency) * Math.pow(1 - u, 2); }
        if (kind === 'feedback-bounce') { result.y = -amount * Math.abs(Math.sin(u * Math.PI * 3)) * Math.pow(1 - u, 2); }
        if (kind === 'feedback-pop') { uniform(result, 1 + amount / 100 * Math.pow(Math.sin(Math.PI * u), 2)); }
    }
    return result;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = mgPose; }
