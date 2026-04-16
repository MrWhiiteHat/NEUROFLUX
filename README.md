# NeuroFlux Camera Gesture Drawing Studio

NeuroFlux is a camera-first hand-gesture drawing app.

You draw directly on top of the live webcam feed using real-time hand tracking, with a full studio control panel for brush styling, particle effects, AR templates, overlays, and editing tools.

## What This Project Includes

- Live camera feed with overlay canvas drawing
- Real-time hand tracking using MediaPipe Hands
- Gesture detection with robust fallback logic
- Trigger-based drawing and erasing modes
- Advanced brush styling and blend effects
- Particle brush FX system with multiple modes
- AR practice templates (shape guides)
- Undo, redo, clear, export PNG
- Responsive studio layout for desktop and mobile

## Current Gesture Support

- NO_HANDS
- TWO_HANDS
- PINCH
- POINT
- V_SIGN
- OPEN_HAND
- FIST
- UNKNOWN

Default draw trigger is AUTO, which accepts PINCH, POINT, and V_SIGN.

## Studio Controls

The panel includes:

- Tool mode: draw or erase
- Trigger gesture selection
- Brush color, presets, size, opacity, glow, smoothness, blend mode
- Brush pattern: solid, dashed, dotted
- Rainbow brush and mirror modes (horizontal, vertical)
- Particle FX: mode, density, size, lifetime, spread, speed
- Overlay toggles: aura, landmarks, fusion link, draw cursor
- Stroke auto-fade and lifetime
- AR template controls: template type, color, opacity, scale, offset
- Editing actions: undo, redo, clear, export

## Particle Brush FX Modes

- none
- spark
- magic
- ember
- smoke

Particle emission is continuous while gesture-drawing is active, including low-motion scenarios.

## MediaPipe Production Compatibility (Vercel)

To avoid Hands constructor runtime issues in production bundles, this project uses a runtime loader strategy in the hand-tracking hook:

- Loads MediaPipe Hands and drawing utils scripts from CDN when needed
- Captures Hands, HAND_CONNECTIONS, drawConnectors, and drawLandmarks from global scope
- Initializes tracking only after runtime APIs are confirmed available

This makes production deployments significantly more reliable.

## Tech Stack

- React 18
- Vite 5
- MediaPipe Hands
- Tailwind CSS + custom CSS
- ESLint

Additional dependencies are present for future/legacy modules.

## Project Structure (Current)

```text
src/
  App.jsx
  main.jsx
  styles.css
  components/
    HandTracker.jsx
  context/
    InputContext.jsx
  drawing-engine/
    components/
      CameraGestureDock.jsx
      DrawingStudio.jsx
      index.js
  hooks/
    useCamera.js
    useHandTracking.js
  utils/
    gestureUtils.js
docs/
  cinematic_fusion_pipeline/
```

## Architecture Overview

Runtime flow:

1. App mounts DrawingStudio
2. CameraGestureDock starts webcam via useCamera
3. HandTracker runs useHandTracking on the same video/canvas pair
4. Gesture data is normalized and published through InputContext
5. Draw engine renders strokes, particles, overlays, and templates in real time

## Local Setup

Requirements:

- Node.js 18+
- npm 9+

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

## NPM Scripts

Primary scripts used for this app:

- npm run dev
- npm run build
- npm run preview
- npm run lint
- npm test

The package file also includes legacy script entries for larger prior modules. Those scripts may require files not present in the current trimmed workspace.

## Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)

1. Push code to GitHub.
2. Open https://vercel.com/new
3. Import repository.
4. Confirm build settings:
   - Install command: npm install
   - Build command: npm run build
   - Output directory: dist
5. Deploy.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

## Troubleshooting

### Camera does not start

- Allow camera permission in browser site settings
- Use HTTPS or localhost
- Retry using the in-app Retry Camera button

### Hand tracking does not initialize

- Check network access to jsdelivr CDN
- Hard refresh the page after deploy
- Confirm latest deployment contains the runtime loader changes

### Particle FX not visible

- Ensure draw mode is active and trigger is detected
- Set Particle Mode to something other than none
- Increase density and size in panel controls

### Gesture seems unstable

- Improve lighting and hand visibility
- Keep hand centered and avoid extreme angles
- Use AUTO trigger for easier drawing activation

## Browser Notes

Best experience:

- Chrome (latest)
- Edge (latest)

Other browsers may work but camera and performance behavior can vary.

## Additional Docs

- Cinematic workflow docs: docs/cinematic_fusion_pipeline/README.md

## Maintainer

GitHub: MrWhiiteHat
