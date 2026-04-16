# NeuroFlux - AI Gesture-Based Energy Simulation System

NeuroFlux is a production-ready, real-time multimodal AI platform where users control digital energy (fire, ice, lightning, fusion) with hand gestures and voice commands.

Pipeline:

Input (gesture + voice)
-> AI Intent Engine
-> Physics Simulation
-> Cinematic Rendering
-> Interactive Experience Layer

## Core Features

- Module 1: Multimodal Input System
  - Webcam via WebRTC (`getUserMedia`)
  - MediaPipe Hands (21 landmarks per hand)
  - Gesture detection: `OPEN_HAND`, `FIST`, `PINCH`, `TWO_HANDS`
  - Continuous Web Speech API voice recognition
  - Structured JSON payload generation:
    - `gesture`, `handsCount`, `voiceCommand`, `timestamp`

- Module 2: AI Intent Engine
  - Rule-based intent mapping from gesture + voice
  - Supported intents:
    - `FIRE_CHARGE`, `FIRE_ATTACK`, `ICE_ATTACK`, `LIGHTNING_ATTACK`, `FUSION`
  - State machine:
    - `IDLE`, `CHARGING`, `ACTIVE`, `COOLDOWN`
  - Confidence scoring and intensity modeling
  - Context memory with recent history

- Module 3: Simulation and Physics
  - Three.js scene + Cannon-es world
  - Object factory:
    - Fireball
    - Ice shard
    - Lightning beam
  - Projectile collisions and explosion effects
  - Particle systems and target objects
  - Public simulation API: `simulateIntent(intentData)`

- Module 4: Rendering Engine
  - Advanced dynamic lighting
  - Custom GLSL materials and shaders (`glow`, `distortion`)
  - Post-processing: Bloom + FXAA + distortion pass
  - Camera effects: shake + dynamic zoom

- Module 5: Experience Layer
  - Game modes:
    - `TARGET_PRACTICE`
    - `FREE_PLAY`
  - Target system and scoring logic
  - Animated HUD + controls (Framer Motion)
  - Realtime status and telemetry panels

## Central Controller (Mandatory Integration)

Core orchestration lives in:

- `src/core/coreController.js`

Pipeline function:

```js
processInput(inputData) {
  const intent = getIntent(inputData);
  simulateIntent(intent);
  renderScene(intent);
  updateGameState(intent);
}
```

The app runs this pipeline on `requestAnimationFrame` for realtime interaction.

## Project Structure

```text
src/
├── core/
│   ├── input/
│   │   ├── inputSanitizer.js
│   │   ├── handPoseMapper.js
│   │   └── multimodalInputService.js
│   ├── ai/
│   │   ├── intentService.js
│   │   └── intentService.test.js
│   ├── simulation/
│   │   └── simulationService.js
│   ├── rendering/
│   │   └── renderingService.js
│   ├── experience/
│   │   ├── targetSystem.js
│   │   ├── gameStateManager.js
│   │   └── gameStateManager.test.js
│   ├── coreController.js
│   └── corePipeline.examples.js
├── components/
│   ├── CameraFeed.jsx
│   ├── HandTracker.jsx
│   ├── VoiceInput.jsx
│   ├── ExperienceHUD.jsx
│   └── GameControls.jsx
├── hooks/
│   ├── useCamera.js
│   ├── useHandTracking.js
│   ├── useVoiceRecognition.js
│   └── useCoreController.js
├── simulation/
├── rendering/
├── physics/
├── particles/
├── shaders/
├── assets/
├── App.jsx
├── main.jsx
└── styles.css
```

## Installation

Requirements:

- Node.js 18+
- npm 9+

Install dependencies:

```bash
npm install
```

## Run

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Tests and Examples

Run module tests:

```bash
npm run test:intent
npm run test:simulation
npm run test:rendering
npm run test:core:ai
npm run test:core:experience
```

Run all tests in sequence:

```bash
npm run test:all
```

Run examples:

```bash
npm run example:intent
npm run example:simulation
npm run example:rendering
npm run example:core
```

## Mandatory Test Cases

- `OPEN_HAND + "ignite" -> FIRE_CHARGE`
- `FIST -> FIRE_ATTACK`
- `TWO_HANDS -> FUSION`

These are validated in:

- `src/core/ai/intentService.test.js`

## Demo Flow (Must Work)

1. Open hand -> fire charge appears.
2. Say "ignite" -> charge grows.
3. Close fist -> fireball launches.
4. Hit target -> explosion + score increment (Target Practice mode).

The UI also includes Demo Action buttons to quickly verify this sequence.

## Error Handling

Handled runtime cases:

- Camera permission denied
- Microphone unavailable or blocked
- No gesture detected
- Invalid/unrecognized voice command
- Controller initialization and pipeline processing errors

Errors are surfaced through HUD and Runtime Alerts panels.

## Performance Notes

- Realtime loop driven by `requestAnimationFrame`
- Dynamic import for heavy simulation/rendering stack
- Fixed-step physics update
- Particle and active object caps
- Runtime post-processing toggles for performance tuning

## Browser Compatibility

Recommended:

- Chrome (latest)
- Edge (latest)

Supported with caveats:

- Firefox (speech recognition support may vary)
- Safari (Web Speech API behavior depends on version/platform)

Permissions note:

- Camera/microphone access requires localhost or HTTPS.

## Debug Logs

Debug logs are emitted under `debug: true` in services/controller:

- Input payload normalization and warnings
- AI intent processing outputs
- Simulation events and impacts
- Core pipeline processing snapshots

Use browser DevTools console to inspect logs during demo.

## Cinematic Video Generation Docs

Additional AI-cinematic generation pipeline docs are available at:

- `docs/cinematic_fusion_pipeline/README.md`
