// ═══════════════════════════════════════════════════════════════════
//  Galaxy Hand Tracker — app.js
//  Real-time hand tracking with MediaPipe + interactive particles
// ═══════════════════════════════════════════════════════════════════

// ─── Configuration ───────────────────────────────────────────────────
const CONFIG = {
  particleCount:     1400,
  baseSpeed:         0.3,
  repelRadius:       130,
  repelStrength:     8,
  friction:          0.92,
  textParticleCount: 800,
  textFormSpeed:     0.06,
  textScatterSpeed:  0.04,

  glowColors: [
    'rgba(255,255,255,',
    'rgba(230,235,255,',
    'rgba(245,245,255,',
    'rgba(220,230,250,',
    'rgba(250,250,255,',
  ],

  starColors: [
    '#ffffff', '#f0f0ff', '#e8e8ff', '#fafafe', '#f5f5ff',
    '#dde4ff', '#eeeeff', '#ffffff',
  ],
};

// ─── Canvas Setup ────────────────────────────────────────────────────
const canvas = document.getElementById('particleCanvas');
const ctx    = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ─── Particle Class ──────────────────────────────────────────────────
class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * CONFIG.baseSpeed;
    this.vy = (Math.random() - 0.5) * CONFIG.baseSpeed;

    this.size       = Math.random() * 2.5 + 0.5;
    this.colorIdx   = Math.floor(Math.random() * CONFIG.glowColors.length);
    this.alpha      = Math.random() * 0.6 + 0.3;
    this.pulse      = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 0.02 + 0.005;

    // Text-formation state
    this.targetX        = null;
    this.targetY        = null;
    this.isTextParticle = false;
    this.textAlpha      = 0;
  }

  update(textMode) {
    this.pulse += this.pulseSpeed;
    const pAlpha = this.alpha + Math.sin(this.pulse) * 0.15;

    // ── Text formation / scattering ──
    if (textMode && this.isTextParticle && this.targetX !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.vx += dx * CONFIG.textFormSpeed;
      this.vy += dy * CONFIG.textFormSpeed;
      this.vx *= 0.82;
      this.vy *= 0.82;
      this.textAlpha = Math.min(1, this.textAlpha + 0.04);
    } else if (!textMode && this.isTextParticle) {
      this.textAlpha = Math.max(0, this.textAlpha - CONFIG.textScatterSpeed);
      if (this.textAlpha <= 0) {
        this.isTextParticle = false;
        this.targetX = null;
        this.targetY = null;
      }
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy += (Math.random() - 0.5) * 0.5;
      this.vx *= CONFIG.friction;
      this.vy *= CONFIG.friction;
    } else {
      // Normal gentle drift
      this.vx += (Math.random() - 0.5) * 0.02;
      this.vy += (Math.random() - 0.5) * 0.02;
      this.vx *= 0.99;
      this.vy *= 0.99;
    }

    // ── Fist repulsion ──
    if (isFist && fistX !== null) {
      const dx   = this.x - fistX;
      const dy   = this.y - fistY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.repelRadius && dist > 0) {
        const force = (CONFIG.repelRadius - dist) / CONFIG.repelRadius;
        const angle = Math.atan2(dy, dx);
        this.vx += Math.cos(angle) * force * CONFIG.repelStrength;
        this.vy += Math.sin(angle) * force * CONFIG.repelStrength;
      }
    }

    this.x += this.vx;
    this.y += this.vy;

    // Wrap around edges
    if (this.x < -10)   this.x = W + 10;
    if (this.x > W + 10) this.x = -10;
    if (this.y < -10)   this.y = H + 10;
    if (this.y > H + 10) this.y = -10;

    return pAlpha;
  }

  draw(pAlpha) {
    const color = CONFIG.glowColors[this.colorIdx];
    const a = this.isTextParticle ? Math.max(pAlpha, this.textAlpha) : pAlpha;

    // Outer glow
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
    ctx.fillStyle = color + (a * 0.15).toFixed(3) + ')';
    ctx.fill();

    // Bright core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = color + a.toFixed(3) + ')';
    ctx.fill();
  }
}

