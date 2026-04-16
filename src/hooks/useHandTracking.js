import { useCallback, useEffect, useRef, useState } from 'react';
import { detectGesture } from '../utils/gestureUtils';

const HANDS_CDN_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands';
const DRAWING_UTILS_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';

let mediaPipeRuntimePromise = null;
let HandsConstructorRef = null;
let handConnectionsRef = [];
let drawConnectorsRef = null;
let drawLandmarksRef = null;

function getGlobalScope() {
  if (typeof window !== 'undefined') {
    return window;
  }

  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }

  return null;
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const scope = getGlobalScope();

    if (!scope || !scope.document) {
      reject(new Error('Document is unavailable for script loading.'));
      return;
    }

    const existing = scope.document.querySelector(`script[data-neuroflux-src="${src}"]`);

    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), {
        once: true
      });
      return;
    }

    const script = scope.document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-neuroflux-src', src);

    script.addEventListener(
      'load',
      () => {
        script.setAttribute('data-loaded', 'true');
        resolve();
      },
      { once: true }
    );

    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), {
      once: true
    });

    scope.document.head.appendChild(script);
  });
}

function captureMediaPipeGlobals() {
  const scope = getGlobalScope() ?? {};

  return {
    hands: scope.Hands,
    handConnections: Array.isArray(scope.HAND_CONNECTIONS) ? scope.HAND_CONNECTIONS : [],
    drawConnectors: scope.drawConnectors,
    drawLandmarks: scope.drawLandmarks
  };
}

async function ensureMediaPipeRuntime() {
  const runtimeReady =
    typeof HandsConstructorRef === 'function' &&
    handConnectionsRef.length > 0 &&
    typeof drawConnectorsRef === 'function' &&
    typeof drawLandmarksRef === 'function';

  if (runtimeReady) {
    return;
  }

  if (!mediaPipeRuntimePromise) {
    mediaPipeRuntimePromise = (async () => {
      let globals = captureMediaPipeGlobals();

      if (
        typeof globals.hands !== 'function' ||
        typeof globals.drawConnectors !== 'function' ||
        typeof globals.drawLandmarks !== 'function'
      ) {
        await loadExternalScript(`${HANDS_CDN_BASE_URL}/hands.js`);
        await loadExternalScript(DRAWING_UTILS_CDN_URL);
        globals = captureMediaPipeGlobals();
      }

      if (typeof globals.hands !== 'function') {
        throw new Error('MediaPipe Hands runtime unavailable after script load.');
      }

      if (
        typeof globals.drawConnectors !== 'function' ||
        typeof globals.drawLandmarks !== 'function'
      ) {
        throw new Error('MediaPipe drawing utilities unavailable after script load.');
      }

      HandsConstructorRef = globals.hands;
      handConnectionsRef = globals.handConnections;
      drawConnectorsRef = globals.drawConnectors;
      drawLandmarksRef = globals.drawLandmarks;
    })().catch((error) => {
      mediaPipeRuntimePromise = null;
      throw error;
    });
  }

  await mediaPipeRuntimePromise;
}

const EMPTY_RESULT = {
  handLandmarks: [],
  gesture: 'NO_HANDS',
  handsCount: 0
};

const GESTURE_AURA = {
  OPEN_HAND: {
    core: [255, 182, 83],
    glow: [255, 88, 0],
    stroke: [255, 214, 156],
    scale: 1.18
  },
  FIST: {
    core: [255, 140, 69],
    glow: [255, 34, 0],
    stroke: [255, 212, 155],
    scale: 1.28
  },
  PINCH: {
    core: [149, 219, 255],
    glow: [69, 140, 255],
    stroke: [206, 236, 255],
    scale: 0.94
  },
  TWO_HANDS: {
    core: [232, 186, 255],
    glow: [140, 86, 255],
    stroke: [239, 220, 255],
    scale: 1.36
  }
};

const PALM_CONTOUR_INDEXES = [0, 1, 2, 5, 9, 13, 17];
const FINGERTIP_INDEXES = [4, 8, 12, 16, 20];

const DEFAULT_DRAW_SETTINGS = {
  drawEnabled: true,
  drawMode: 'draw',
  triggerGesture: 'AUTO',
  handwritingAssist: true,
  brushColor: '#74d6ff',
  brushPattern: 'solid',
  brushStyle: 'neon',
  brushSize: 5,
  brushOpacity: 0.92,
  glowStrength: 14,
  smoothness: 0.32,
  blendMode: 'screen',
  particleMode: 'spark',
  particleDensity: 4,
  particleSize: 6,
  particleLifetimeMs: 1500,
  particleSpread: 1,
  particleSpeed: 1,
  rainbowBrush: false,
  mirrorHorizontal: false,
  mirrorVertical: false,
  autoFade: false,
  strokeLifetimeMs: 30000,
  maxSavedStrokes: 36,
  templateEnabled: false,
  templateType: 'star',
  templateOpacity: 0.42,
  templateScale: 1,
  templateOffsetX: 0,
  templateOffsetY: 0,
  templateColor: '#ffffff',
  showAura: false,
  showLandmarks: true,
  showFusionLink: false,
  showCursor: true
};

const DEFAULT_DRAW_STATS = {
  strokeCount: 0,
  savedStrokeCount: 0,
  redoCount: 0,
  isGestureDrawing: false,
  detectedGesture: 'NO_HANDS',
  drawEnabled: true,
  activeTool: 'draw',
  triggerGesture: 'AUTO',
  canUndo: false,
  canRedo: false,
  templateType: 'off',
  mirrorMode: 'none',
  particleMode: 'spark',
  particleCount: 0,
  lastAction: 'Ready'
};

const BRUSH_PATTERNS = ['solid', 'dashed', 'dotted'];
const BRUSH_STYLES = ['neon', 'ink', 'marker', 'spray', 'calligraphy', 'watercolor'];
const PRACTICE_TEMPLATES = [
  'star',
  'circle',
  'heart',
  'flower',
  'house',
  'letter-a',
  '3d-orb',
  '3d-cube',
  '3d-face'
];
const TRIGGER_GESTURES = ['AUTO', 'PINCH', 'POINT', 'V_SIGN', 'OPEN_HAND', 'FIST'];
const PARTICLE_MODES = ['none', 'spark', 'magic', 'ember', 'smoke'];

const HANDS_DEFAULT_OPTIONS = {
  modelComplexity: 1,
  maxNumHands: 2,
  minDetectionConfidence: 0.38,
  minTrackingConfidence: 0.34
};

const HANDS_RECOVERY_OPTIONS = {
  modelComplexity: 0,
  maxNumHands: 2,
  minDetectionConfidence: 0.24,
  minTrackingConfidence: 0.22
};

