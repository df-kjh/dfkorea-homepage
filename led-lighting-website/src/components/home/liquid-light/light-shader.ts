// Noise/domain-warp foundation adapted from the supplied shader by Matthias
// Hurrle (@atzedent). The supplied attachment did not specify a license. Keep
// this credit and resolve permission before production reuse. The silk, local
// interaction, finite wake/ripple composition below are authored for this study.
export const fragmentShader = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 resolution;
uniform float time;
uniform vec3 pointer;
uniform vec4 wakes[4];
uniform vec4 ripple;

float rnd(vec2 p) {
  p = fract(p * vec2(12.9898, 78.233));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(rnd(i), rnd(i + vec2(1, 0)), u.x), mix(rnd(i + vec2(0, 1)), rnd(i + 1.), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0., weight = .5;
  mat2 transform = mat2(1., -.5, .2, 1.2);
  for (int i = 0; i < 4; i++) { value += weight * noise(p); p *= 2. * transform; weight *= .5; }
  return value;
}
vec2 fieldPoint(vec2 point) { return point * resolution / max(min(resolution.x, resolution.y), 1.) * .5; }
float glowAt(vec2 delta, float width) { return exp(-min(dot(delta, delta) / max(width * width, .001), 60.)); }

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * resolution) / max(min(resolution.x, resolution.y), 1.);
  vec2 at = fieldPoint(pointer.xy);
  vec2 delta = uv - at;
  float local = glowAt(delta, .26) * pointer.z;
  vec2 bend = (delta * .52 + vec2(0., .085)) * local;
  float wakeGlow = 0.;
  // Exactly four analytic wake samples: no particle system or second animation loop.
  for (int i = 0; i < 4; i++) {
    vec2 d = uv - fieldPoint(wakes[i].xy);
    float wake = glowAt(d, .16) * wakes[i].z;
    bend += (d * .12 + vec2(0., .018)) * wake;
    wakeGlow += wake;
  }
  vec2 rippleDelta = uv - fieldPoint(ripple.xy);
  float radius = ripple.z * .43;
  float ringDistance = (length(rippleDelta) - radius) / .022;
  float ring = exp(-min(ringDistance * ringDistance, 60.)) * ripple.w;
  // Radial displacement is divided by a positive floor, including at click center.
  bend += rippleDelta / max(length(rippleDelta), .04) * ring * .023;
  uv += bend;
  float t = time * .13;
  float n = fbm(uv * 2.5 + vec2(t * .3, -t * .25));
  vec2 p = uv;
  p.y -= .48 * p.x;
  float wave = .23 * sin(p.x * 2. + t + .6) + .09 * sin(p.x * 4.3 - t * .6);
  vec3 color = vec3(.016, .019, .011);
  color += vec3(.11, .056, .018) * exp(-abs(p.y - wave + .2) * 3.8) * (.35 + n * .7);
  float sheetCenter = wave - .19 + .075 * sin(p.x * 2.6 - t);
  float sheetWidth = .13 + .04 * sin(p.x * 2.2 + t * .6 + n);
  float sheet = 1. - smoothstep(.015, sheetWidth, abs(p.y - sheetCenter));
  float fold = .7 + .3 * sin(p.x * 5. + n * 4. - t);
  float fibre = .8 + .2 * sin((p.y - sheetCenter) * 270. + n * 7. + p.x * 3.);
  color += vec3(.59, .30, .065) * sheet * fold * fibre * .58;
  color += vec3(1., .74, .37) * pow(sheet, 3.) * .28;
  float pearlEdge = abs(p.y - (sheetCenter + sheetWidth * .52));
  color += vec3(1., .90, .69) * (.72 * exp(-pearlEdge * 135.) + .08 * exp(-pearlEdge * 26.));
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float drift = sin(p.x * (1.4 + fi * .13) + t + fi * .34) * (.12 + fi * .009);
    float path = wave + drift + (fi - 4.) * .039 + .035 * sin(p.x * 6. - t * .6 + fi * .2) + .06 * (n - .5);
    float d = abs(p.y - path);
    float envelope = .65 + .35 * sin(p.x * 1.5 + fi * .42 + t * .3);
    float glow = .0026 / max(d + .008, .008);
    float core = exp(-d * (180. + fi * 12.));
    float silk = exp(-d * 42.) * (.4 + .6 * noise(vec2(p.x * 17. + t, fi * 3.)));
    vec3 amber = mix(vec3(.95, .43, .10), vec3(1., .88, .60), fi / 8.);
    color += amber * (glow * .105 + core * .46 + silk * .07) * envelope;
    float filament = abs(p.y - path - .012 * sin(p.x * 18. + n * 4. + fi));
    color += vec3(.82, .65, .38) * exp(-filament * 370.) * envelope * .08;
  }
  float edge = abs(p.y - (.42 + .15 * sin(p.x * 2.3 - t * .5)));
  color += vec3(.75, .83, .64) * (.00075 / max(edge + .01, .01) + .23 * exp(-edge * 210.));
  // Interaction illuminates the existing silk locally; the entire field stays fixed.
  color *= 1. + local * 1.65 + wakeGlow * .22;
  color += vec3(.31, .18, .045) * local * .45;
  color += vec3(.55, .35, .12) * (wakeGlow * .04 + ring * .18);
  color = vec3(1.) - exp(-color * 1.35);
  color *= 1. - .2 * smoothstep(.4, 1.4, length(uv));
  color += (rnd(gl_FragCoord.xy) - .5) * .008;
  outColor = vec4(clamp(color, 0., 1.), 1.);
}`