// ─── Background Star Class ──────────────────────────────────────────
class Star {
  constructor() {
    this.x            = Math.random() * W;
    this.y            = Math.random() * H;
    this.size         = Math.random() * 1.5 + 0.2;
    this.twinkle      = Math.random() * Math.PI * 2;
    this.twinkleSpeed = Math.random() * 0.03 + 0.01;
    this.color        = CONFIG.starColors[
      Math.floor(Math.random() * CONFIG.starColors.length)
    ];
  }

  draw() {
    this.twinkle += this.twinkleSpeed;
    const a = 0.3 + Math.sin(this.twinkle) * 0.3;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ─── Text → Pixel Sampling ─────────────────────────────────────────
function getTextPixels(text, fontSize) {
  const offscreen = document.createElement('canvas');
  offscreen.width  = W;
  offscreen.height = H;
  const offCtx = offscreen.getContext('2d');

  offCtx.fillStyle    = '#fff';
  offCtx.font         = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  offCtx.textAlign    = 'center';
  offCtx.textBaseline = 'middle';

  // On narrow screens, wrap long text across multiple lines
  const maxWidth = W * 0.85;
  const measured = offCtx.measureText(text);
  if (measured.width > maxWidth && text.includes(' ')) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (offCtx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.2;
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
      offCtx.fillText(lines[i], W / 2, startY + i * lineHeight);
    }
  } else {
    offCtx.fillText(text, W / 2, H / 2);
  }

  const imageData = offCtx.getImageData(0, 0, W, H);
  const pixels    = [];
  const isMobile  = W < 600;
  const step      = isMobile ? 4 : 6; // denser sampling on mobile

  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const idx = (y * W + x) * 4;
      if (imageData.data[idx + 3] > 128) {
        pixels.push({ x, y });
      }
    }
  }
  return pixels;
}

// ─── Global State ────────────────────────────────────────────────────
const particles = [];
const stars     = [];

let fistX            = null;
let fistY            = null;
let hasHand          = false;
let isFist           = false;
let currentGesture   = 'none';
let displayedGesture = 'none';
let gestureText      = '';
let textMode         = false;
let pendingGesture   = 'none';
let gestureCounter   = 0;

const GESTURE_HOLD_FRAMES = 10; // debounce threshold

// ─── Gesture Signs ──────────────────────────────────────────────────
const GESTURE_SIGNS = {
  hello:          'HELLO',
  nadim:          'THIS IS NADIM',
  nice_to_meet:   'NICE TO MEET YOU',
  i_love_you:     'I LOVE YOU',
  thank_you:      'THANK YOU',
  what_do_u_want: 'WHAT DO YOU WANT?',
  okay:           'OKAY!',
  fuck_u:         'FUCK U',
  u_suck:         'U SUCK',
};

// ─── Motion Tracking ────────────────────────────────────────────────
const HISTORY_SIZE = 25;
const handHistory  = [[], []]; // wrist history for each hand
let numHandsVisible = 0;

const isMobileDevice = window.innerWidth < 600;
const pCount = isMobileDevice ? 800 : CONFIG.particleCount;
const sCount = isMobileDevice ? 120 : 200;
if (isMobileDevice) {
  CONFIG.repelRadius = 80;
}
for (let i = 0; i < pCount; i++) particles.push(new Particle());
for (let i = 0; i < sCount; i++) stars.push(new Star());

// ─── Gesture Detection Helpers ──────────────────────────────────────
function isFingerUp(landmarks, finger) {
  const tips = { index: 8, middle: 12, ring: 16, pinky: 20 };
  const pips = { index: 6, middle: 10, ring: 14, pinky: 18 };
  return landmarks[tips[finger]].y < landmarks[pips[finger]].y;
}

function isThumbUp(landmarks) {
  const thumbTip = landmarks[4];
  const thumbIp  = landmarks[3];
  const thumbMcp = landmarks[2];
  // Thumb is extended if tip is far from MCP compared to IP
  const tipDist = Math.hypot(thumbTip.x - thumbMcp.x, thumbTip.y - thumbMcp.y);
  const ipDist  = Math.hypot(thumbIp.x - thumbMcp.x, thumbIp.y - thumbMcp.y);
  return tipDist > ipDist * 1.2;
}

