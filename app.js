import { HandLandmarker, FilesetResolver }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const video    = document.getElementById('video');
const canvas   = document.getElementById('gl');
const overlay  = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const errEl    = document.getElementById('err');

const MAX = 24;                 // max simultaneous ripples
const LIFETIME = 1.6;           // seconds — ripples fade out and reset quickly

// ============================================================
//  One-Euro filter (smooth but responsive — kills jitter)
// ============================================================
class LowPass { constructor(){ this.s=null; } f(x,a){ this.s=this.s===null?x:a*x+(1-a)*this.s; return this.s; } }
class OneEuro {
  constructor(min=1.0, beta=0.015){ this.min=min; this.beta=beta; this.dc=1; this.x=new LowPass(); this.dx=new LowPass(); this.last=null; this.freq=60; }
  a(c){ const te=1/this.freq, tau=1/(2*Math.PI*c); return 1/(1+tau/te); }
  f(v,t){ if(this.last!==null&&t>this.last) this.freq=1/(t-this.last); this.last=t;
    const prev=this.x.s===null?v:this.x.s; const dv=(v-prev)*this.freq;
    const edv=this.dx.f(dv,this.a(this.dc)); const c=this.min+this.beta*Math.abs(edv);
    return this.x.f(v,this.a(c)); } }
// one filter set + trail anchor per hand (keyed by handedness so they never swap)
const handState = new Map();
function getHand(key){
  let h = handState.get(key);
  if (!h) { h = { fx: new OneEuro(), fy: new OneEuro(), last: null }; handState.set(key, h); }
  return h;
}

// ============================================================
//  WebGL setup
// ============================================================
const gl = canvas.getContext('webgl', { antialias: true });
if (!gl) { errEl.textContent = 'WebGL not supported'; }

const VS = `
attribute vec2 a_position; varying vec2 v_uv;
void main(){ v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

const FS = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_aspect;     // screen width / height
uniform vec2  u_cover;      // cover-fit scale
uniform vec4  u_ripples[${MAX}];   // xy = center (screen uv), z = startTime, w = strength
void main(){
  vec2 suv = v_uv;
  vec2 offset = vec2(0.0);
  float crest = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    vec4 r = u_ripples[i];
    if (r.w <= 0.0) continue;
    float age = u_time - r.z;
    if (age < 0.0 || age > ${LIFETIME.toFixed(1)}) continue;
    vec2 dir = suv - r.xy; dir.x *= u_aspect;
    float dist = length(dir);
    float radius = age * 0.50;                 // expanding wavefront
    float diff = dist - radius;
    float ring = sin(diff * 42.0);             // concentric ring oscillation
    float env  = exp(-age * 3.2) * exp(-diff * diff * 150.0);  // decay + ring thickness
    float amp  = r.w * ring * env * 0.06;
    vec2 ndir = dir / max(dist, 1e-4); ndir.x /= u_aspect;
    offset += ndir * amp;
    crest  += amp;
  }
  // sample the webcam with the ripple displacement, cover-fit + mirrored (selfie)
  vec2 texc = (suv + offset - 0.5) * u_cover + 0.5;
  texc.x = 1.0 - texc.x;   // mirror horizontally (selfie)
  texc.y = 1.0 - texc.y;   // flip vertically (WebGL texture origin is bottom-left)
  vec3 col = texture2D(u_tex, texc).rgb;

  // --- silvery / mercury sheen, only where the surface is moving ---
  float motion = clamp(abs(crest) * 4.0, 0.0, 1.0);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 silver = vec3(0.72, 0.76, 0.82) * (0.45 + lum);   // cool metallic tone
  col = mix(col, silver, motion * 0.35);                 // subtle desaturated metal
  // crisp specular glint riding the wave crests
  col += vec3(0.80, 0.85, 0.95) * abs(crest) * 2.6;
  gl_FragColor = vec4(col, 1.0);
}`;

function sh(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) errEl.textContent = gl.getProgramInfoLog(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'a_position');
gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

const uTime    = gl.getUniformLocation(prog, 'u_time');
const uAspect  = gl.getUniformLocation(prog, 'u_aspect');
const uCover   = gl.getUniformLocation(prog, 'u_cover');
const uRipples = gl.getUniformLocation(prog, 'u_ripples');
gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

