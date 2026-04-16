const LANDMARK_COUNT = 21;
const WRIST_INDEX = 0;

const FINGER_PAIRS = [
  { tip: 4, pip: 3 },
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 }
];

const NON_THUMB_FINGERS = [
  { tip: 8, pip: 6, mcp: 5 },
  { tip: 12, pip: 10, mcp: 9 },
  { tip: 16, pip: 14, mcp: 13 },
  { tip: 20, pip: 18, mcp: 17 }
];

const THUMB = {
  tip: 4,
  pip: 3,
  mcp: 2
};

function isValidLandmarks(landmarks) {
  return Array.isArray(landmarks) && landmarks.length >= LANDMARK_COUNT;
}

function distance(a, b) {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0), (a.z ?? 0) - (b.z ?? 0));
}

function midpoint(a, b) {
  return {
    x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2,
    y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2,
    z: ((a?.z ?? 0) + (b?.z ?? 0)) / 2
  };
}

function palmCenter(landmarks) {
  const points = [0, 5, 9, 13, 17].map((index) => landmarks?.[index]).filter(Boolean);

  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
      z: acc.z + (point.z ?? 0)
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length
  };
}

function handScale(landmarks) {
  const indexMcp = landmarks?.[5];
  const pinkyMcp = landmarks?.[17];
  const wrist = landmarks?.[0];
  const middleMcp = landmarks?.[9];

  const width = indexMcp && pinkyMcp ? distance(indexMcp, pinkyMcp) : 0.17;
  const height = wrist && middleMcp ? distance(wrist, middleMcp) : 0.15;

  return Math.max(0.06, (width + height) * 0.5);
}

function isFingerExtended(landmarks, tip, pip) {
  const wrist = landmarks[WRIST_INDEX];
  const tipPoint = landmarks[tip];
  const pipPoint = landmarks[pip];

  if (!wrist || !tipPoint || !pipPoint) {
    return false;
  }

  return distance(tipPoint, wrist) > distance(pipPoint, wrist) * 1.08;
}

function isFingerFolded(landmarks, tip, pip) {
  const wrist = landmarks[WRIST_INDEX];
  const tipPoint = landmarks[tip];
  const pipPoint = landmarks[pip];

  if (!wrist || !tipPoint || !pipPoint) {
    return false;
  }

  return distance(tipPoint, wrist) < distance(pipPoint, wrist) * 0.95;
}

function isFingerExtendedRobust(landmarks, { tip, pip, mcp }) {
  const tipPoint = landmarks?.[tip];
  const pipPoint = landmarks?.[pip];
  const mcpPoint = landmarks?.[mcp];
  const wrist = landmarks?.[WRIST_INDEX];

  if (!tipPoint || !pipPoint || !mcpPoint || !wrist) {
    return false;
  }

  const tipToWrist = distance(tipPoint, wrist);
  const pipToWrist = distance(pipPoint, wrist);
  const tipToMcp = distance(tipPoint, mcpPoint);
  const pipToMcp = distance(pipPoint, mcpPoint);

  return tipToWrist > pipToWrist * 1.04 && tipToMcp > pipToMcp * 1.15;
}

function isFingerFoldedRobust(landmarks, { tip, pip, mcp }) {
  const tipPoint = landmarks?.[tip];
  const pipPoint = landmarks?.[pip];
  const mcpPoint = landmarks?.[mcp];
  const wrist = landmarks?.[WRIST_INDEX];

  if (!tipPoint || !pipPoint || !mcpPoint || !wrist) {
    return false;
  }

  const tipToWrist = distance(tipPoint, wrist);
  const pipToWrist = distance(pipPoint, wrist);
  const tipToMcp = distance(tipPoint, mcpPoint);
  const pipToMcp = distance(pipPoint, mcpPoint);

  return tipToWrist < pipToWrist * 0.98 || tipToMcp < pipToMcp * 0.88;
}

function isThumbExtended(landmarks) {
  const tipPoint = landmarks?.[THUMB.tip];
  const pipPoint = landmarks?.[THUMB.pip];
  const mcpPoint = landmarks?.[THUMB.mcp];
  const wrist = landmarks?.[WRIST_INDEX];

  if (!tipPoint || !pipPoint || !mcpPoint || !wrist) {
    return false;
  }

  const tipToWrist = distance(tipPoint, wrist);
  const pipToWrist = distance(pipPoint, wrist);
  const tipToMcp = distance(tipPoint, mcpPoint);
  const pipToMcp = distance(pipPoint, mcpPoint);

  return tipToWrist > pipToWrist * 1.04 && tipToMcp > pipToMcp * 1.05;
}

