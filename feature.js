const shell = document.getElementById('tracker-shell');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const videoEl = document.getElementById('webcam');
const statusEl = document.getElementById('status');
const gestureLabelEl = document.getElementById('gesture-label');

let W = 0;
let H = 0;

function resizeCanvas() {
  const rect = shell.getBoundingClientRect();
  W = canvas.width = Math.floor(rect.width);
  H = canvas.height = Math.floor(rect.height);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const GESTURE_SIGNS = {
  hello:        'HELLO',
  nadim:        'THIS IS NADIM',
  nice_to_meet: 'NICE TO MEET YOU',
  i_love_you:   'I LOVE YOU',
  thank_you:    'THANK YOU',
  what_do_u_want: 'WHAT DO YOU WANT?',
  cute:         'U r cute and yk rose',
  fuck_u:       'FUCK U',
  u_suck:       'U SUCK',
};

const GESTURE_HOLD_FRAMES = 4;

let currentGesture = 'none';
let displayedText   = '';
let pendingGesture  = 'none';
let gestureCounter  = 0;
let animFrameId     = null;

/* ── Gesture helpers ───────────────────────────────── */
function isFingerUp(lm, finger) {
  const tips = { index: 8, middle: 12, ring: 16, pinky: 20 };
  const pips = { index: 6, middle: 10, ring: 14, pinky: 18 };
  return lm[tips[finger]].y < lm[pips[finger]].y;
}

function isThumbUp(lm) {
  const tip = lm[4], ip = lm[3], mcp = lm[2];
  return Math.hypot(tip.x - mcp.x, tip.y - mcp.y) >
         Math.hypot(ip.x  - mcp.x, ip.y  - mcp.y) * 1.2;
}

function landmarkDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function detectTwoHandSign(lm0, lm1) {
  const idx0 = isFingerUp(lm0,'index') && !isFingerUp(lm0,'middle') &&
               !isFingerUp(lm0,'ring')  && !isFingerUp(lm0,'pinky');
  const idx1 = isFingerUp(lm1,'index') && !isFingerUp(lm1,'middle') &&
               !isFingerUp(lm1,'ring')  && !isFingerUp(lm1,'pinky');
  if (idx0 && idx1 && landmarkDist(lm0[8], lm1[8]) < 0.12) return 'nice_to_meet';
  return null;
}

function detectOneHandSign(lm) {
  const iUp = isFingerUp(lm,'index'),  mUp = isFingerUp(lm,'middle'),
        rUp = isFingerUp(lm,'ring'),   pUp = isFingerUp(lm,'pinky'),
        tOut = isThumbUp(lm);

  const pinchThreshold = 0.07;
  const allPinched =
    landmarkDist(lm[4],lm[8])  < pinchThreshold &&
    landmarkDist(lm[4],lm[12]) < pinchThreshold &&
    landmarkDist(lm[4],lm[16]) < pinchThreshold &&
    landmarkDist(lm[4],lm[20]) < pinchThreshold;

  if (allPinched)                                  return 'what_do_u_want';
  if (!iUp && mUp && !rUp && !pUp)                 return 'fuck_u';
  if (tOut && iUp && !mUp && !rUp && pUp)          return 'i_love_you';
  if (iUp && mUp && !rUp && !pUp)                  return 'cute';
  if (iUp && !mUp && !rUp && !pUp && tOut &&
      Math.abs(lm[4].x - lm[5].x) > 0.08)         return 'u_suck';
  if (iUp && !mUp && !rUp && !pUp)                 return 'hello';
  if (!iUp && !mUp && !rUp && pUp)                 return 'thank_you';
  if (iUp && mUp && rUp && pUp)                    return 'nadim';
  if (!iUp && !mUp && !rUp && !pUp)                return 'fist';
  return 'none';
}

/* ── Draw ──────────────────────────────────────────── */
function drawText(text) {
  ctx.clearRect(0, 0, W, H);
  if (!text) return;

  const maxW = W * 0.85;
  let fontSize = Math.min(W * 0.14, 110);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  function setFont(size) {
    ctx.font = `900 ${size}px Roboto, Arial, sans-serif`;
  }

  setFont(fontSize);
  while (fontSize > 28 && ctx.measureText(text).width > maxW) {
    fontSize -= 4;
    setFont(fontSize);
  }

  const words = text.split(' ');
  if (words.length > 1 && ctx.measureText(text).width > maxW) {
    const lineHeight = fontSize * 1.25;
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = word;
      } else { line = test; }
    }
    if (line) lines.push(line);
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
    ctx.fillStyle = '#0A192F';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight));
  } else {
    ctx.fillStyle = '#0A192F';
    ctx.fillText(text, W / 2, H / 2);
  }
}

/* ── Animate loop ──────────────────────────────────── */
function animate() {
  if (currentGesture === pendingGesture) {
    gestureCounter++;
  } else {
    pendingGesture = currentGesture;
    gestureCounter = 0;
  }

  if (gestureCounter >= GESTURE_HOLD_FRAMES) {
    if (pendingGesture in GESTURE_SIGNS) {
      const newText = GESTURE_SIGNS[pendingGesture];
      if (newText !== displayedText) {
        displayedText = newText;
        drawText(displayedText);
      }
    } else if (pendingGesture === 'none' || pendingGesture === 'fist') {
      if (displayedText !== '') {
        displayedText = '';
        ctx.clearRect(0, 0, W, H);
      }
    }
  }

  animFrameId = requestAnimationFrame(animate);
}

/* ── MediaPipe ─────────────────────────────────────── */
const hands = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.6,
});

hands.onResults((results) => {
  const allHands = results.multiHandLandmarks || [];

  if (allHands.length > 0) {
    currentGesture = allHands.length >= 2
      ? (detectTwoHandSign(allHands[0], allHands[1]) || detectOneHandSign(allHands[0]))
      : detectOneHandSign(allHands[0]);

    gestureLabelEl.textContent = currentGesture in GESTURE_SIGNS
      ? GESTURE_SIGNS[currentGesture]
      : currentGesture === 'fist' ? 'Fist detected' : 'Tracking hand…';

    statusEl.style.opacity = '0';
  } else {
    currentGesture = 'none';
    gestureLabelEl.textContent = '';
    statusEl.textContent = 'Show your hand to the camera';
    statusEl.style.opacity = '1';
  }
});

/* ── Camera start / stop ───────────────────────────── */
let cameraInstance = null;
let isRunning = false;

async function startCamera() {
  if (isRunning) return;
  isRunning = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    statusEl.textContent = 'Loading hand tracking model…';
    cameraInstance = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width: 640, height: 480,
    });
    cameraInstance.start();
    statusEl.textContent = 'Show your hand to the camera';
  } catch (err) {
    statusEl.textContent = 'Camera access denied. Please allow camera and reload.';
    console.error(err);
    isRunning = false;
  }
}

function stopCamera() {
  isRunning = false;
  cancelAnimationFrame(animFrameId);
  animFrameId = null;
  try { if (cameraInstance) cameraInstance.stop(); } catch (_) {}
  cameraInstance = null;
  if (videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  currentGesture = 'none';
  displayedText = '';
  ctx.clearRect(0, 0, W, H);
  gestureLabelEl.textContent = '';
  statusEl.textContent = 'Camera stopped. Click Start to resume.';
  statusEl.style.opacity = '1';
}

document.getElementById('startBtn')?.addEventListener('click', () => {
  if (!isRunning) { startCamera(); animate(); }
});
document.getElementById('stopBtn')?.addEventListener('click', stopCamera);

startCamera();
animate();
