import { useCallback, useEffect, useRef, useState } from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS, Hands } from '@mediapipe/hands';
import { detectGesture } from '../utils/gestureUtils';

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
  brushColor: '#74d6ff',
  brushPattern: 'solid',
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
  autoFade: true,
  strokeLifetimeMs: 18000,
  maxSavedStrokes: 36,
  templateEnabled: false,
  templateType: 'star',
  templateOpacity: 0.42,
  templateScale: 1,
  templateOffsetX: 0,
  templateOffsetY: 0,
  templateColor: '#ffffff',
  showAura: true,
  showLandmarks: true,
  showFusionLink: true,
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
const PRACTICE_TEMPLATES = ['star', 'circle', 'heart', 'flower', 'house', 'letter-a'];
const TRIGGER_GESTURES = ['AUTO', 'PINCH', 'POINT', 'V_SIGN', 'OPEN_HAND', 'FIST'];
const PARTICLE_MODES = ['none', 'spark', 'magic', 'ember', 'smoke'];

const HANDS_DEFAULT_OPTIONS = {
  modelComplexity: 1,
  maxNumHands: 2,
  minDetectionConfidence: 0.48,
  minTrackingConfidence: 0.42
};

const HANDS_RECOVERY_OPTIONS = {
  modelComplexity: 0,
  maxNumHands: 2,
  minDetectionConfidence: 0.3,
  minTrackingConfidence: 0.3
};

const NO_HANDS_FRAMES_FOR_RECOVERY = 24;
const OPTIONS_SWAP_COOLDOWN_MS = 900;

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
  context.setLineDash([10, 8]);

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
  return Math.round(clamp(70 - density * 5, 18, 72));
}