// ─── Detection Helpers ──────────────────────────────────────────────
function landmarkDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function allFingersUp(lm) {
  return isFingerUp(lm, 'index') && isFingerUp(lm, 'middle')
      && isFingerUp(lm, 'ring')  && isFingerUp(lm, 'pinky');
}

function allFingersDown(lm) {
  return !isFingerUp(lm, 'index') && !isFingerUp(lm, 'middle')
      && !isFingerUp(lm, 'ring')  && !isFingerUp(lm, 'pinky');
}

// ─── Motion Analysis ────────────────────────────────────────────────
function addToHistory(handIdx, lm) {
  handHistory[handIdx].push({
    wx: lm[0].x, wy: lm[0].y,   // wrist
    px: lm[9].x, py: lm[9].y,   // palm center
    tx: lm[4].x, ty: lm[4].y,   // thumb tip
    ix: lm[8].x, iy: lm[8].y,   // index tip
    pinch: landmarkDist(lm[4], lm[8]),       // thumb-index dist
    allUp: allFingersUp(lm),
    allDown: allFingersDown(lm),
  });
  if (handHistory[handIdx].length > HISTORY_SIZE) handHistory[handIdx].shift();
}

function getMotion(handIdx, frames) {
  const h = handHistory[handIdx];
  if (h.length < frames) return null;
  const recent = h.slice(-frames);
  const s = recent[0], e = recent[recent.length - 1];
  return { dx: e.wx - s.wx, dy: e.wy - s.wy, mag: Math.hypot(e.wx - s.wx, e.wy - s.wy) };
}

function detectOscillationX(handIdx, frames) {
  const h = handHistory[handIdx];
  if (h.length < frames) return false;
  const recent = h.slice(-frames);
  let changes = 0;
  for (let i = 2; i < recent.length; i++) {
    const prev = recent[i - 1].wx - recent[i - 2].wx;
    const curr = recent[i].wx - recent[i - 1].wx;
    if (prev * curr < 0 && Math.abs(curr) > 0.002) changes++;
  }
  return changes >= 3;
}

// ─── Two-Hand Sign Detection ────────────────────────────────────────
function detectTwoHandSign(lm0, lm1) {
  // NICE TO MEET YOU: two upright index fingers brought together
  const idx0Only = isFingerUp(lm0, 'index') && !isFingerUp(lm0, 'middle')
                && !isFingerUp(lm0, 'ring')  && !isFingerUp(lm0, 'pinky');
  const idx1Only = isFingerUp(lm1, 'index') && !isFingerUp(lm1, 'middle')
                && !isFingerUp(lm1, 'ring')  && !isFingerUp(lm1, 'pinky');

  if (idx0Only && idx1Only) {
    const tipDist = landmarkDist(lm0[8], lm1[8]);
    if (tipDist < 0.12) return 'nice_to_meet';
  }

  return null;
}

