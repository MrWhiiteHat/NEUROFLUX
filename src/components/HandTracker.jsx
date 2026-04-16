import { useCallback, useEffect, useState } from 'react';
import { useInputContext } from '../context/InputContext';
import { DEFAULT_DRAW_SETTINGS, useHandTracking } from '../hooks/useHandTracking';

const COLOR_PRESETS = [
  { label: 'Ice', value: '#74d6ff' },
  { label: 'Fire', value: '#ff7a3d' },
  { label: 'Lightning', value: '#d9a1ff' },
  { label: 'Emerald', value: '#4fe0b4' },
  { label: 'White', value: '#f5fbff' }
];

const TRIGGER_GESTURES = [
  { value: 'AUTO', label: 'AUTO (Pinch/Point/V)' },
  { value: 'PINCH', label: 'PINCH' },
  { value: 'POINT', label: 'POINT' },
  { value: 'V_SIGN', label: 'V_SIGN' },
  { value: 'OPEN_HAND', label: 'OPEN_HAND' },
  { value: 'FIST', label: 'FIST' }
];

const PARTICLE_MODES = [
  { value: 'none', label: 'None' },
  { value: 'spark', label: 'Spark Trail' },
  { value: 'magic', label: 'Magic Dust' },
  { value: 'ember', label: 'Ember Fire' },
  { value: 'smoke', label: 'Smoke Ink' }
];
const BRUSH_PATTERNS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' }
];

const BRUSH_STYLES = [
  { value: 'neon', label: 'Neon Glow' },
  { value: 'ink', label: 'Ink Pen' },
  { value: 'marker', label: 'Marker' },
  { value: 'spray', label: 'Spray Paint' },
  { value: 'calligraphy', label: 'Calligraphy' },
  { value: 'watercolor', label: 'Watercolor' }
];

const TEMPLATE_PRESETS = [
  { value: 'star', label: 'Star' },
  { value: 'circle', label: 'Circle' },
  { value: 'heart', label: 'Heart' },
  { value: 'flower', label: 'Flower' },
  { value: 'house', label: 'House' },
  { value: 'letter-a', label: 'Letter A' },
  { value: '3d-orb', label: '3D Orb' },
  { value: '3d-cube', label: '3D Cube' },
  { value: '3d-face', label: '3D Face' },
  { value: '3d-bear', label: '3D Bear' }
];