function spawnParticles(drawState, settings, point, nowMs, canvasWidth, canvasHeight) {
  if (settings.particleMode === 'none') {
    return;
  }

  const origins = buildStrokeVariants([point], canvasWidth, canvasHeight, settings)
    .map((variant) => variant[0])
    .filter(Boolean);

  const baseColor = settings.rainbowBrush ? hueToRgb((nowMs * 0.07) % 360) : parseHexColor(settings.brushColor);
  const emitCount = Math.max(1, Math.round(settings.particleDensity));

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

  if (drawState.particles.length > 2400) {
    drawState.particles.splice(0, drawState.particles.length - 2400);
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
    brushColor: typeof merged.brushColor === 'string' ? merged.brushColor : '#74d6ff',
    brushPattern: BRUSH_PATTERNS.includes(merged.brushPattern) ? merged.brushPattern : 'solid',
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

  HAND_CONNECTIONS.forEach(([start, end]) => {
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

function isGestureTriggered({ settings, gesture, primaryHand }) {
  if (settings.triggerGesture === 'AUTO') {
    return gesture === 'PINCH' || gesture === 'POINT' || gesture === 'V_SIGN';
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

function appendStrokePoint(drawState, point, settings, nowMs) {
  if (!drawState.activeStroke) {
    drawState.activeStroke = createStroke(settings, point, nowMs);
    drawState.redoStack = [];
    return true;
  }

  const previousPoint = drawState.activeStroke.points[drawState.activeStroke.points.length - 1];
  const smoothingFactor = clamp(1 - settings.smoothness * 0.85, 0.15, 1);
  const nextPoint = {
    x: previousPoint.x + (point.x - previousPoint.x) * smoothingFactor,
    y: previousPoint.y + (point.y - previousPoint.y) * smoothingFactor
  };

  const distance = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
  const minDistancePx = clamp(settings.brushSize * 0.42, 1.2, 6);

  if (distance < minDistancePx) {
    drawState.activeStroke.lastUpdatedAt = nowMs;
    return false;
  }

  drawState.activeStroke.points.push(nextPoint);
  drawState.activeStroke.lastUpdatedAt = nowMs;

  if (drawState.activeStroke.points.length > 480) {
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

function pruneDrawing(drawState, settings, nowMs) {
  if (settings.autoFade) {
    drawState.strokes = drawState.strokes.filter(
      (stroke) => nowMs - stroke.lastUpdatedAt <= settings.strokeLifetimeMs
    );
  }

  if (drawState.activeStroke && nowMs - drawState.activeStroke.lastUpdatedAt > 620) {
    finalizeActiveStroke(drawState, settings.maxSavedStrokes);
  }
}

function drawAirStroke(context, stroke, alphaFactor) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) {
    return;
  }

  const strokeOpacity = stroke.opacity * alphaFactor;

  context.save();
  context.globalCompositeOperation = stroke.blendMode;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = rgba(stroke.color, strokeOpacity);
  context.shadowBlur = stroke.glow;
  context.strokeStyle = rgba(stroke.color, strokeOpacity);
  context.lineWidth = stroke.width;

  if (stroke.pattern === 'dashed') {
    context.setLineDash([stroke.width * 2.5, stroke.width * 1.8]);
  } else if (stroke.pattern === 'dotted') {
    context.setLineDash([1, stroke.width * 1.7]);
  } else {
    context.setLineDash([]);
  }

  createPathFromPoints(context, stroke.points);
  context.stroke();

  context.shadowBlur = 0;
  context.setLineDash([]);
  context.strokeStyle = `rgba(245, 252, 255, ${0.48 * alphaFactor})`;
  context.lineWidth = Math.max(1.3, stroke.width * 0.32);
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

function drawAirDrawing(context, drawState, settings, nowMs) {
  pruneDrawing(drawState, settings, nowMs);
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
    } else if (now - reliableGestureRef.current.at <= 220) {
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
  const drawStateRef = useRef({
    strokes: [],
    activeStroke: null,
    redoStack: [],
    particles: [],
    lastEraseAt: 0,
    lastParticleAt: 0
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
      lastParticleAt: 0
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

    const primaryHand = multiHandLandmarks?.[0] ?? null;
    const primaryTip = primaryHand?.[8];
    const gestureMatches = isGestureTriggered({
      settings,
      gesture,
      primaryHand
    });

    if (!gestureMatches || !primaryTip) {
      const finalized = finalizeActiveStroke(drawState, settings.maxSavedStrokes);

      return {
        isGestureDrawing: false,
        lastAction: finalized ? 'Stroke completed' : null
      };
    }

    const point = toCanvasPoint(primaryTip, canvasRef.current);

    if (settings.drawMode === 'erase') {
      finalizeActiveStroke(drawState, settings.maxSavedStrokes);

      if (nowMs - drawState.lastEraseAt < 95) {
        return {
          isGestureDrawing: true,
          lastAction: null
        };
      }

      drawState.lastEraseAt = nowMs;
      const eraseRadius = Math.max(14, settings.brushSize * 3.1);
      const removed = eraseNearestStroke(drawState, point, eraseRadius);

      return {
        isGestureDrawing: true,
        lastAction: removed ? 'Stroke erased' : null
      };
    }

    const strokeStarted = !drawState.activeStroke;
    const added = appendStrokePoint(drawState, point, settings, nowMs);

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
          : null
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

      context.save();
      context.clearRect(0, 0, canvas.width, canvas.height);

      const nowMs = performance.now();
      const drawFrame = updateDrawingFromGesture(multiHandLandmarks, gesture, nowMs);
      drawPracticeTemplate(context, canvas, settings, nowMs);
      drawAirDrawing(context, drawState, settings, nowMs);
      drawParticleLayer(context, drawState, settings, nowMs);

      if (settings.showFusionLink && gesture === 'TWO_HANDS') {
        drawFusionLink(context, canvas, multiHandLandmarks, nowMs);
      }

      if (settings.showAura) {
        multiHandLandmarks.forEach((landmarks) => {
          drawEnergyAura(context, canvas, landmarks, gesture, nowMs);
        });
      }

      if (settings.showLandmarks) {
        multiHandLandmarks.forEach((landmarks) => {
          drawConnectors(context, landmarks, HAND_CONNECTIONS, {
            color: '#f97316',
            lineWidth: 4
          });

          drawLandmarks(context, landmarks, {
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
        lastAction: resolvedLastAction
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
      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions(HANDS_DEFAULT_OPTIONS);

      hands.onResults(handleMediaPipeResults);

      handsRef.current = hands;
      noHandsFrameRef.current = 0;
      usingRecoveryOptionsRef.current = false;
      lastOptionsSwapAtRef.current = performance.now();
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
      lastParticleAt: 0
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