function resize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width  = Math.round(innerWidth  * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
addEventListener('resize', resize);

// ============================================================
//  Ripple ring-buffer
// ============================================================
const ripples = new Float32Array(MAX * 4);   // [x,y,start,strength] * MAX
let rIdx = 0;
function addRipple(x, y, strength){
  const o = rIdx * 4;
  ripples[o] = x; ripples[o+1] = y; ripples[o+2] = nowSec(); ripples[o+3] = strength;
  rIdx = (rIdx + 1) % MAX;
}
let t0 = performance.now();
function nowSec(){ return (performance.now() - t0) / 1000; }

// cover-fit scale (background-size: cover) so the webcam isn't stretched
let coverX = 1, coverY = 1;
function updateCover(){
  const sa = innerWidth / innerHeight;
  const va = (video.videoWidth / video.videoHeight) || 1.777;
  if (sa > va) { coverX = 1; coverY = va / sa; }
  else         { coverX = sa / va; coverY = 1; }
}

// map a normalized landmark (raw video space) to on-screen uv (accounts for mirror + cover)
function landmarkToScreen(px, py){
  return { x: 0.5 + (0.5 - px) / coverX, y: 0.5 + (0.5 - py) / coverY };
}

// emit a trail of ripples between two points so motion leaves a continuous wake
function spawnTrail(h, x, y, strength){
  if (!h.last) { addRipple(x, y, strength); h.last = { x, y }; return; }
  const dx = x - h.last.x, dy = y - h.last.y;
  const d = Math.hypot(dx, dy);
  const STEP = 0.018;                       // spacing between ripples along the path
  if (d < STEP * 0.6) return;
  const n = Math.min(6, Math.floor(d / STEP));
  for (let i = 1; i <= n; i++){
    const t = i / n;
    addRipple(h.last.x + dx * t, h.last.y + dy * t, strength);
  }
  if (n >= 1) h.last = { x, y };
}

// ============================================================
//  Hand tracking
// ============================================================
let handLandmarker = null;
const WASM_BASE  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))
  ]);
}

async function createLandmarker(vision, delegate){
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO", numHands: 2
  });
}

async function initHands(){
  const vision = await withTimeout(
    FilesetResolver.forVisionTasks(WASM_BASE), 15000, 'WASM load');
  // The GPU delegate can hang on some machines/browsers — try it briefly,
  // then fall back to the always-available CPU delegate.
  try {
    handLandmarker = await withTimeout(createLandmarker(vision, "GPU"), 6000, 'GPU init');
    console.log('Hand model ready (GPU)');
  } catch (e) {
    console.warn('GPU delegate unavailable, falling back to CPU:', e.message);
    handLandmarker = await createLandmarker(vision, "CPU");
    console.log('Hand model ready (CPU)');
  }
}
async function initCamera(){
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('Camera unavailable — open via http://localhost (not file://) or HTTPS.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width:{ideal:1280}, height:{ideal:720}, facingMode:'user' }, audio:false });
  video.srcObject = stream;
  await new Promise(r => video.readyState >= 2 ? r() : (video.onloadedmetadata = r));
  await video.play();
  updateCover();
}

const INDEX_TIP = 8;
let lastVT = -1;
function track(nowMs){
  if (!handLandmarker || video.readyState < 2) return;
  if (video.currentTime === lastVT) return;
  lastVT = video.currentTime;
  const res = handLandmarker.detectForVideo(video, nowMs);
  const t = nowMs / 1000;
  const seen = new Set();
  if (res?.landmarks?.length){
    res.landmarks.forEach((lm, i) => {
      const key = res.handedness?.[i]?.[0]?.categoryName || ('hand' + i);
      seen.add(key);
      const h = getHand(key);
      const tip = lm[INDEX_TIP];
      const sx = h.fx.f(tip.x, t), sy = h.fy.f(tip.y, t);   // smooth raw landmark
      const p = landmarkToScreen(sx, sy);
      spawnTrail(h, p.x, p.y, 1.0);
    });
  }
  // forget hands that left the frame so they don't streak on return
  for (const [key, h] of handState) if (key !== 'mouse' && !seen.has(key)) h.last = null;
}

// mouse fallback (works without a hand, e.g. for testing)
addEventListener('pointermove', e => {
  if (overlay.classList.contains('hidden'))
    spawnTrail(getHand('mouse'), e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.8);
});

// ============================================================
//  Main loop
// ============================================================
function frame(now){
  track(now);
  if (video.readyState >= 2){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.uniform1f(uTime, nowSec());
    gl.uniform1f(uAspect, innerWidth / innerHeight);
    gl.uniform2f(uCover, coverX, coverY);
    gl.uniform4fv(uRipples, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  errEl.textContent = '';
  try {
    startBtn.textContent = 'Allow camera…';
    await initCamera();
    resize();
    startBtn.textContent = 'Loading model…';
    await initHands();
    overlay.classList.add('hidden');
    requestAnimationFrame(frame);
  } catch (e){
    console.error(e); errEl.textContent = String(e.message || e);
    startBtn.disabled = false; startBtn.textContent = 'Open Webcam';
  }
});