export default function HandTracker({ videoRef, canvasRef, enabled, compactMode = false }) {
  const { updateHandData, setError } = useInputContext();
  const [drawSettings, setDrawSettings] = useState(DEFAULT_DRAW_SETTINGS);
  const [panelMessage, setPanelMessage] = useState('');

  const handleResults = useCallback(
    (payload) => {
      updateHandData(payload);
    },
    [updateHandData]
  );

  const {
    isTracking,
    isLoading,
    error,
    drawStats,
    clearDrawing,
    undoStroke,
    redoStroke,
    exportDrawingImage
  } = useHandTracking({
    videoRef,
    canvasRef,
    enabled,
    onResults: handleResults,
    drawSettings
  });

  useEffect(() => {
    setError('handTracking', error);
  }, [error, setError]);

  const patchSettings = useCallback((patch) => {
    setDrawSettings((previous) => ({
      ...previous,
      ...patch
    }));
  }, []);

  const updateNumberSetting = useCallback(
    (key) => (event) => {
      patchSettings({
        [key]: Number(event.target.value)
      });
    },
    [patchSettings]
  );

  const updateToggleSetting = useCallback(
    (key) => (event) => {
      patchSettings({
        [key]: event.target.checked
      });
    },
    [patchSettings]
  );

  const handleUndo = useCallback(() => {
    undoStroke();
    setPanelMessage('Undo applied');
  }, [undoStroke]);

  const handleRedo = useCallback(() => {
    redoStroke();
    setPanelMessage('Redo applied');
  }, [redoStroke]);

  const handleClear = useCallback(() => {
    clearDrawing();
    setPanelMessage('Drawing cleared');
  }, [clearDrawing]);

  const handleExport = useCallback(() => {
    const result = exportDrawingImage();
    setPanelMessage(result.message);
  }, [exportDrawingImage]);

  const setColorPreset = useCallback(
    (hex) => {
      patchSettings({ brushColor: hex });
    },
    [patchSettings]
  );

  return (
    <section className={`panel tracker-panel reveal-b${compactMode ? ' tracker-essential-mode' : ''}`}>
      <div className="section-header">
        <h2>{compactMode ? 'Essential Edit Panel' : 'Hand Tracking + Draw Studio'}</h2>
        <span className={`badge ${isTracking ? 'badge-live' : 'badge-idle'}`}>
          {isTracking ? 'Live' : 'Idle'}
        </span>
      </div>

      {isLoading && <p className="status-text">Loading MediaPipe Hands...</p>}
      {!isLoading && !error && (
        <p className="status-text">
          {compactMode
            ? 'Quick fullscreen controls for draw, brush, particles, and edit actions.'
            : 'Use your selected trigger gesture to draw, erase, and edit strokes in realtime.'}
        </p>
      )}
      {error && <p className="status-text status-error">{error}</p>}

      <div className={`draw-stats-grid${compactMode ? ' draw-stats-grid-compact' : ''}`}>
        <article className="metric-block">
          <h3>Strokes</h3>
          <p>{drawStats.savedStrokeCount}</p>
        </article>
        <article className="metric-block">
          <h3>Detected Gesture</h3>
          <p>{drawStats.detectedGesture}</p>
        </article>
        <article className="metric-block">
          <h3>Redo Stack</h3>
          <p>{drawStats.redoCount}</p>
        </article>
        {!compactMode && (
          <article className="metric-block">
            <h3>Tool / Trigger</h3>
            <p>
              {drawStats.activeTool.toUpperCase()} / {drawStats.triggerGesture}
            </p>
          </article>
        )}
        {!compactMode && (
          <article className="metric-block">
            <h3>Mirror</h3>
            <p>{drawStats.mirrorMode}</p>
          </article>
        )}
        {!compactMode && (
          <article className="metric-block">
            <h3>AR Template</h3>
            <p>{drawStats.templateType}</p>
          </article>
        )}
        <article className="metric-block">
          <h3>Particle FX</h3>
          <p>
            {drawStats.particleMode} ({drawStats.particleCount})
          </p>
        </article>
      </div>

      <div className="draw-control-stack">
        <section className="draw-control-group">
          <h3>Tool Mode</h3>
          <div className="draw-inline-grid draw-inline-grid-3">
            <label className="draw-field">
              <span className="draw-label">Enable Drawing</span>
              <input
                type="checkbox"
                checked={drawSettings.drawEnabled}
                onChange={updateToggleSetting('drawEnabled')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Tool</span>
              <select
                value={drawSettings.drawMode}
                onChange={(event) => patchSettings({ drawMode: event.target.value })}
              >
                <option value="draw">Draw</option>
                <option value="erase">Erase</option>
              </select>
            </label>

            <label className="draw-field">
              <span className="draw-label">Trigger Gesture</span>
              <select
                value={drawSettings.triggerGesture}
                onChange={(event) => patchSettings({ triggerGesture: event.target.value })}
              >
                {TRIGGER_GESTURES.map((gesture) => (
                  <option key={gesture.value} value={gesture.value}>
                    {gesture.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="draw-field draw-toggle draw-toggle-single">
            <input
              type="checkbox"
              checked={drawSettings.handwritingAssist}
              onChange={updateToggleSetting('handwritingAssist')}
            />
            <span>Handwriting Assist (more stable writing)</span>
          </label>

          <p className="draw-help-line">
            Friendly gestures: <strong>Pinch</strong>, <strong>Point</strong>, <strong>V Sign</strong>.
            Use <strong>AUTO</strong> trigger + <strong>Handwriting Assist</strong> for easiest writing.
            <strong>Open Hand</strong> erases instantly when trigger is <strong>AUTO</strong>.
          </p>
        </section>

        <section className="draw-control-group">
          <h3>Brush Customization</h3>

          <div className="draw-inline-grid draw-inline-grid-2">
            <label className="draw-field">
              <span className="draw-label">Brush Color</span>
              <div className="draw-color-input-row">
                <input
                  type="color"
                  value={drawSettings.brushColor}
                  onChange={(event) => patchSettings({ brushColor: event.target.value })}
                />
                <input
                  type="text"
                  value={drawSettings.brushColor}
                  onChange={(event) => patchSettings({ brushColor: event.target.value })}
                />
              </div>
            </label>

            <div className="draw-field">
              <span className="draw-label">Quick Presets</span>
              <div className="draw-color-preset-row">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="draw-color-preset"
                    title={preset.label}
                    style={{ background: preset.value }}
                    onClick={() => setColorPreset(preset.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="draw-slider-grid">
            <label className="draw-field">
              <span className="draw-label">Brush Size: {drawSettings.brushSize.toFixed(1)} px</span>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={drawSettings.brushSize}
                onChange={updateNumberSetting('brushSize')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">
                Opacity: {(drawSettings.brushOpacity * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={drawSettings.brushOpacity}
                onChange={updateNumberSetting('brushOpacity')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Glow: {drawSettings.glowStrength.toFixed(0)}</span>
              <input
                type="range"
                min="0"
                max="36"
                step="1"
                value={drawSettings.glowStrength}
                onChange={updateNumberSetting('glowStrength')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">
                Smoothness: {(drawSettings.smoothness * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={drawSettings.smoothness}
                onChange={updateNumberSetting('smoothness')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Blend Mode</span>
              <select
                value={drawSettings.blendMode}
                onChange={(event) => patchSettings({ blendMode: event.target.value })}
              >
                <option value="screen">Screen Glow</option>
                <option value="additive">Additive</option>
                <option value="normal">Normal</option>
              </select>
            </label>

            <label className="draw-field">
              <span className="draw-label">Brush Type</span>
              <select
                value={drawSettings.brushStyle}
                onChange={(event) => patchSettings({ brushStyle: event.target.value })}
              >
                {BRUSH_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {!compactMode && (
          <section className="draw-control-group">
            <h3>Advanced Editing</h3>

            <div className="draw-inline-grid draw-inline-grid-2">
              <label className="draw-field">
                <span className="draw-label">Brush Pattern</span>
                <select
                  value={drawSettings.brushPattern}
                  onChange={(event) => patchSettings({ brushPattern: event.target.value })}
                >
                  {BRUSH_PATTERNS.map((pattern) => (
                    <option key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="draw-field draw-toggle draw-toggle-single">
                <input
                  type="checkbox"
                  checked={drawSettings.rainbowBrush}
                  onChange={updateToggleSetting('rainbowBrush')}
                />
                <span>Rainbow Brush</span>
              </label>

              <label className="draw-field draw-toggle draw-toggle-single">
                <input
                  type="checkbox"
                  checked={drawSettings.mirrorHorizontal}
                  onChange={updateToggleSetting('mirrorHorizontal')}
                />
                <span>Mirror Horizontal</span>
              </label>

              <label className="draw-field draw-toggle draw-toggle-single">
                <input
                  type="checkbox"
                  checked={drawSettings.mirrorVertical}
                  onChange={updateToggleSetting('mirrorVertical')}
                />
                <span>Mirror Vertical</span>
              </label>
            </div>

            <label className="draw-field">
              <span className="draw-label">Max Saved Strokes: {drawSettings.maxSavedStrokes}</span>
              <input
                type="range"
                min="8"
                max="100"
                step="1"
                value={drawSettings.maxSavedStrokes}
                onChange={updateNumberSetting('maxSavedStrokes')}
              />
            </label>
          </section>
        )}

        <section className="draw-control-group">
          <h3>Particle Brush FX</h3>

          <label className="draw-field">
            <span className="draw-label">Particle Mode</span>
            <select
              value={drawSettings.particleMode}
              onChange={(event) => patchSettings({ particleMode: event.target.value })}
            >
              {PARTICLE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <div className="draw-inline-grid draw-inline-grid-2">
            <label className="draw-field">
              <span className="draw-label">Density: {drawSettings.particleDensity.toFixed(0)}</span>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={drawSettings.particleDensity}
                onChange={updateNumberSetting('particleDensity')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Particle Size: {drawSettings.particleSize.toFixed(1)}</span>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={drawSettings.particleSize}
                onChange={updateNumberSetting('particleSize')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">
                Lifetime: {(drawSettings.particleLifetimeMs / 1000).toFixed(2)}s
              </span>
              <input
                type="range"
                min="280"
                max="4000"
                step="20"
                value={drawSettings.particleLifetimeMs}
                onChange={updateNumberSetting('particleLifetimeMs')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Spread: {drawSettings.particleSpread.toFixed(2)}</span>
              <input
                type="range"
                min="0.2"
                max="2.4"
                step="0.01"
                value={drawSettings.particleSpread}
                onChange={updateNumberSetting('particleSpread')}
              />
            </label>

            <label className="draw-field draw-span-2">
              <span className="draw-label">Particle Speed: {drawSettings.particleSpeed.toFixed(2)}</span>
              <input
                type="range"
                min="0.2"
                max="2.3"
                step="0.01"
                value={drawSettings.particleSpeed}
                onChange={updateNumberSetting('particleSpeed')}
              />
            </label>
          </div>
        </section>

        {!compactMode && (
          <section className="draw-control-group">
            <h3>Overlay Visibility + Lifetime</h3>

            <div className="draw-toggle-grid">
              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.showAura}
                  onChange={updateToggleSetting('showAura')}
                />
                <span>Show Energy Aura</span>
              </label>

              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.showLandmarks}
                  onChange={updateToggleSetting('showLandmarks')}
                />
                <span>Show Landmarks</span>
              </label>

              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.showFusionLink}
                  onChange={updateToggleSetting('showFusionLink')}
                />
                <span>Show Fusion Link</span>
              </label>

              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.showCursor}
                  onChange={updateToggleSetting('showCursor')}
                />
                <span>Show Draw Cursor</span>
              </label>

              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.autoFade}
                  onChange={updateToggleSetting('autoFade')}
                />
                <span>Auto Fade Strokes</span>
              </label>
            </div>

            <label className="draw-field">
              <span className="draw-label">
                Stroke Lifetime: {(drawSettings.strokeLifetimeMs / 1000).toFixed(1)}s
              </span>
              <input
                type="range"
                min="2000"
                max="120000"
                step="500"
                value={drawSettings.strokeLifetimeMs}
                onChange={updateNumberSetting('strokeLifetimeMs')}
                disabled={!drawSettings.autoFade}
              />
            </label>
          </section>
        )}

        {!compactMode && (
          <section className="draw-control-group">
            <h3>AR Practice Template</h3>

            <div className="draw-toggle-grid">
              <label className="draw-field draw-toggle">
                <input
                  type="checkbox"
                  checked={drawSettings.templateEnabled}
                  onChange={updateToggleSetting('templateEnabled')}
                />
                <span>Show AR Guide Template</span>
              </label>

              <label className="draw-field">
                <span className="draw-label">Template Type</span>
                <select
                  value={drawSettings.templateType}
                  onChange={(event) => patchSettings({ templateType: event.target.value })}
                >
                  {TEMPLATE_PRESETS.map((template) => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="draw-inline-grid draw-inline-grid-2">
              <label className="draw-field">
                <span className="draw-label">Template Color</span>
                <div className="draw-color-input-row">
                  <input
                    type="color"
                    value={drawSettings.templateColor}
                    onChange={(event) => patchSettings({ templateColor: event.target.value })}
                  />
                  <input
                    type="text"
                    value={drawSettings.templateColor}
                    onChange={(event) => patchSettings({ templateColor: event.target.value })}
                  />
                </div>
              </label>

              <div className="draw-field">
                <span className="draw-label">Template Presets</span>
                <div className="template-preset-row">
                  {TEMPLATE_PRESETS.map((template) => (
                    <button
                      key={template.value}
                      type="button"
                      className="template-preset-btn"
                      onClick={() => patchSettings({ templateEnabled: true, templateType: template.value })}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="draw-field">
              <span className="draw-label">
                Template Opacity: {(drawSettings.templateOpacity * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min="0.12"
                max="0.95"
                step="0.01"
                value={drawSettings.templateOpacity}
                onChange={updateNumberSetting('templateOpacity')}
              />
            </label>

            <label className="draw-field">
              <span className="draw-label">Template Scale: {drawSettings.templateScale.toFixed(2)}x</span>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.01"
                value={drawSettings.templateScale}
                onChange={updateNumberSetting('templateScale')}
              />
            </label>

            <div className="draw-inline-grid draw-inline-grid-2">
              <label className="draw-field">
                <span className="draw-label">Template X Offset: {drawSettings.templateOffsetX.toFixed(2)}</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={drawSettings.templateOffsetX}
                  onChange={updateNumberSetting('templateOffsetX')}
                />
              </label>

              <label className="draw-field">
                <span className="draw-label">Template Y Offset: {drawSettings.templateOffsetY.toFixed(2)}</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={drawSettings.templateOffsetY}
                  onChange={updateNumberSetting('templateOffsetY')}
                />
              </label>
            </div>
          </section>
        )}

        <section className="draw-control-group">
          <h3>Edit Drawing</h3>
          <div className="draw-action-row">
            <button type="button" className="btn btn-secondary" onClick={handleUndo}>
              Undo
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleRedo}>
              Redo
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExport}>
              Export PNG
            </button>
          </div>
          <p className="status-text draw-panel-message">{panelMessage || drawStats.lastAction}</p>
        </section>
      </div>
    </section>
  );
}