// ─── Single-Hand Sign Detection ─────────────────────────────────────
function detectOneHandSign(lm) {
  const indexUp  = isFingerUp(lm, 'index');
  const middleUp = isFingerUp(lm, 'middle');
  const ringUp   = isFingerUp(lm, 'ring');
  const pinkyUp  = isFingerUp(lm, 'pinky');
  const thumbOut = isThumbUp(lm);
  const open     = allFingersUp(lm);
  const fist     = allFingersDown(lm);

  // 🤌 WHAT DO YOU WANT: all fingertips bunched near thumb tip
  const pinchThreshold = 0.07;
  const allPinched = landmarkDist(lm[4], lm[8])  < pinchThreshold
                  && landmarkDist(lm[4], lm[12]) < pinchThreshold
                  && landmarkDist(lm[4], lm[16]) < pinchThreshold
                  && landmarkDist(lm[4], lm[20]) < pinchThreshold;
  if (allPinched) return 'what_do_u_want';

  // 🖕 FUCK U: only middle finger up
  if (!indexUp && middleUp && !ringUp && !pinkyUp) return 'fuck_u';

  // 🤟 I LOVE YOU: thumb + index + pinky up, middle + ring down
  if (thumbOut && indexUp && !middleUp && !ringUp && pinkyUp) return 'i_love_you';

  // ✌️ OKAY: peace sign — index + middle up, ring + pinky down
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'okay';

  // 🤙 U SUCK: L shape — index up + thumb clearly extended sideways
  if (indexUp && !middleUp && !ringUp && !pinkyUp && thumbOut) {
    const thumbLateral = Math.abs(lm[4].x - lm[5].x);
    if (thumbLateral > 0.08) return 'u_suck';
  }

  // ☝️ HELLO: index finger up, others down
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'hello';

  // 🤙 THANK YOU: pinky finger only
  if (!indexUp && !middleUp && !ringUp && pinkyUp) return 'thank_you';

  // ✋ THIS IS NADIM: open hand lower (chest area)
  if (open) return 'nadim';

  // ✊ Fist: particle repulsion (no specific sign)
  if (fist) return 'fist';

  return 'none';
}

// ─── Assign Particles to Text Positions ─────────────────────────────
function assignTextToParticles(text) {
  const isMobile = W < 600;
  const fontSize = isMobile ? Math.min(W * 0.14, 60) : Math.min(W * 0.08, 100);
  const pixels   = getTextPixels(text, fontSize);

  // Clear previous assignments
  particles.forEach(p => {
    p.isTextParticle = false;
    p.targetX = null;
    p.targetY = null;
  });

  if (pixels.length === 0) return;

  const count = Math.min(CONFIG.textParticleCount, pixels.length, particles.length);
  const shuffled = pixels.sort(() => Math.random() - 0.5).slice(0, count);

  for (let i = 0; i < shuffled.length; i++) {
    particles[i].targetX        = shuffled[i].x;
    particles[i].targetY        = shuffled[i].y;
    particles[i].isTextParticle = true;
  }
}