function isThumbFolded(landmarks) {
  const tipPoint = landmarks?.[THUMB.tip];
  const pipPoint = landmarks?.[THUMB.pip];
  const mcpPoint = landmarks?.[THUMB.mcp];
  const wrist = landmarks?.[WRIST_INDEX];

  if (!tipPoint || !pipPoint || !mcpPoint || !wrist) {
    return false;
  }

  const tipToWrist = distance(tipPoint, wrist);
  const pipToWrist = distance(pipPoint, wrist);
  const tipToMcp = distance(tipPoint, mcpPoint);
  const pipToMcp = distance(pipPoint, mcpPoint);

  return tipToWrist < pipToWrist * 0.98 || tipToMcp < pipToMcp * 0.95;
}

export function isPointGesture(landmarks) {
  if (!isValidLandmarks(landmarks)) {
    return false;
  }

  if (isPinch(landmarks)) {
    return false;
  }

  const indexExtended = isFingerExtendedRobust(landmarks, NON_THUMB_FINGERS[0]);
  const middleFolded = isFingerFoldedRobust(landmarks, NON_THUMB_FINGERS[1]);
  const ringFolded = isFingerFoldedRobust(landmarks, NON_THUMB_FINGERS[2]);
  const pinkyFolded = isFingerFoldedRobust(landmarks, NON_THUMB_FINGERS[3]);

  return indexExtended && middleFolded && ringFolded && pinkyFolded;
}

export function isVSignGesture(landmarks) {
  if (!isValidLandmarks(landmarks)) {
    return false;
  }

  if (isPinch(landmarks)) {
    return false;
  }

  const indexExtended = isFingerExtendedRobust(landmarks, NON_THUMB_FINGERS[0]);
  const middleExtended = isFingerExtendedRobust(landmarks, NON_THUMB_FINGERS[1]);
  const ringFolded = isFingerFoldedRobust(landmarks, NON_THUMB_FINGERS[2]);
  const pinkyFolded = isFingerFoldedRobust(landmarks, NON_THUMB_FINGERS[3]);

  if (!(indexExtended && middleExtended && ringFolded && pinkyFolded)) {
    return false;
  }

  const spread = distance(landmarks[8], landmarks[12]);
  return spread >= handScale(landmarks) * 0.24;
}

export function isOpenHand(landmarks) {
  if (!isValidLandmarks(landmarks)) {
    return false;
  }

  const pinch = isPinch(landmarks);

  if (pinch) {
    return false;
  }

  const extendedCount = NON_THUMB_FINGERS.filter((finger) =>
    isFingerExtendedRobust(landmarks, finger)
  ).length;

  const thumbExtended = isThumbExtended(landmarks);
  const thumbFolded = isThumbFolded(landmarks);

  return extendedCount >= 3 && (thumbExtended || !thumbFolded);
}

export function isFist(landmarks) {
  if (!isValidLandmarks(landmarks)) {
    return false;
  }

  const pinch = isPinch(landmarks);

  if (pinch) {
    return false;
  }

  const foldedCount = NON_THUMB_FINGERS.filter((finger) =>
    isFingerFoldedRobust(landmarks, finger)
  ).length;

  return foldedCount >= 3 && isThumbFolded(landmarks);
}

export function isPinch(landmarks) {
  if (!isValidLandmarks(landmarks)) {
    return false;
  }

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  if (!thumbTip || !indexTip) {
    return false;
  }

  const scale = handScale(landmarks);
  const palm = palmCenter(landmarks);
  const contactPoint = midpoint(thumbTip, indexTip);

  if (!palm) {
    return false;
  }

  const tipDistance = distance(thumbTip, indexTip);
  const contactToPalm = distance(contactPoint, palm);

  return tipDistance <= scale * 0.48 && contactToPalm >= scale * 0.38;
}

export function detectGesture(handLandmarks) {
  if (!Array.isArray(handLandmarks) || handLandmarks.length === 0) {
    return 'NO_HANDS';
  }

  if (handLandmarks.length >= 2) {
    return 'TWO_HANDS';
  }

  const [landmarks] = handLandmarks;

  if (isPinch(landmarks)) {
    return 'PINCH';
  }

  if (isVSignGesture(landmarks)) {
    return 'V_SIGN';
  }

  if (isPointGesture(landmarks)) {
    return 'POINT';
  }

  if (isFist(landmarks)) {
    return 'FIST';
  }

  if (isOpenHand(landmarks)) {
    return 'OPEN_HAND';
  }

  // Backward-compatible fallback helps edge poses still resolve.
  const fallbackOpen = FINGER_PAIRS.filter(({ tip, pip }) => isFingerExtended(landmarks, tip, pip)).length;
  const fallbackFolded = FINGER_PAIRS.filter(({ tip, pip }) => isFingerFolded(landmarks, tip, pip)).length;

  if (fallbackOpen >= 4) {
    return 'OPEN_HAND';
  }

  if (fallbackFolded >= 4) {
    return 'FIST';
  }

  const indexOnly =
    isFingerExtended(landmarks, 8, 6) &&
    isFingerFolded(landmarks, 12, 10) &&
    isFingerFolded(landmarks, 16, 14) &&
    isFingerFolded(landmarks, 20, 18);

  if (indexOnly) {
    return 'POINT';
  }

  return 'UNKNOWN';
}