const NO_HANDS_FRAMES_FOR_RECOVERY = 12;
const OPTIONS_SWAP_COOLDOWN_MS = 520;
const DRAW_TRIGGER_GRACE_MS = {
  standard: 180,
  handwriting: 520
};
const DRAW_START_CONFIRM_FRAMES = {
  standard: 1,
  handwriting: 2
};
const FAST_MOTION_SPEED_THRESHOLD = {
  standard: 0.6,
  handwriting: 0.38
};
const ACTIVE_STROKE_IDLE_TIMEOUT_MS = {
  standard: 1200,
  handwriting: 2400
};
const UNKNOWN_GESTURE_HOLD_MS = 620;
const POINTER_MODEL_MEMORY_MS = 760;
const HANDS_SEND_INTERVAL_MS = {
  standard: 10,
  handwriting: 10
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha, 0, 1)})`;
}

function toCanvasPoint(point, canvas) {
  return {
    x: point.x * canvas.width,
    y: point.y * canvas.height
  };
}

function createPathFromPoints(context, points) {
  if (!Array.isArray(points) || points.length < 2) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
}

function parseHexColor(value) {
  if (typeof value !== 'string') {
    return [116, 214, 255];
  }

  const hex = value.trim();
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [116, 214, 255];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function hueToRgb(hueDegrees) {
  const hue = ((hueDegrees % 360) + 360) % 360;
  const chroma = 1;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = 0;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return [
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255)
  ];
}

function resolveBlendMode(mode) {
  if (mode === 'normal') {
    return 'source-over';
  }

  if (mode === 'additive') {
    return 'lighter';
  }

  return 'screen';
}

function resolveMirrorLabel(settings) {
  if (settings.mirrorHorizontal && settings.mirrorVertical) {
    return 'hv';
  }

  if (settings.mirrorHorizontal) {
    return 'horizontal';
  }

  if (settings.mirrorVertical) {
    return 'vertical';
  }

  return 'none';
}

function withMirroredPoints(points, width, height, mirrorHorizontal, mirrorVertical) {
  return points.map((point) => ({
    x: mirrorHorizontal ? width - point.x : point.x,
    y: mirrorVertical ? height - point.y : point.y
  }));
}

function buildStrokeVariants(points, width, height, settings) {
  const variants = [points];

  if (settings.mirrorHorizontal) {
    variants.push(withMirroredPoints(points, width, height, true, false));
  }

  if (settings.mirrorVertical) {
    variants.push(withMirroredPoints(points, width, height, false, true));
  }

  if (settings.mirrorHorizontal && settings.mirrorVertical) {
    variants.push(withMirroredPoints(points, width, height, true, true));
  }

  return variants;
}

function drawStarPath(context, cx, cy, outerRadius, innerRadius, points = 5) {
  const step = Math.PI / points;
  context.beginPath();

  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = index * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
}

function drawHeartPath(context, cx, cy, size) {
  const top = cy - size * 0.16;
  context.beginPath();
  context.moveTo(cx, cy + size * 0.5);
  context.bezierCurveTo(cx - size * 0.9, cy, cx - size * 0.65, top - size * 0.7, cx, top);
  context.bezierCurveTo(cx + size * 0.65, top - size * 0.7, cx + size * 0.9, cy, cx, cy + size * 0.5);
  context.closePath();
}

function drawHousePath(context, cx, cy, size) {
  const half = size * 0.5;
  const wallTop = cy - size * 0.12;
  const wallBottom = cy + size * 0.5;

  context.beginPath();
  context.moveTo(cx - half, wallTop);
  context.lineTo(cx + half, wallTop);
  context.lineTo(cx + half, wallBottom);
  context.lineTo(cx - half, wallBottom);
  context.closePath();

  context.moveTo(cx - half * 1.1, wallTop);
  context.lineTo(cx, cy - size * 0.62);
  context.lineTo(cx + half * 1.1, wallTop);
  context.closePath();

  const doorHalf = size * 0.12;
  context.moveTo(cx - doorHalf, wallBottom);
  context.lineTo(cx - doorHalf, cy + size * 0.14);
  context.lineTo(cx + doorHalf, cy + size * 0.14);
  context.lineTo(cx + doorHalf, wallBottom);
}

function drawLetterAPath(context, cx, cy, size) {
  const topY = cy - size * 0.62;
  const baseY = cy + size * 0.52;

  context.beginPath();
  context.moveTo(cx, topY);
  context.lineTo(cx - size * 0.5, baseY);
  context.moveTo(cx, topY);
  context.lineTo(cx + size * 0.5, baseY);
  context.moveTo(cx - size * 0.28, cy + size * 0.04);
  context.lineTo(cx + size * 0.28, cy + size * 0.04);
}

function drawFlowerTemplate(context, cx, cy, size) {
  const petalRadius = size * 0.28;
  const ringRadius = size * 0.36;

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const px = cx + Math.cos(angle) * ringRadius;
    const py = cy + Math.sin(angle) * ringRadius;

    context.beginPath();
    context.arc(px, py, petalRadius, 0, Math.PI * 2);
    context.stroke();
  }

  context.beginPath();
  context.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

function draw3DOrbTemplate(context, cx, cy, size, color, opacity, nowMs) {
  const rx = size * 0.72;
  const ry = size * 0.56;
  const tilt = Math.sin(nowMs * 0.0028) * 0.12;

  context.setLineDash([]);

  const bodyGradient = context.createRadialGradient(
    cx - rx * 0.26,
    cy - ry * 0.32,
    size * 0.08,
    cx,
    cy,
    rx * 1.25
  );
  bodyGradient.addColorStop(0, rgba([245, 250, 255], opacity * 0.56));
  bodyGradient.addColorStop(0.24, rgba(color, opacity * 0.48));
  bodyGradient.addColorStop(1, rgba([7, 20, 38], opacity * 0.46));

  context.fillStyle = bodyGradient;
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = rgba([228, 238, 255], opacity * 0.84);
  context.lineWidth = Math.max(1.5, size * 0.014);
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = rgba([186, 206, 255], opacity * 0.42);
  context.lineWidth = Math.max(1.1, size * 0.01);
  for (let step = -2; step <= 2; step += 1) {
    const offset = (step / 5) * ry * 1.04;
    const bandScale = Math.sqrt(Math.max(0.03, 1 - (offset * offset) / (ry * ry)));

    context.beginPath();
    context.ellipse(cx, cy + offset * 0.18, rx * bandScale, ry * 0.22 * bandScale, tilt, 0, Math.PI * 2);
    context.stroke();
  }

  const specular = context.createRadialGradient(
    cx - rx * 0.38,
    cy - ry * 0.38,
    size * 0.01,
    cx - rx * 0.38,
    cy - ry * 0.38,
    size * 0.26
  );
  specular.addColorStop(0, rgba([255, 255, 255], opacity * 0.9));
  specular.addColorStop(1, rgba([255, 255, 255], 0));

  context.fillStyle = specular;
  context.beginPath();
  context.ellipse(cx - rx * 0.34, cy - ry * 0.34, size * 0.12, size * 0.09, tilt, 0, Math.PI * 2);
  context.fill();
}

function draw3DCubeTemplate(context, cx, cy, size, color, opacity, nowMs) {
  const half = size * 0.44;
  const depth = size * (0.2 + Math.sin(nowMs * 0.002) * 0.03);
  const lift = size * 0.2;

  const front = [
    { x: cx - half, y: cy - half + lift },
    { x: cx + half, y: cy - half + lift },
    { x: cx + half, y: cy + half + lift },
    { x: cx - half, y: cy + half + lift }
  ];

  const back = front.map((point) => ({
    x: point.x + depth,
    y: point.y - depth * 0.7
  }));

  const fillFace = (points, fillStyle) => {
    context.fillStyle = fillStyle;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.closePath();
    context.fill();
  };

  context.setLineDash([]);

  fillFace([
    back[0],
    back[1],
    front[1],
    front[0]
  ], rgba([212, 226, 255], opacity * 0.2));

  fillFace([
    back[1],
    back[2],
    front[2],
    front[1]
  ], rgba([96, 132, 196], opacity * 0.34));

  fillFace(front, rgba(color, opacity * 0.28));

  context.strokeStyle = rgba([236, 244, 255], opacity * 0.92);
  context.lineWidth = Math.max(1.4, size * 0.012);

  const drawLoop = (points) => {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.closePath();
    context.stroke();
  };

  drawLoop(front);
  drawLoop(back);

  for (let index = 0; index < front.length; index += 1) {
    context.beginPath();
    context.moveTo(front[index].x, front[index].y);
    context.lineTo(back[index].x, back[index].y);
    context.stroke();
  }
}

function draw3DFaceTemplate(context, cx, cy, size, color, opacity, nowMs) {
  const headW = size * 0.5;
  const headH = size * 0.68;
  const tilt = Math.sin(nowMs * 0.0024) * 0.08;

  context.setLineDash([]);

  const skinGradient = context.createRadialGradient(
    cx - headW * 0.22,
    cy - headH * 0.32,
    size * 0.08,
    cx,
    cy,
    size * 0.9
  );
  skinGradient.addColorStop(0, rgba([255, 243, 232], opacity * 0.5));
  skinGradient.addColorStop(0.45, rgba(color, opacity * 0.32));
  skinGradient.addColorStop(1, rgba([64, 76, 108], opacity * 0.36));

  context.fillStyle = skinGradient;
  context.beginPath();
  context.ellipse(cx, cy, headW, headH, tilt, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = rgba([236, 244, 255], opacity * 0.85);
  context.lineWidth = Math.max(1.3, size * 0.012);
  context.beginPath();
  context.ellipse(cx, cy, headW, headH, tilt, 0, Math.PI * 2);
  context.stroke();

  const eyeY = cy - headH * 0.15;
  const eyeOffset = headW * 0.34;
  const eyeW = size * 0.1;
  const eyeH = size * 0.04;

  context.strokeStyle = rgba([246, 251, 255], opacity * 0.86);
  context.lineWidth = Math.max(1.1, size * 0.008);
  context.beginPath();
  context.ellipse(cx - eyeOffset, eyeY, eyeW, eyeH, tilt, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.ellipse(cx + eyeOffset, eyeY, eyeW, eyeH, tilt, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = rgba([16, 25, 43], opacity * 0.75);
  context.beginPath();
  context.arc(cx - eyeOffset, eyeY, size * 0.018, 0, Math.PI * 2);
  context.arc(cx + eyeOffset, eyeY, size * 0.018, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = rgba([226, 236, 255], opacity * 0.76);
  context.beginPath();
  context.moveTo(cx, cy - headH * 0.06);
  context.lineTo(cx - size * 0.03, cy + headH * 0.14);
  context.lineTo(cx + size * 0.03, cy + headH * 0.16);
  context.stroke();

  context.beginPath();
  context.arc(cx, cy + headH * 0.3, size * 0.16, 0.16 * Math.PI, 0.84 * Math.PI);
  context.stroke();

  context.strokeStyle = rgba([196, 212, 255], opacity * 0.55);
  context.lineWidth = Math.max(1, size * 0.006);
  context.beginPath();
  context.moveTo(cx - headW * 0.56, cy + headH * 0.48);
  context.quadraticCurveTo(cx, cy + headH * 0.84, cx + headW * 0.56, cy + headH * 0.48);
  context.stroke();
}

function drawPracticeTemplate(context, canvas, settings, nowMs) {
  if (!settings.templateEnabled) {
    return;
  }

  const color = parseHexColor(settings.templateColor);
  const pulse = 0.985 + Math.sin(nowMs * 0.004) * 0.025;
  const baseSize = Math.min(canvas.width, canvas.height) * 0.24 * settings.templateScale * pulse;
  const centerX = canvas.width * (0.5 + settings.templateOffsetX * 0.22);
  const centerY = canvas.height * (0.5 + settings.templateOffsetY * 0.22);

  context.save();
  context.globalCompositeOperation = 'screen';
  context.strokeStyle = rgba(color, settings.templateOpacity);
  context.fillStyle = rgba(color, settings.templateOpacity * 0.12);
  context.shadowColor = rgba(color, settings.templateOpacity * 0.75);
  context.shadowBlur = 12;
  context.lineWidth = Math.max(2, baseSize * 0.016);

  const is3DTemplate =
    settings.templateType === '3d-orb' ||
    settings.templateType === '3d-cube' ||
    settings.templateType === '3d-face';

  context.setLineDash(is3DTemplate ? [] : [10, 8]);

  if (settings.templateType === 'circle') {
    context.beginPath();
    context.arc(centerX, centerY, baseSize * 0.72, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (settings.templateType === 'heart') {
    drawHeartPath(context, centerX, centerY, baseSize);
    context.fill();
    context.stroke();
  } else if (settings.templateType === 'flower') {
    drawFlowerTemplate(context, centerX, centerY, baseSize);
  } else if (settings.templateType === 'house') {
    drawHousePath(context, centerX, centerY, baseSize);
    context.fill();
    context.stroke();
  } else if (settings.templateType === 'letter-a') {
    drawLetterAPath(context, centerX, centerY, baseSize);
    context.stroke();
  } else if (settings.templateType === '3d-orb') {
    draw3DOrbTemplate(context, centerX, centerY, baseSize, color, settings.templateOpacity, nowMs);
  } else if (settings.templateType === '3d-cube') {
    draw3DCubeTemplate(context, centerX, centerY, baseSize, color, settings.templateOpacity, nowMs);
  } else if (settings.templateType === '3d-face') {
    draw3DFaceTemplate(context, centerX, centerY, baseSize, color, settings.templateOpacity, nowMs);
  } else {
    drawStarPath(context, centerX, centerY, baseSize * 0.78, baseSize * 0.34, 5);
    context.fill();
    context.stroke();
  }

  context.setLineDash([]);
  context.restore();
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function resolveParticleProfile(mode, baseColor, nowMs) {
  if (mode === 'smoke') {
    return {
      color: [186, 196, 210],
      alpha: 0.48,
      gravity: -0.012,
      drag: 0.992,
      blend: 'source-over'
    };
  }

  if (mode === 'magic') {
    return {
      color: hueToRgb((nowMs * 0.11 + 260) % 360),
      alpha: 0.94,
      gravity: -0.01,
      drag: 0.988,
      blend: 'screen'
    };
  }

  if (mode === 'ember') {
    return {
      color: [255, 154, 77],
      alpha: 0.96,
      gravity: 0.016,
      drag: 0.982,
      blend: 'lighter'
    };
  }

  return {
    color: baseColor,
    alpha: 0.94,
    gravity: 0.009,
    drag: 0.985,
    blend: 'lighter'
  };
}

function resolveParticleIntervalMs(settings) {
  // Higher density should emit more frequently, but still stay bounded for performance.
  const density = clamp(settings.particleDensity, 1, 10);
  const handwritingPadding = settings.handwritingAssist ? 18 : 0;
  return Math.round(clamp(70 - density * 5 + handwritingPadding, 18, 96));
}

function spawnParticles(drawState, settings, point, nowMs, canvasWidth, canvasHeight) {
  if (settings.particleMode === 'none') {
    return;
  }

  const origins = buildStrokeVariants([point], canvasWidth, canvasHeight, settings)
    .map((variant) => variant[0])
    .filter(Boolean);

  const baseColor = settings.rainbowBrush ? hueToRgb((nowMs * 0.07) % 360) : parseHexColor(settings.brushColor);
  const baseEmitCount = Math.max(1, Math.round(settings.particleDensity));
  const emitCount = settings.handwritingAssist
    ? Math.max(1, Math.round(baseEmitCount * 0.72))
    : baseEmitCount;

  origins.forEach((originPoint) => {
    for (let index = 0; index < emitCount; index += 1) {
      const profile = resolveParticleProfile(settings.particleMode, baseColor, nowMs + index * 17);
      const spread = settings.brushSize * settings.particleSpread;

      drawState.particles.push({
        x: originPoint.x + randomRange(-spread, spread) * 0.35,
        y: originPoint.y + randomRange(-spread, spread) * 0.35,
        vx: randomRange(-0.8, 0.8) * settings.particleSpread,
        vy: randomRange(-1.1, 0.5) * settings.particleSpread,
        size: settings.particleSize * randomRange(0.55, 1.28),
        createdAt: nowMs,
        lifetime: settings.particleLifetimeMs * randomRange(0.72, 1.12),
        color: profile.color,
        alpha: profile.alpha,
        gravity: profile.gravity,
        drag: profile.drag,
        blend: profile.blend
      });
    }
  });

  const maxParticles = settings.handwritingAssist ? 1200 : 2400;

  if (drawState.particles.length > maxParticles) {
    drawState.particles.splice(0, drawState.particles.length - maxParticles);
  }
}

function drawParticleLayer(context, drawState, settings, nowMs) {
  if (drawState.particles.length === 0) {
    return;
  }

  context.save();
  const speedScale = clamp(settings.particleSpeed, 0.2, 2.3);

  for (let index = drawState.particles.length - 1; index >= 0; index -= 1) {
    const particle = drawState.particles[index];
    const age = nowMs - particle.createdAt;

    if (age > particle.lifetime) {
      drawState.particles.splice(index, 1);
      continue;
    }

    const lifeProgress = 1 - age / particle.lifetime;
    particle.vx *= particle.drag;
    particle.vy = particle.vy * particle.drag + particle.gravity * speedScale;
    particle.x += particle.vx * speedScale;
    particle.y += particle.vy * speedScale;

    const alpha = particle.alpha * lifeProgress;
    const size = Math.max(0.2, particle.size * (0.42 + 0.58 * lifeProgress));

    context.globalCompositeOperation = particle.blend;

    const gradient = context.createRadialGradient(
      particle.x,
      particle.y,
      size * 0.1,
      particle.x,
      particle.y,
      size
    );

    gradient.addColorStop(0, rgba(particle.color, alpha));
    gradient.addColorStop(1, rgba(particle.color, 0));

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    context.fill();

    // Bright center keeps particles visible over complex camera backgrounds.
    context.fillStyle = rgba([255, 255, 255], alpha * 0.55);
    context.beginPath();
    context.arc(particle.x, particle.y, Math.max(0.6, size * 0.28), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function normalizeDrawSettings(input) {
  const merged = {
    ...DEFAULT_DRAW_SETTINGS,
    ...(input ?? {})
  };

  return {
    ...merged,
    drawEnabled: Boolean(merged.drawEnabled),
    drawMode: merged.drawMode === 'erase' ? 'erase' : 'draw',
    triggerGesture: TRIGGER_GESTURES.includes(merged.triggerGesture) ? merged.triggerGesture : 'AUTO',
    handwritingAssist: Boolean(merged.handwritingAssist),
    brushColor: typeof merged.brushColor === 'string' ? merged.brushColor : '#74d6ff',
    brushPattern: BRUSH_PATTERNS.includes(merged.brushPattern) ? merged.brushPattern : 'solid',
    brushStyle: BRUSH_STYLES.includes(merged.brushStyle) ? merged.brushStyle : 'neon',
    brushSize: clamp(Number(merged.brushSize) || 5, 1, 30),
    brushOpacity: clamp(Number(merged.brushOpacity) || 0.92, 0.05, 1),
    glowStrength: clamp(Number(merged.glowStrength) || 14, 0, 36),
    smoothness: clamp(Number(merged.smoothness) || 0.32, 0, 0.95),
    blendMode: ['screen', 'normal', 'additive'].includes(merged.blendMode)
      ? merged.blendMode
      : 'screen',
    particleMode: PARTICLE_MODES.includes(merged.particleMode) ? merged.particleMode : 'spark',
    particleDensity: clamp(Number(merged.particleDensity) || 4, 1, 10),
    particleSize: clamp(Number(merged.particleSize) || 6, 1, 20),
    particleLifetimeMs: clamp(Number(merged.particleLifetimeMs) || 1500, 280, 4000),
    particleSpread: clamp(Number(merged.particleSpread) || 1, 0.2, 2.4),
    particleSpeed: clamp(Number(merged.particleSpeed) || 1, 0.2, 2.3),
    rainbowBrush: Boolean(merged.rainbowBrush),
    mirrorHorizontal: Boolean(merged.mirrorHorizontal),
    mirrorVertical: Boolean(merged.mirrorVertical),
    autoFade: Boolean(merged.autoFade),
    strokeLifetimeMs: clamp(Number(merged.strokeLifetimeMs) || 18000, 2000, 120000),
    maxSavedStrokes: clamp(Number(merged.maxSavedStrokes) || 36, 4, 100),
    templateEnabled: Boolean(merged.templateEnabled),
    templateType: PRACTICE_TEMPLATES.includes(merged.templateType) ? merged.templateType : 'star',
    templateOpacity: clamp(Number(merged.templateOpacity) || 0.42, 0.12, 0.95),
    templateScale: clamp(Number(merged.templateScale) || 1, 0.5, 1.8),
    templateOffsetX: clamp(Number(merged.templateOffsetX) || 0, -1, 1),
    templateOffsetY: clamp(Number(merged.templateOffsetY) || 0, -1, 1),
    templateColor: typeof merged.templateColor === 'string' ? merged.templateColor : '#ffffff',
    showAura: Boolean(merged.showAura),
    showLandmarks: Boolean(merged.showLandmarks),
    showFusionLink: Boolean(merged.showFusionLink),
    showCursor: Boolean(merged.showCursor)
  };
}

function getPalmCenter(landmarks) {
  const anchorIndexes = [0, 5, 9, 13, 17];
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  anchorIndexes.forEach((index) => {
    const point = landmarks?.[index];

    if (!point) {
      return;
    }

    sumX += point.x;
    sumY += point.y;
    count += 1;
  });

  if (count === 0) {
    return null;
  }

  return {
    x: sumX / count,
    y: sumY / count
  };
}

function getPalmSpread(landmarks) {
  const wrist = landmarks?.[0];
  const middleTip = landmarks?.[12] ?? landmarks?.[8];

  if (!wrist || !middleTip) {
    return 0.08;
  }

  const dx = middleTip.x - wrist.x;
  const dy = middleTip.y - wrist.y;
  return clamp(Math.hypot(dx, dy), 0.045, 0.22);
}

function getPalmContourPoints(landmarks, canvas) {
  return PALM_CONTOUR_INDEXES.map((index) => landmarks?.[index])
    .filter(Boolean)
    .map((point) => toCanvasPoint(point, canvas));
}

function drawEnergyAura(context, canvas, landmarks, gesture, nowMs) {
  const auraStyle = GESTURE_AURA[gesture];

  if (!auraStyle) {
    return;
  }

  const center = getPalmCenter(landmarks);

  if (!center) {
    return;
  }

  const pulse = 0.92 + Math.sin(nowMs * 0.012) * 0.12;
  const spread = getPalmSpread(landmarks);
  const x = center.x * canvas.width;
  const y = center.y * canvas.height;
  const radiusPx = Math.max(26, spread * canvas.width * auraStyle.scale * pulse);
  const palmContour = getPalmContourPoints(landmarks, canvas);
  const points = landmarks.map((point) => toCanvasPoint(point, canvas));

  const gradient = context.createRadialGradient(x, y, radiusPx * 0.2, x, y, radiusPx * 1.08);
  gradient.addColorStop(0, rgba(auraStyle.core, 0.44));
  gradient.addColorStop(1, rgba(auraStyle.glow, 0.12));

  context.save();
  context.globalCompositeOperation = 'screen';
  context.shadowBlur = 18 * auraStyle.scale;
  context.shadowColor = rgba(auraStyle.glow, 0.52);

  if (palmContour.length >= 3) {
    context.fillStyle = gradient;
    createPathFromPoints(context, palmContour);
    context.closePath();
    context.fill();

    context.strokeStyle = rgba(auraStyle.stroke, 0.72);
    context.lineWidth = 1.8;
    createPathFromPoints(context, palmContour);
    context.closePath();
    context.stroke();
  }

  context.strokeStyle = rgba(auraStyle.stroke, 0.84);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(1.4, radiusPx * 0.035);

  handConnectionsRef.forEach(([start, end]) => {
    const startPoint = points[start];
    const endPoint = points[end];

    if (!startPoint || !endPoint) {
      return;
    }

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  });

  FINGERTIP_INDEXES.forEach((tipIndex, offset) => {
    const tipPoint = points[tipIndex];

    if (!tipPoint) {
      return;
    }

    const sparkPulse = 0.85 + Math.sin(nowMs * 0.016 + offset * 0.92) * 0.22;
    const sparkRadius = (2.6 + spread * 18) * sparkPulse;

    const sparkGradient = context.createRadialGradient(
      tipPoint.x,
      tipPoint.y,
      sparkRadius * 0.22,
      tipPoint.x,
      tipPoint.y,
      sparkRadius
    );

    sparkGradient.addColorStop(0, rgba(auraStyle.stroke, 0.95));
    sparkGradient.addColorStop(1, rgba(auraStyle.glow, 0));

    context.fillStyle = sparkGradient;
    context.beginPath();
    context.arc(tipPoint.x, tipPoint.y, sparkRadius, 0, Math.PI * 2);
    context.fill();
  });

  context.shadowBlur = 0;
  context.strokeStyle = rgba(auraStyle.core, 0.46);
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(x, y, radiusPx * 0.44, 0, Math.PI * 2);
  context.stroke();

  context.restore();
}

function drawFusionLink(context, canvas, multiHandLandmarks, nowMs) {
  if (!Array.isArray(multiHandLandmarks) || multiHandLandmarks.length < 2) {
    return;
  }

  const centerA = getPalmCenter(multiHandLandmarks[0]);
  const centerB = getPalmCenter(multiHandLandmarks[1]);

  if (!centerA || !centerB) {
    return;
  }

  const ax = centerA.x * canvas.width;
  const ay = centerA.y * canvas.height;
  const bx = centerB.x * canvas.width;
  const by = centerB.y * canvas.height;

  const beamAlpha = 0.5 + Math.sin(nowMs * 0.02) * 0.2;

  context.save();
  context.globalCompositeOperation = 'screen';
  context.strokeStyle = `rgba(208, 159, 255, ${clamp(beamAlpha, 0.25, 0.8)})`;
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(bx, by);
  context.stroke();
  context.restore();
}

function normalizedDistance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0), (a.z ?? 0) - (b.z ?? 0));
}

function getIndexTip(landmarks) {
  return landmarks?.[8] ?? null;
}

function getAdaptivePointerPrediction(drawState, nowMs) {
  const pointer = drawState.adaptivePointerNorm;

  if (!pointer) {
    return null;
  }

  const ageMs = nowMs - (drawState.adaptivePointerAt ?? 0);

  if (ageMs > POINTER_MODEL_MEMORY_MS) {
    return null;
  }

  const velocity = drawState.adaptivePointerVelocityNorm ?? { x: 0, y: 0, z: 0 };

  return {
    x: clamp(pointer.x + velocity.x * ageMs, 0, 1),
    y: clamp(pointer.y + velocity.y * ageMs, 0, 1),
    z: pointer.z + velocity.z * ageMs
  };
}

function buildPointerCandidates(multiHandLandmarks, predictedTip) {
  const hands = Array.isArray(multiHandLandmarks) ? multiHandLandmarks.filter(Boolean) : [];
  const candidates = [];

  hands.forEach((hand) => {
    const tip = getIndexTip(hand);

    if (!tip) {
      return;
    }

    const handScale = estimateHandScale(hand);
    const indexRatio = fingerSegmentRatio(hand, { tip: 8, pip: 6, mcp: 5 });
    const extensionScore = clamp((indexRatio - 0.94) / 0.34, 0, 1);
    const scaleScore = clamp((handScale - 0.05) / 0.16, 0, 1);
    const proximityScore = predictedTip
      ? clamp(1 - normalizedDistance(tip, predictedTip) / Math.max(0.09, handScale * 2.8), 0, 1)
      : 0.56;

    const score = proximityScore * 0.56 + extensionScore * 0.28 + scaleScore * 0.16;

    candidates.push({
      hand,
      tip,
      handScale,
      score
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function choosePrimaryHandAdaptive(multiHandLandmarks, drawState, nowMs) {
  const predictedTip = getAdaptivePointerPrediction(drawState, nowMs);
  const candidates = buildPointerCandidates(multiHandLandmarks, predictedTip);
  return candidates[0]?.hand ?? null;
}

function updateAdaptivePointer(drawState, observedTip, nowMs) {
  if (!observedTip) {
    return null;
  }

  const previousPoint = drawState.adaptivePointerNorm;
  const previousAt = drawState.adaptivePointerAt ?? 0;

  if (!previousPoint || !previousAt) {
    drawState.adaptivePointerNorm = {
      x: observedTip.x,
      y: observedTip.y,
      z: observedTip.z ?? 0
    };
    drawState.adaptivePointerVelocityNorm = { x: 0, y: 0, z: 0 };
    drawState.adaptivePointerAt = nowMs;
    return drawState.adaptivePointerNorm;
  }

  const deltaMs = Math.max(1, nowMs - previousAt);
  const instantVelocity = {
    x: (observedTip.x - previousPoint.x) / deltaMs,
    y: (observedTip.y - previousPoint.y) / deltaMs,
    z: ((observedTip.z ?? 0) - (previousPoint.z ?? 0)) / deltaMs
  };
  const previousVelocity = drawState.adaptivePointerVelocityNorm ?? { x: 0, y: 0, z: 0 };
  const blendedVelocity = {
    x: previousVelocity.x * 0.62 + instantVelocity.x * 0.38,
    y: previousVelocity.y * 0.62 + instantVelocity.y * 0.38,
    z: previousVelocity.z * 0.62 + instantVelocity.z * 0.38
  };
  const speedNormPerMs = Math.hypot(blendedVelocity.x, blendedVelocity.y);
  const alpha = clamp(0.34 + speedNormPerMs * 9.5, 0.34, 0.82);
  const smoothedPoint = {
    x: clamp(previousPoint.x + (observedTip.x - previousPoint.x) * alpha, 0, 1),
    y: clamp(previousPoint.y + (observedTip.y - previousPoint.y) * alpha, 0, 1),
    z: (previousPoint.z ?? 0) + ((observedTip.z ?? 0) - (previousPoint.z ?? 0)) * alpha
  };

  drawState.adaptivePointerNorm = smoothedPoint;
  drawState.adaptivePointerVelocityNorm = blendedVelocity;
  drawState.adaptivePointerAt = nowMs;
  return smoothedPoint;
}

function resolveAdaptiveDrawTip(multiHandLandmarks, drawState, nowMs) {
  const predictedTip = getAdaptivePointerPrediction(drawState, nowMs);
  const candidates = buildPointerCandidates(multiHandLandmarks, predictedTip);

  if (candidates.length === 0) {
    return null;
  }

  const [best, second] = candidates;
  let observedTip = best.tip;

  if (second && second.score >= best.score * 0.72) {
    const combined = best.score + second.score;

    observedTip = {
      x: (best.tip.x * best.score + second.tip.x * second.score) / combined,
      y: (best.tip.y * best.score + second.tip.y * second.score) / combined,
      z: ((best.tip.z ?? 0) * best.score + (second.tip.z ?? 0) * second.score) / combined
    };
  }

  return updateAdaptivePointer(drawState, observedTip, nowMs);
}

function releaseAdaptivePointerIfStale(drawState, nowMs) {
  if (!drawState.adaptivePointerNorm) {
    return;
  }

  if (nowMs - (drawState.adaptivePointerAt ?? 0) <= POINTER_MODEL_MEMORY_MS) {
    return;
  }

  drawState.adaptivePointerNorm = null;
  drawState.adaptivePointerVelocityNorm = { x: 0, y: 0, z: 0 };
  drawState.adaptivePointerAt = 0;
}

function estimateHandScale(landmarks) {
  const wrist = landmarks?.[0];
  const middleMcp = landmarks?.[9];
  const indexMcp = landmarks?.[5];
  const pinkyMcp = landmarks?.[17];

  const height = normalizedDistance(wrist, middleMcp);
  const width = normalizedDistance(indexMcp, pinkyMcp);

  if (!Number.isFinite(height) && !Number.isFinite(width)) {
    return 0.12;
  }

  const resolvedHeight = Number.isFinite(height) ? height : 0.12;
  const resolvedWidth = Number.isFinite(width) ? width : resolvedHeight;

  return Math.max(0.05, (resolvedHeight + resolvedWidth) * 0.5);
}

function isPinchLikeGesture(landmarks) {
  const thumbTip = landmarks?.[4];
  const indexTip = landmarks?.[8];

  if (!thumbTip || !indexTip) {
    return false;
  }

  const handSize = estimateHandScale(landmarks);
  const tipDistance = normalizedDistance(thumbTip, indexTip);

  return tipDistance <= handSize * 0.62;
}

function normalizedPlanarDistance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
}

function fingerSegmentRatio(landmarks, { tip, pip, mcp }) {
  const tipPoint = landmarks?.[tip];
  const pipPoint = landmarks?.[pip];
  const mcpPoint = landmarks?.[mcp];

  if (!tipPoint || !pipPoint || !mcpPoint) {
    return 0;
  }

  const tipToMcp = normalizedDistance(tipPoint, mcpPoint);
  const pipToMcp = normalizedDistance(pipPoint, mcpPoint);

  if (!Number.isFinite(tipToMcp) || !Number.isFinite(pipToMcp) || pipToMcp <= 0.0001) {
    return 0;
  }

  return tipToMcp / pipToMcp;
}

function isPointPoseStableForDraw(landmarks, handwritingAssist) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return false;
  }

  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const middleTip = landmarks[12];

  if (!wrist || !indexTip || !indexPip || !middleTip) {
    return false;
  }

  const scale = estimateHandScale(landmarks);
  const indexRatio = fingerSegmentRatio(landmarks, { tip: 8, pip: 6, mcp: 5 });
  const middleRatio = fingerSegmentRatio(landmarks, { tip: 12, pip: 10, mcp: 9 });
  const ringRatio = fingerSegmentRatio(landmarks, { tip: 16, pip: 14, mcp: 13 });
  const pinkyRatio = fingerSegmentRatio(landmarks, { tip: 20, pip: 18, mcp: 17 });

  const indexReachRatio =
    normalizedDistance(indexTip, wrist) / Math.max(normalizedDistance(indexPip, wrist), 0.0001);
  const fingerSpread = normalizedPlanarDistance(indexTip, middleTip);
  const depthLeadAllowed = indexTip.z <= indexPip.z + scale * 0.34;

  let score = 0;

  if (indexRatio >= 1.12) {
    score += 1;
  }

  if (indexReachRatio >= 1.03) {
    score += 1;
  }

  if (middleRatio <= 1.03) {
    score += 1;
  }

  if (ringRatio <= 1.03) {
    score += 1;
  }

  if (pinkyRatio <= 1.03) {
    score += 1;
  }

  if (fingerSpread >= scale * 0.16) {
    score += 1;
  }

  if (depthLeadAllowed) {
    score += 1;
  }

  const requiredScore = handwritingAssist ? 4 : 4;
  return score >= requiredScore;
}

function isVSignPoseStableForDraw(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return false;
  }

  const indexTip = landmarks[8];
  const middleTip = landmarks[12];

  if (!indexTip || !middleTip) {
    return false;
  }

  const scale = estimateHandScale(landmarks);
  const indexRatio = fingerSegmentRatio(landmarks, { tip: 8, pip: 6, mcp: 5 });
  const middleRatio = fingerSegmentRatio(landmarks, { tip: 12, pip: 10, mcp: 9 });
  const ringRatio = fingerSegmentRatio(landmarks, { tip: 16, pip: 14, mcp: 13 });
  const pinkyRatio = fingerSegmentRatio(landmarks, { tip: 20, pip: 18, mcp: 17 });
  const spread = normalizedPlanarDistance(indexTip, middleTip);

  return (
    indexRatio >= 1.13 &&
    middleRatio >= 1.13 &&
    ringRatio <= 1 &&
    pinkyRatio <= 1 &&
    spread >= scale * 0.23
  );
}

function isOpenHandPoseStableForErase(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return false;
  }

  const indexTip = landmarks[8];
  const pinkyTip = landmarks[20];

  if (!indexTip || !pinkyTip) {
    return false;
  }

  const scale = estimateHandScale(landmarks);
  const thumbRatio = fingerSegmentRatio(landmarks, { tip: 4, pip: 3, mcp: 2 });
  const indexRatio = fingerSegmentRatio(landmarks, { tip: 8, pip: 6, mcp: 5 });
  const middleRatio = fingerSegmentRatio(landmarks, { tip: 12, pip: 10, mcp: 9 });
  const ringRatio = fingerSegmentRatio(landmarks, { tip: 16, pip: 14, mcp: 13 });
  const pinkyRatio = fingerSegmentRatio(landmarks, { tip: 20, pip: 18, mcp: 17 });
  const spread = normalizedPlanarDistance(indexTip, pinkyTip);

  const extendedNonThumbCount = [indexRatio, middleRatio, ringRatio, pinkyRatio].filter(
    (ratio) => ratio >= 1.06
  ).length;

  return extendedNonThumbCount >= 2 && thumbRatio >= 0.92 && spread >= scale * 0.32;
}

function isGestureTriggered({ settings, gesture, primaryHand }) {
  const pointPoseReady = isPointPoseStableForDraw(primaryHand, settings.handwritingAssist);
  const vSignPoseReady = isVSignPoseStableForDraw(primaryHand);
  const openHandPoseReady = isOpenHandPoseStableForErase(primaryHand);

  // Open hand should reliably trigger erase flows.
  if (
    (settings.drawMode === 'erase' || settings.triggerGesture === 'OPEN_HAND') &&
    (gesture === 'OPEN_HAND' || openHandPoseReady)
  ) {
    return true;
  }

  if (settings.triggerGesture === 'AUTO') {
    if (settings.drawMode === 'erase') {
      return gesture === 'OPEN_HAND' || openHandPoseReady;
    }

    return gesture === 'PINCH' || pointPoseReady || (gesture === 'V_SIGN' && vSignPoseReady);
  }

  if (settings.triggerGesture === 'POINT') {
    return pointPoseReady;
  }

  if (settings.triggerGesture === 'V_SIGN') {
    return vSignPoseReady;
  }

  if (settings.triggerGesture === 'OPEN_HAND') {
    return gesture === 'OPEN_HAND' || openHandPoseReady;
  }

  if (gesture === settings.triggerGesture) {
    return true;
  }

  // Reliable fallback for real webcams where pinch labels can flicker.
  if (settings.triggerGesture === 'PINCH') {
    return isPinchLikeGesture(primaryHand);
  }

  return false;
}

function createStroke(settings, point, nowMs) {
  const color = settings.rainbowBrush
    ? hueToRgb((nowMs * 0.07 + point.x * 0.08 + point.y * 0.04) % 360)
    : parseHexColor(settings.brushColor);

  return {
    points: [point],
    createdAt: nowMs,
    lastUpdatedAt: nowMs,
    color,
    pattern: settings.brushPattern,
    style: settings.brushStyle,
    width: settings.brushSize,
    opacity: settings.brushOpacity,
    glow: settings.glowStrength,
    blendMode: resolveBlendMode(settings.blendMode)
  };
}

function finalizeActiveStroke(drawState, maxSavedStrokes) {
  const activeStroke = drawState.activeStroke;

  if (!activeStroke) {
    return false;
  }

  if (activeStroke.points.length > 1) {
    drawState.strokes.push(activeStroke);

    if (drawState.strokes.length > maxSavedStrokes) {
      drawState.strokes.shift();
    }
  }

  drawState.activeStroke = null;
  return true;
}

function resetDrawStartLock(drawState) {
  drawState.startTriggerFrames = 0;
  drawState.startTriggerGesture = 'NO_HANDS';
}

function updateDrawStartLock(drawState, gestureKey, isTriggered) {
  if (!isTriggered) {
    resetDrawStartLock(drawState);
    return 0;
  }

  if (drawState.startTriggerGesture === gestureKey) {
    drawState.startTriggerFrames += 1;
    return drawState.startTriggerFrames;
  }

  drawState.startTriggerGesture = gestureKey;
  drawState.startTriggerFrames = 1;
  return drawState.startTriggerFrames;
}

function appendStrokePoint(drawState, point, settings, nowMs) {
  if (!drawState.activeStroke) {
    drawState.activeStroke = createStroke(settings, point, nowMs);
    drawState.redoStack = [];
    return true;
  }

  const previousPoint = drawState.activeStroke.points[drawState.activeStroke.points.length - 1];
  const elapsedMs = Math.max(1, nowMs - drawState.activeStroke.lastUpdatedAt);
  const rawDistance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
  const speedPxPerMs = rawDistance / elapsedMs;
  const speedThreshold = settings.handwritingAssist
    ? FAST_MOTION_SPEED_THRESHOLD.handwriting
    : FAST_MOTION_SPEED_THRESHOLD.standard;
  const fastMotionFactor = clamp((speedPxPerMs - speedThreshold) / 2.4, 0, 1);
  const effectiveSmoothness = settings.handwritingAssist
    ? clamp(settings.smoothness * 0.72, 0, 0.95)
    : settings.smoothness;
  const smoothingFactorBase = clamp(1 - effectiveSmoothness * 0.85, 0.15, 1);
  const smoothingFactor = clamp(smoothingFactorBase + fastMotionFactor * 0.42, 0.15, 1);
  const nextPoint = {
    x: previousPoint.x + (point.x - previousPoint.x) * smoothingFactor,
    y: previousPoint.y + (point.y - previousPoint.y) * smoothingFactor
  };

  const distance = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
  const baseMinDistancePx = clamp(settings.brushSize * 0.42, 1.2, 6);
  const minDistancePxBase = settings.handwritingAssist
    ? clamp(baseMinDistancePx * 0.45, 0.45, 4.5)
    : baseMinDistancePx;
  const minDistancePx = clamp(minDistancePxBase * (1 - fastMotionFactor * 0.7), 0.32, 4.5);

  if (distance < minDistancePx) {
    drawState.activeStroke.lastUpdatedAt = nowMs;
    return false;
  }

  const maxSegmentLength = settings.handwritingAssist
    ? clamp(settings.brushSize * 1.4, 3.2, 9)
    : clamp(settings.brushSize * 2.1, 5.5, 16);
  const bridgeSegments = clamp(Math.ceil(distance / maxSegmentLength), 1, 9);

  if (bridgeSegments > 1) {
    for (let index = 1; index < bridgeSegments; index += 1) {
      const t = index / bridgeSegments;
      drawState.activeStroke.points.push({
        x: previousPoint.x + (nextPoint.x - previousPoint.x) * t,
        y: previousPoint.y + (nextPoint.y - previousPoint.y) * t
      });
    }
  }

  drawState.activeStroke.points.push(nextPoint);
  drawState.activeStroke.lastUpdatedAt = nowMs;

  const maxLivePoints = settings.handwritingAssist ? 900 : 480;

  while (drawState.activeStroke.points.length > maxLivePoints) {
    drawState.activeStroke.points.shift();
  }

  return true;
}

function distanceToStroke(point, stroke) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let minDistance = Number.POSITIVE_INFINITY;

  stroke.points.forEach((entry) => {
    const distance = Math.hypot(entry.x - point.x, entry.y - point.y);

    if (distance < minDistance) {
      minDistance = distance;
    }
  });

  return minDistance;
}

function eraseNearestStroke(drawState, point, radiusPx) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  drawState.strokes.forEach((stroke, index) => {
    const distance = distanceToStroke(point, stroke);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestIndex < 0 || bestDistance > radiusPx) {
    return false;
  }

  const [removedStroke] = drawState.strokes.splice(bestIndex, 1);

  if (removedStroke) {
    drawState.redoStack.push(removedStroke);

    if (drawState.redoStack.length > 90) {
      drawState.redoStack.shift();
    }

    return true;
  }

  return false;
}

function pruneDrawing(drawState, settings, nowMs, idleTimeoutMs) {
  if (settings.autoFade) {
    drawState.strokes = drawState.strokes.filter(
      (stroke) => nowMs - stroke.lastUpdatedAt <= settings.strokeLifetimeMs
    );
  }

  if (drawState.activeStroke && nowMs - drawState.activeStroke.lastUpdatedAt > idleTimeoutMs) {
    finalizeActiveStroke(drawState, settings.maxSavedStrokes);
  }
}

function stampSprayBrush(context, stroke, strokeOpacity) {
  const points = stroke.points;

  if (!Array.isArray(points) || points.length < 2) {
    return;
  }

  const sprayRadius = stroke.width * 1.35;
  const burstCount = clamp(Math.round(stroke.width * 0.7), 3, 16);
  context.fillStyle = rgba(stroke.color, strokeOpacity * 0.12);

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const spraySteps = clamp(Math.round(distance / Math.max(2, stroke.width * 0.65)), 1, 30);

    for (let step = 0; step <= spraySteps; step += 1) {
      const t = spraySteps === 0 ? 0 : step / spraySteps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;

      for (let burst = 0; burst < burstCount; burst += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * sprayRadius;
        const dotX = x + Math.cos(angle) * radius;
        const dotY = y + Math.sin(angle) * radius;
        const dotSize = Math.max(0.5, stroke.width * randomRange(0.05, 0.16));

        context.beginPath();
        context.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
}

function stampWatercolorBleed(context, stroke, strokeOpacity) {
  const points = stroke.points;

  if (!Array.isArray(points) || points.length < 1) {
    return;
  }

  for (let index = 0; index < points.length; index += 2) {
    const point = points[index];
    const bloomRadius = stroke.width * randomRange(0.62, 1.36);
    const bloom = context.createRadialGradient(
      point.x,
      point.y,
      bloomRadius * 0.12,
      point.x,
      point.y,
      bloomRadius
    );

    bloom.addColorStop(0, rgba(stroke.color, strokeOpacity * 0.16));
    bloom.addColorStop(1, rgba(stroke.color, 0));
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(point.x, point.y, bloomRadius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawAirStroke(context, stroke, alphaFactor) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) {
    return;
  }

  const strokeOpacity = stroke.opacity * alphaFactor;
  const brushStyle = stroke.style ?? 'neon';
  let lineWidth = stroke.width;
  let lineCap = 'round';
  let lineJoin = 'round';
  let shadowBlur = stroke.glow;
  let compositeMode = stroke.blendMode;
  let highlightOpacity = 0.48 * alphaFactor;

  if (brushStyle === 'ink') {
    shadowBlur = 0;
    compositeMode = 'source-over';
    highlightOpacity = 0.22 * alphaFactor;
  } else if (brushStyle === 'marker') {
    lineWidth = stroke.width * 1.24;
    lineCap = 'square';
    lineJoin = 'bevel';
    shadowBlur = Math.max(1, stroke.glow * 0.22);
    compositeMode = 'source-over';
    highlightOpacity = 0.16 * alphaFactor;
  } else if (brushStyle === 'spray') {
    lineWidth = Math.max(1, stroke.width * 0.58);
    shadowBlur = Math.max(2, stroke.glow * 0.36);
    highlightOpacity = 0.12 * alphaFactor;
  } else if (brushStyle === 'calligraphy') {
    lineWidth = stroke.width * 1.08;
    lineCap = 'butt';
    lineJoin = 'miter';
    shadowBlur = Math.max(2, stroke.glow * 0.35);
    highlightOpacity = 0.24 * alphaFactor;
  } else if (brushStyle === 'watercolor') {
    lineWidth = stroke.width * 1.42;
    lineCap = 'round';
    lineJoin = 'round';
    shadowBlur = Math.max(8, stroke.glow * 0.9);
    compositeMode = 'source-over';
    highlightOpacity = 0.08 * alphaFactor;
  }

  context.save();
  context.globalCompositeOperation = compositeMode;
  context.lineCap = lineCap;
  context.lineJoin = lineJoin;
  context.shadowColor = rgba(stroke.color, strokeOpacity);
  context.shadowBlur = shadowBlur;
  context.strokeStyle = rgba(stroke.color, strokeOpacity);
  context.lineWidth = lineWidth;

  if (stroke.pattern === 'dashed') {
    context.setLineDash([lineWidth * 2.5, lineWidth * 1.8]);
  } else if (stroke.pattern === 'dotted') {
    context.setLineDash([1, lineWidth * 1.7]);
  } else {
    context.setLineDash([]);
  }

  if (brushStyle === 'watercolor') {
    stampWatercolorBleed(context, stroke, strokeOpacity);
  }

  createPathFromPoints(context, stroke.points);
  context.stroke();

  if (brushStyle === 'spray') {
    stampSprayBrush(context, stroke, strokeOpacity);
  }

  if (brushStyle === 'calligraphy') {
    context.shadowBlur = Math.max(1, shadowBlur * 0.4);
    context.strokeStyle = rgba(stroke.color, strokeOpacity * 0.58);
    context.lineWidth = Math.max(1, lineWidth * 0.58);

    context.beginPath();
    const firstPoint = stroke.points[0];
    context.moveTo(firstPoint.x + lineWidth * 0.22, firstPoint.y - lineWidth * 0.12);
    for (let index = 1; index < stroke.points.length; index += 1) {
      const entry = stroke.points[index];
      context.lineTo(entry.x + lineWidth * 0.22, entry.y - lineWidth * 0.12);
    }
    context.stroke();
  }

  context.shadowBlur = 0;
  context.setLineDash([]);
  context.strokeStyle = `rgba(245, 252, 255, ${highlightOpacity})`;
  context.lineWidth = Math.max(1.1, lineWidth * 0.32);
  createPathFromPoints(context, stroke.points);
  context.stroke();

  context.restore();
}

function drawStrokeWithVariants(context, stroke, alphaFactor, settings, width, height) {
  const variants = buildStrokeVariants(stroke.points, width, height, settings);

  variants.forEach((variantPoints) => {
    drawAirStroke(
      context,
      {
        ...stroke,
        points: variantPoints
      },
      alphaFactor
    );
  });
}

function drawAirDrawing(context, drawState, settings, nowMs, idleTimeoutMs) {
  pruneDrawing(drawState, settings, nowMs, idleTimeoutMs);
  const width = context.canvas.width;
  const height = context.canvas.height;

  drawState.strokes.forEach((stroke) => {
    const age = nowMs - stroke.lastUpdatedAt;
    const alphaFactor = settings.autoFade
      ? clamp(1 - age / settings.strokeLifetimeMs, 0, 1)
      : 1;

    if (alphaFactor <= 0) {
      return;
    }

    drawStrokeWithVariants(context, stroke, alphaFactor, settings, width, height);
  });

  if (drawState.activeStroke) {
    drawStrokeWithVariants(context, drawState.activeStroke, 1, settings, width, height);

    if (settings.showCursor) {
      const head = drawState.activeStroke.points[drawState.activeStroke.points.length - 1];

      if (head) {
        const cursorVariants = buildStrokeVariants([head], width, height, settings);

        cursorVariants.forEach((variant) => {
          const entry = variant[0];

          if (!entry) {
            return;
          }

          context.save();
          context.globalCompositeOperation = 'screen';

          const cursorGradient = context.createRadialGradient(
            entry.x,
            entry.y,
            2,
            entry.x,
            entry.y,
            16
          );
          cursorGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          cursorGradient.addColorStop(1, 'rgba(116, 214, 255, 0)');

          context.fillStyle = cursorGradient;
          context.beginPath();
          context.arc(entry.x, entry.y, 16, 0, Math.PI * 2);
          context.fill();
          context.restore();
        });
      }
    }
  }
}

function updateDrawStatsState(setDrawStats, drawState, settings, overrides = {}) {
  const templateType = settings.templateEnabled ? settings.templateType : 'off';
  const mirrorMode = resolveMirrorLabel(settings);

  setDrawStats((previous) => {
    const next = {
      ...previous,
      strokeCount: drawState.strokes.length + (drawState.activeStroke ? 1 : 0),
      savedStrokeCount: drawState.strokes.length,
      redoCount: drawState.redoStack.length,
      drawEnabled: settings.drawEnabled,
      activeTool: settings.drawMode,
      triggerGesture: settings.triggerGesture,
      canUndo: drawState.strokes.length > 0 || Boolean(drawState.activeStroke),
      canRedo: drawState.redoStack.length > 0,
      templateType,
      mirrorMode,
      particleMode: settings.particleMode,
      particleCount: drawState.particles.length,
      ...overrides
    };

    const unchanged =
      previous.strokeCount === next.strokeCount &&
      previous.savedStrokeCount === next.savedStrokeCount &&
      previous.redoCount === next.redoCount &&
      previous.isGestureDrawing === next.isGestureDrawing &&
      previous.detectedGesture === next.detectedGesture &&
      previous.drawEnabled === next.drawEnabled &&
      previous.activeTool === next.activeTool &&
      previous.triggerGesture === next.triggerGesture &&
      previous.canUndo === next.canUndo &&
      previous.canRedo === next.canRedo &&
      previous.templateType === next.templateType &&
      previous.mirrorMode === next.mirrorMode &&
      previous.particleMode === next.particleMode &&
      previous.particleCount === next.particleCount &&
      previous.lastAction === next.lastAction;

    return unchanged ? previous : next;
  });
}

function resolveStableGesture({
  handCount,
  rawGesture,
  gestureHistoryRef,
  stableGestureRef,
  reliableGestureRef,
  now
}) {
  if (handCount === 0) {
    gestureHistoryRef.current = [];
    stableGestureRef.current = 'NO_HANDS';
    reliableGestureRef.current = {
      gesture: 'NO_HANDS',
      at: now
    };
    return 'NO_HANDS';
  }

  if (handCount >= 2) {
    gestureHistoryRef.current = ['TWO_HANDS'];
    stableGestureRef.current = 'TWO_HANDS';
    reliableGestureRef.current = {
      gesture: 'TWO_HANDS',
      at: now
    };
    return 'TWO_HANDS';
  }

  const nextHistory = [...gestureHistoryRef.current, rawGesture].slice(-7);
  gestureHistoryRef.current = nextHistory;

  const counts = nextHistory.reduce((accumulator, gesture) => {
    accumulator[gesture] = (accumulator[gesture] ?? 0) + 1;
    return accumulator;
  }, {});

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topGesture = 'UNKNOWN', topCount = 0] = ranked[0] ?? [];
  const stableCandidate = topCount / nextHistory.length >= 0.57 ? topGesture : null;

  if (rawGesture !== 'UNKNOWN') {
    reliableGestureRef.current = {
      gesture: rawGesture,
      at: now
    };
  }

  let resolvedGesture = rawGesture;

  if (rawGesture === 'UNKNOWN') {
    if (stableCandidate && stableCandidate !== 'UNKNOWN') {
      resolvedGesture = stableCandidate;
    } else if (now - reliableGestureRef.current.at <= UNKNOWN_GESTURE_HOLD_MS) {
      resolvedGesture = reliableGestureRef.current.gesture;
    }
  }

  if (stableCandidate && stableCandidate !== 'UNKNOWN' && resolvedGesture !== 'PINCH') {
    resolvedGesture = stableCandidate;
  }

  stableGestureRef.current = resolvedGesture;
  return resolvedGesture;
}

export function useHandTracking({
  videoRef,
  canvasRef,
  enabled,
  onResults,
  drawSettings = DEFAULT_DRAW_SETTINGS
}) {
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drawStats, setDrawStats] = useState(DEFAULT_DRAW_STATS);

  const handsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const processingRef = useRef(false);
  const activeRef = useRef(false);
  const onResultsRef = useRef(onResults);
  const drawSettingsRef = useRef(normalizeDrawSettings(drawSettings));
  const lastActionRef = useRef(DEFAULT_DRAW_STATS.lastAction);
  const gestureHistoryRef = useRef([]);
  const stableGestureRef = useRef('NO_HANDS');
  const reliableGestureRef = useRef({
    gesture: 'NO_HANDS',
    at: 0
  });
  const noHandsFrameRef = useRef(0);
  const usingRecoveryOptionsRef = useRef(false);
  const lastOptionsSwapAtRef = useRef(0);
  const lastHandsSendAtRef = useRef(0);
  const drawStateRef = useRef({
    strokes: [],
    activeStroke: null,
    redoStack: [],
    particles: [],
    lastEraseAt: 0,
    lastParticleAt: 0,
    lastGestureDrawAt: 0,
    startTriggerFrames: 0,
    startTriggerGesture: 'NO_HANDS',
    adaptivePointerNorm: null,
    adaptivePointerVelocityNorm: { x: 0, y: 0, z: 0 },
    adaptivePointerAt: 0
  });

  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    drawSettingsRef.current = normalizeDrawSettings(drawSettings);
    lastActionRef.current = 'Drawing settings updated';

    updateDrawStatsState(setDrawStats, drawStateRef.current, drawSettingsRef.current, {
      lastAction: 'Drawing settings updated'
    });
  }, [drawSettings]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawStateRef.current = {
      strokes: [],
      activeStroke: null,
      redoStack: [],
      particles: [],
      lastEraseAt: 0,
      lastParticleAt: 0,
      lastGestureDrawAt: 0,
      startTriggerFrames: 0,
      startTriggerGesture: 'NO_HANDS',
      adaptivePointerNorm: null,
      adaptivePointerVelocityNorm: { x: 0, y: 0, z: 0 },
      adaptivePointerAt: 0
    };

    gestureHistoryRef.current = [];
    stableGestureRef.current = 'NO_HANDS';
    reliableGestureRef.current = {
      gesture: 'NO_HANDS',
      at: performance.now()
    };
    noHandsFrameRef.current = 0;
    usingRecoveryOptionsRef.current = false;
    lastOptionsSwapAtRef.current = performance.now();
    lastActionRef.current = 'Drawing cleared';

    updateDrawStatsState(setDrawStats, drawStateRef.current, drawSettingsRef.current, {
      isGestureDrawing: false,
      detectedGesture: 'NO_HANDS',
      lastAction: 'Drawing cleared'
    });
  }, [canvasRef]);

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return false;
    }

    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
    }

    if (canvas.height !== video.videoHeight) {
      canvas.height = video.videoHeight;
    }

    return true;
  }, [canvasRef, videoRef]);

  const updateDrawingFromGesture = useCallback((multiHandLandmarks, gesture, nowMs) => {
    const settings = drawSettingsRef.current;
    const drawState = drawStateRef.current;

    if (!settings.drawEnabled) {
      finalizeActiveStroke(drawState, settings.maxSavedStrokes);
      return {
        isGestureDrawing: false,
        lastAction: null
      };
    }

    const primaryHand = choosePrimaryHandAdaptive(multiHandLandmarks, drawState, nowMs);
    const adaptiveTip = resolveAdaptiveDrawTip(multiHandLandmarks, drawState, nowMs);
    const primaryTip = adaptiveTip ?? getIndexTip(primaryHand);
    const primaryPalm = getPalmCenter(primaryHand);
    const allowOpenHandPoseFallback =
      settings.drawMode === 'erase' || settings.triggerGesture === 'OPEN_HAND';
    const openHandDetected =
      gesture === 'OPEN_HAND' ||
      (allowOpenHandPoseFallback && isOpenHandPoseStableForErase(primaryHand));
    const openHandEraseGesture =
      openHandDetected &&
      (settings.drawMode === 'erase' ||
        settings.triggerGesture === 'OPEN_HAND' ||
        (settings.triggerGesture === 'AUTO' && gesture === 'OPEN_HAND'));
    const shouldErase = settings.drawMode === 'erase' || openHandEraseGesture;
    const gestureMatches = isGestureTriggered({
      settings,
      gesture,
      primaryHand
    });
    const triggerKey = settings.triggerGesture === 'AUTO' ? gesture : settings.triggerGesture;
    const requiredStartFrames = settings.handwritingAssist
      ? DRAW_START_CONFIRM_FRAMES.handwriting
      : DRAW_START_CONFIRM_FRAMES.standard;
    let effectiveGestureMatch = gestureMatches;

    if (!shouldErase && !drawState.activeStroke) {
      const stableFrames = updateDrawStartLock(drawState, triggerKey, gestureMatches);
      effectiveGestureMatch = gestureMatches && stableFrames >= requiredStartFrames;
    } else if (!gestureMatches) {
      resetDrawStartLock(drawState);
    }

    if (openHandEraseGesture) {
      effectiveGestureMatch = true;
    }

    const triggerGraceMs = settings.handwritingAssist
      ? DRAW_TRIGGER_GRACE_MS.handwriting
      : DRAW_TRIGGER_GRACE_MS.standard;
    const hasRecentTrigger =
      Boolean(drawState.activeStroke) && nowMs - drawState.lastGestureDrawAt <= triggerGraceMs;

    const pointerSource =
      shouldErase
        ? openHandEraseGesture
          ? primaryPalm ?? primaryTip
          : primaryTip ?? primaryPalm
        : primaryTip;

    if (!pointerSource) {
      releaseAdaptivePointerIfStale(drawState, nowMs);
      resetDrawStartLock(drawState);

      if (!shouldErase && hasRecentTrigger) {
        return {
          isGestureDrawing: true,
          lastAction: null,
          activeTool: 'draw'
        };
      }

      const finalized = finalizeActiveStroke(drawState, settings.maxSavedStrokes);

      return {
        isGestureDrawing: false,
        lastAction: finalized ? 'Stroke completed' : null,
        activeTool: shouldErase ? 'erase' : 'draw'
      };
    }

    const allowGraceDraw = !shouldErase && settings.handwritingAssist && hasRecentTrigger;

    if (!effectiveGestureMatch && !allowGraceDraw) {
      const finalized = finalizeActiveStroke(drawState, settings.maxSavedStrokes);

      return {
        isGestureDrawing: false,
        lastAction: finalized ? 'Stroke completed' : null,
        activeTool: shouldErase ? 'erase' : 'draw'
      };
    }

    if (effectiveGestureMatch && !shouldErase) {
      drawState.lastGestureDrawAt = nowMs;
    }

    const point = toCanvasPoint(pointerSource, canvasRef.current);

    if (shouldErase) {
      finalizeActiveStroke(drawState, settings.maxSavedStrokes);

      if (nowMs - drawState.lastEraseAt < 95) {
        return {
          isGestureDrawing: true,
          lastAction: null,
          activeTool: 'erase'
        };
      }

      drawState.lastEraseAt = nowMs;
      const eraseRadius = openHandEraseGesture
        ? Math.max(40, settings.brushSize * 6.8)
        : Math.max(14, settings.brushSize * 3.1);
      const removed = eraseNearestStroke(drawState, point, eraseRadius);

      return {
        isGestureDrawing: true,
        lastAction: removed ? 'Stroke erased' : null,
        activeTool: 'erase'
      };
    }

    const strokeStarted = !drawState.activeStroke;
    const added = appendStrokePoint(drawState, point, settings, nowMs);

    if (strokeStarted) {
      resetDrawStartLock(drawState);
    }

    const canEmitParticles = settings.particleMode !== 'none';
    const particleInterval = resolveParticleIntervalMs(settings);
    const dueForContinuousEmit = nowMs - drawState.lastParticleAt >= particleInterval;

    if (canEmitParticles && (strokeStarted || added || dueForContinuousEmit)) {
      const canvas = canvasRef.current;

      if (canvas) {
        spawnParticles(drawState, settings, point, nowMs, canvas.width, canvas.height);
        drawState.lastParticleAt = nowMs;
      }
    }

    return {
      isGestureDrawing: true,
      lastAction: strokeStarted
        ? 'Stroke started'
        : added
          ? 'Stroke drawing'
          : null,
      activeTool: 'draw'
    };
  }, [canvasRef]);

  const drawTrackingOverlay = useCallback(
    (multiHandLandmarks, gesture) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d');

      if (!context || !syncCanvasSize()) {
        return;
      }

      const settings = drawSettingsRef.current;
      const drawState = drawStateRef.current;
      const idleTimeoutMs = settings.handwritingAssist
        ? ACTIVE_STROKE_IDLE_TIMEOUT_MS.handwriting
        : ACTIVE_STROKE_IDLE_TIMEOUT_MS.standard;

      context.save();
      context.clearRect(0, 0, canvas.width, canvas.height);

      const nowMs = performance.now();
      const drawFrame = updateDrawingFromGesture(multiHandLandmarks, gesture, nowMs);
      drawPracticeTemplate(context, canvas, settings, nowMs);
      drawAirDrawing(context, drawState, settings, nowMs, idleTimeoutMs);
      drawParticleLayer(context, drawState, settings, nowMs);

      if (settings.showFusionLink && gesture === 'TWO_HANDS') {
        drawFusionLink(context, canvas, multiHandLandmarks, nowMs);
      }

      if (settings.showAura) {
        multiHandLandmarks.forEach((landmarks) => {
          drawEnergyAura(context, canvas, landmarks, gesture, nowMs);
        });
      }

      if (
        settings.showLandmarks &&
        typeof drawConnectorsRef === 'function' &&
        typeof drawLandmarksRef === 'function'
      ) {
        multiHandLandmarks.forEach((landmarks) => {
          drawConnectorsRef(context, landmarks, handConnectionsRef, {
            color: '#f97316',
            lineWidth: 4
          });

          drawLandmarksRef(context, landmarks, {
            color: '#0f766e',
            fillColor: '#5eead4',
            lineWidth: 2,
            radius: 4
          });
        });
      }

      context.restore();

      const resolvedLastAction = drawFrame.lastAction ?? lastActionRef.current;

      if (drawFrame.lastAction) {
        lastActionRef.current = drawFrame.lastAction;
      }

      updateDrawStatsState(setDrawStats, drawState, settings, {
        isGestureDrawing: drawFrame.isGestureDrawing,
        lastAction: resolvedLastAction,
        activeTool: drawFrame.activeTool ?? settings.drawMode
      });
    },
    [canvasRef, syncCanvasSize, updateDrawingFromGesture]
  );

  const handleMediaPipeResults = useCallback(
    (results) => {
      const rawHands = results?.multiHandLandmarks ?? [];
      const handLandmarks = rawHands.map((hand) =>
        hand.map((point) => ({
          x: Number(point.x.toFixed(6)),
          y: Number(point.y.toFixed(6)),
          z: Number(point.z.toFixed(6))
        }))
      );

      const now = performance.now();

      if (handLandmarks.length === 0) {
        noHandsFrameRef.current += 1;

        const canSwapOptions = now - lastOptionsSwapAtRef.current > OPTIONS_SWAP_COOLDOWN_MS;

        if (
          !usingRecoveryOptionsRef.current &&
          canSwapOptions &&
          noHandsFrameRef.current >= NO_HANDS_FRAMES_FOR_RECOVERY
        ) {
          handsRef.current?.setOptions(HANDS_RECOVERY_OPTIONS);
          usingRecoveryOptionsRef.current = true;
          lastOptionsSwapAtRef.current = now;
          lastActionRef.current = 'Recovery mode enabled for hand detection';
        }
      } else {
        noHandsFrameRef.current = 0;

        const canSwapOptions = now - lastOptionsSwapAtRef.current > OPTIONS_SWAP_COOLDOWN_MS;

        if (usingRecoveryOptionsRef.current && canSwapOptions) {
          handsRef.current?.setOptions(HANDS_DEFAULT_OPTIONS);
          usingRecoveryOptionsRef.current = false;
          lastOptionsSwapAtRef.current = now;
          lastActionRef.current = 'Hand detected, normal mode restored';
        }
      }

      const rawDetectedGesture = detectGesture(handLandmarks);
      const stabilizedGesture = resolveStableGesture({
        handCount: handLandmarks.length,
        rawGesture: rawDetectedGesture,
        gestureHistoryRef,
        stableGestureRef,
        reliableGestureRef,
        now
      });

      drawTrackingOverlay(rawHands, stabilizedGesture);

      const payload = {
        handLandmarks,
        handsCount: handLandmarks.length,
        gesture: stabilizedGesture
      };

      updateDrawStatsState(setDrawStats, drawStateRef.current, drawSettingsRef.current, {
        detectedGesture: stabilizedGesture,
        lastAction: lastActionRef.current
      });

      if (onResultsRef.current) {
        onResultsRef.current(payload);
      }
    },
    [drawTrackingOverlay]
  );

  const processFrame = useCallback(async () => {
    if (!activeRef.current) {
      return;
    }

    const video = videoRef.current;
    const hands = handsRef.current;

    if (
      video &&
      hands &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      !processingRef.current
    ) {
      const now = performance.now();
      const sendIntervalMs = drawSettingsRef.current.handwritingAssist
        ? HANDS_SEND_INTERVAL_MS.handwriting
        : HANDS_SEND_INTERVAL_MS.standard;

      if (now - lastHandsSendAtRef.current < sendIntervalMs) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      lastHandsSendAtRef.current = now;
      processingRef.current = true;

      try {
        await hands.send({ image: video });
      } catch (trackingError) {
        setError(`Hand tracking runtime error: ${trackingError?.message ?? 'Unknown error'}`);
      } finally {
        processingRef.current = false;
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  const stopTracking = useCallback(async () => {
    activeRef.current = false;
    setIsTracking(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (handsRef.current) {
      try {
        await handsRef.current.close();
      } catch (closeError) {
        setError(`Could not close MediaPipe cleanly: ${closeError?.message ?? 'Unknown error'}`);
      }

      handsRef.current = null;
    }

    clearCanvas();

    if (onResultsRef.current) {
      onResultsRef.current(EMPTY_RESULT);
    }
  }, [clearCanvas]);

  const startTracking = useCallback(async () => {
    if (!enabled || !videoRef.current || handsRef.current || activeRef.current) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await ensureMediaPipeRuntime();

      if (typeof HandsConstructorRef !== 'function') {
        throw new Error('MediaPipe Hands constructor is unavailable.');
      }

      const hands = new HandsConstructorRef({
        locateFile: (file) => `${HANDS_CDN_BASE_URL}/${file}`
      });

      hands.setOptions(HANDS_DEFAULT_OPTIONS);

      hands.onResults(handleMediaPipeResults);

      handsRef.current = hands;
      noHandsFrameRef.current = 0;
      usingRecoveryOptionsRef.current = false;
      lastOptionsSwapAtRef.current = performance.now();
      lastHandsSendAtRef.current = 0;
      activeRef.current = true;
      setIsTracking(true);

      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (initError) {
      setError(`MediaPipe failed to initialize: ${initError?.message ?? 'Unknown error'}`);
      await stopTracking();
    } finally {
      setIsLoading(false);
    }
  }, [enabled, handleMediaPipeResults, processFrame, stopTracking, videoRef]);

  useEffect(() => {
    if (enabled) {
      void startTracking();
    } else {
      void stopTracking();
    }

    return () => {
      void stopTracking();
    };
  }, [enabled, startTracking, stopTracking]);

  const clearDrawing = useCallback(() => {
    drawStateRef.current = {
      strokes: [],
      activeStroke: null,
      redoStack: [],
      particles: [],
      lastEraseAt: 0,
      lastParticleAt: 0,
      lastGestureDrawAt: 0,
      startTriggerFrames: 0,
      startTriggerGesture: 'NO_HANDS',
      adaptivePointerNorm: null,
      adaptivePointerVelocityNorm: { x: 0, y: 0, z: 0 },
      adaptivePointerAt: 0
    };

    lastActionRef.current = 'Drawing cleared';

    updateDrawStatsState(setDrawStats, drawStateRef.current, drawSettingsRef.current, {
      isGestureDrawing: false,
      lastAction: 'Drawing cleared'
    });
  }, []);

  const undoStroke = useCallback(() => {
    const settings = drawSettingsRef.current;
    const drawState = drawStateRef.current;

    finalizeActiveStroke(drawState, settings.maxSavedStrokes);

    const removed = drawState.strokes.pop();

    if (removed) {
      drawState.redoStack.push(removed);
    }

    lastActionRef.current = removed ? 'Undo complete' : 'Nothing to undo';

    updateDrawStatsState(setDrawStats, drawState, settings, {
      isGestureDrawing: false,
      lastAction: removed ? 'Undo complete' : 'Nothing to undo'
    });
  }, []);

  const redoStroke = useCallback(() => {
    const settings = drawSettingsRef.current;
    const drawState = drawStateRef.current;
    const restored = drawState.redoStack.pop();

    if (restored) {
      drawState.strokes.push(restored);

      if (drawState.strokes.length > settings.maxSavedStrokes) {
        drawState.strokes.shift();
      }
    }

    lastActionRef.current = restored ? 'Redo complete' : 'Nothing to redo';

    updateDrawStatsState(setDrawStats, drawState, settings, {
      isGestureDrawing: false,
      lastAction: restored ? 'Redo complete' : 'Nothing to redo'
    });
  }, []);

  const exportDrawingImage = useCallback(() => {
    const overlayCanvas = canvasRef.current;

    if (!overlayCanvas) {
      return {
        ok: false,
        message: 'Overlay canvas is unavailable.'
      };
    }

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = overlayCanvas.width;
      exportCanvas.height = overlayCanvas.height;

      const context = exportCanvas.getContext('2d');

      if (!context) {
        return {
          ok: false,
          message: 'Export failed: 2D context unavailable.'
        };
      }

      const video = videoRef.current;

      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        context.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
      }

      context.drawImage(overlayCanvas, 0, 0);

      const downloadLink = document.createElement('a');
      downloadLink.href = exportCanvas.toDataURL('image/png');
      downloadLink.download = `neuroflux-drawing-${Date.now()}.png`;
      downloadLink.click();

      lastActionRef.current = 'Drawing exported';

      updateDrawStatsState(setDrawStats, drawStateRef.current, drawSettingsRef.current, {
        lastAction: 'Drawing exported'
      });

      return {
        ok: true,
        message: 'Drawing exported as PNG.'
      };
    } catch (exportError) {
      return {
        ok: false,
        message: `Export failed: ${exportError?.message ?? 'Unknown error'}`
      };
    }
  }, [canvasRef, videoRef]);

  return {
    isTracking,
    isLoading,
    error,
    startTracking,
    stopTracking,
    drawStats,
    clearDrawing,
    undoStroke,
    redoStroke,
    exportDrawingImage
  };
}

export { DEFAULT_DRAW_SETTINGS };