// ─── Background Renderer ────────────────────────────────────────────
function drawBackground() {
  // Deep-space radial gradient
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0,   '#0a0a1a');
  grad.addColorStop(0.5, '#050510');
  grad.addColorStop(1,   '#000005');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Drifting nebula glow
  const time = Date.now() * 0.0001;
  ctx.globalAlpha = 0.04;

  const neb1 = ctx.createRadialGradient(
    W * 0.3 + Math.sin(time) * 100,
    H * 0.4 + Math.cos(time * 0.7) * 80,
    0, W * 0.3, H * 0.4, W * 0.4,
  );
  neb1.addColorStop(0,   '#2a1a5e');
  neb1.addColorStop(0.5, '#1a0a3e');
  neb1.addColorStop(1,   'transparent');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, W, H);

  const neb2 = ctx.createRadialGradient(
    W * 0.7 + Math.cos(time * 1.2) * 80,
    H * 0.6 + Math.sin(time * 0.8) * 60,
    0, W * 0.7, H * 0.6, W * 0.35,
  );
  neb2.addColorStop(0,   '#0a2a5e');
  neb2.addColorStop(0.5, '#0a1a3e');
  neb2.addColorStop(1,   'transparent');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Stars
  stars.forEach(s => s.draw());

  // "Nadim" top-left label
  ctx.save();
  const labelSize = W < 600 ? 18 : 28;
  ctx.font = `bold ${labelSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(240, 240, 255, 0.9)';
  ctx.fillText('Nadim', W < 600 ? 14 : 24, W < 600 ? 12 : 20);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─── Fist Cursor Glow ───────────────────────────────────────────────
function drawFistGlow() {
  if (!isFist || fistX === null) return;

  const grad = ctx.createRadialGradient(
    fistX, fistY, 0,
    fistX, fistY, CONFIG.repelRadius,
  );
  grad.addColorStop(0,   'rgba(255, 255, 255, 0.12)');
  grad.addColorStop(0.5, 'rgba(220, 225, 255, 0.04)');
  grad.addColorStop(1,   'rgba(220, 225, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(fistX, fistY, CONFIG.repelRadius, 0, Math.PI * 2);
  ctx.fill();

  // Small bright core
  ctx.beginPath();
  ctx.arc(fistX, fistY, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
}

// ─── Main Animation Loop ────────────────────────────────────────────
function animate() {
  drawBackground();

  // Debounced gesture transitions
  if (currentGesture !== displayedGesture) {
    if (currentGesture === pendingGesture) {
      gestureCounter++;
    } else {
      pendingGesture = currentGesture;
      gestureCounter = 0;
    }

    if (gestureCounter >= GESTURE_HOLD_FRAMES) {
      if (pendingGesture !== 'none' && pendingGesture !== 'fist' && pendingGesture in GESTURE_SIGNS) {
        const newText = GESTURE_SIGNS[pendingGesture];
        if (newText !== gestureText || !textMode) {
          gestureText = newText;
          textMode    = true;
          assignTextToParticles(gestureText);
        }
      } else {
        textMode = false;
      }
      displayedGesture = pendingGesture;
    }
  } else {
    pendingGesture = currentGesture;
    gestureCounter = 0;
  }

  // Update & draw particles
  for (const p of particles) {
    const alpha = p.update(textMode);
    p.draw(alpha);
  }

  drawFistGlow();
  requestAnimationFrame(animate);
}

// ─── MediaPipe Hands ─────────────────────────────────────────────────
const videoEl        = document.getElementById('webcam');
const statusEl       = document.getElementById('status');
const gestureLabelEl = document.getElementById('gesture-label');

const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
});

hands.setOptions({
  maxNumHands:            2,
  modelComplexity:        1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence:  0.6,
});

hands.onResults((results) => {
  const allHands = results.multiHandLandmarks || [];
  numHandsVisible = allHands.length;

  if (numHandsVisible > 0) {
    hasHand = true;

    // Track motion history for each visible hand
    for (let i = 0; i < numHandsVisible; i++) addToHistory(i, allHands[i]);

    // Detect sign: try two-hand signs first, then single-hand
    if (numHandsVisible >= 2) {
      const twoHandResult = detectTwoHandSign(allHands[0], allHands[1]);
      currentGesture = twoHandResult || detectOneHandSign(allHands[0]);
    } else {
      currentGesture = detectOneHandSign(allHands[0]);
    }

    // Fist position for particle repulsion
    isFist = currentGesture === 'fist';
    if (isFist) {
      const palm = allHands[0][9];
      fistX = (1 - palm.x) * W;
      fistY = palm.y * H;
    }

    // UI label
    if (currentGesture in GESTURE_SIGNS) {
      gestureLabelEl.textContent = GESTURE_SIGNS[currentGesture];
    } else if (currentGesture === 'fist') {
      gestureLabelEl.textContent = 'Fist detected';
    } else {
      gestureLabelEl.textContent = 'Tracking hand...';
    }

    if (statusEl.style.opacity !== '0') statusEl.style.opacity = '0';
  } else {
    hasHand        = false;
    isFist         = false;
    fistX          = null;
    fistY          = null;
    currentGesture = 'none';
    numHandsVisible = 0;
    handHistory[0] = [];
    handHistory[1] = [];

    gestureLabelEl.textContent = '';
    statusEl.textContent       = 'Show your hand to the camera';
    statusEl.style.opacity     = '1';
  }
});

// ─── Camera Start ────────────────────────────────────────────────────
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    videoEl.srcObject = stream;
    await videoEl.play();

    statusEl.textContent = 'Loading hand tracking model...';

    const camera = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width:  640,
      height: 480,
    });
    camera.start();

    statusEl.textContent = 'Show your hand to the camera';
  } catch (err) {
    statusEl.textContent =
      'Camera access denied. Please allow camera and reload.';
    console.error('Camera error:', err);
  }
}

// ─── Launch ──────────────────────────────────────────────────────────
startCamera();
animate();
