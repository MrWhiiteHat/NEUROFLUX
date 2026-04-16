import { useCallback, useEffect, useRef, useState } from 'react';
import HandTracker from '../../components/HandTracker.jsx';
import { useInputContext } from '../../context/InputContext.jsx';
import { useCamera } from '../../hooks/useCamera.js';

function normalizeGesture(gesture) {
  switch (gesture) {
    case 'INDEX_POINT':
      return 'POINT';
    case 'PEACE':
      return 'V_SIGN';
    default:
      return gesture;
  }
}

export function CameraGestureDock({ mode = 'dock' }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const fullscreenHostRef = useRef(null);
  const isFull = mode === 'full';
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [showEssentialPanel, setShowEssentialPanel] = useState(false);

  const { latestInput, errors, updateStatus, setError } = useInputContext();

  const { startCamera, stopCamera, isReady, isLoading, error: cameraError } = useCamera(videoRef);

  useEffect(() => {
    void startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    updateStatus({ cameraReady: isReady });
  }, [isReady, updateStatus]);

  useEffect(() => {
    setError('camera', cameraError);
  }, [cameraError, setError]);

  useEffect(() => {
    const gestureName = normalizeGesture(latestInput?.gesture ?? 'NO_HANDS');

    if (!gestureName || gestureName === 'NO_HANDS') {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('neuroflux:gesture', {
        detail: {
          gesture: gestureName,
          confidence: 0.95
        }
      })
    );
  }, [latestInput?.gesture]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === fullscreenHostRef.current;
      setIsFullscreenMode(active);
      setShowEssentialPanel(active);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleCameraFullscreen = useCallback(async () => {
    const target = fullscreenHostRef.current;

    if (!target || typeof document === 'undefined' || typeof target.requestFullscreen !== 'function') {
      return;
    }

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
        return;
      }

      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }

      await target.requestFullscreen();
      setShowEssentialPanel(true);
    } catch (error) {
      setError('camera', `Fullscreen failed: ${error?.message ?? 'Unknown error'}`);
    }
  }, [setError]);

  const toggleEssentialPanel = useCallback(() => {
    setShowEssentialPanel((previous) => !previous);
  }, []);

  const closeEssentialPanel = useCallback(() => {
    setShowEssentialPanel(false);
  }, []);

  const cameraFrame = (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 bg-slate-200 ${
        isFull ? 'aspect-video min-h-[420px]' : 'aspect-video'
      }`}
    >
      <div className="absolute inset-0" style={{ transform: 'scaleX(-1)' }}>
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {isFull && (
        <div className="camera-top-actions">
          <button type="button" className="camera-action-btn" onClick={toggleCameraFullscreen}>
            {isFullscreenMode ? 'Exit Fullscreen' : 'Fullscreen Camera'}
          </button>

          {isFullscreenMode && (
            <button type="button" className="camera-action-btn camera-action-btn-secondary" onClick={toggleEssentialPanel}>
              {showEssentialPanel ? 'Hide Panel' : 'Show Panel'}
            </button>
          )}
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-slate-900/70 px-4 text-center text-white">
          <p className="text-sm font-medium">
            {isLoading ? 'Requesting camera permission...' : 'Camera feed unavailable.'}
          </p>
          {cameraError && <p className="text-xs text-rose-200">{cameraError}</p>}
          {!isLoading && (
            <button
              type="button"
              onClick={startCamera}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              Retry Camera
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isFull) {
    return (
      <section
        ref={fullscreenHostRef}
        className={`camera-gesture-shell rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5${
          isFullscreenMode ? ' is-camera-fullscreen' : ''
        }`}
      >
        {!isFullscreenMode && (
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-slate-900">Camera Gesture Drawing Studio</h2>
            <span className="rounded bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {isReady ? 'Camera Active' : 'Camera Idle'}
            </span>
          </header>
        )}

        {!isFullscreenMode && (
          <p className="mb-4 text-sm text-slate-600">
            Drawing Surface: Live Camera Feed | Detected Gesture:{' '}
            <span className="font-semibold">{latestInput?.gesture ?? 'NO_HANDS'}</span>
          </p>
        )}

        <div className="camera-studio-grid grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
          <section className="camera-main-pane rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {cameraFrame}

            {(errors.camera || errors.handTracking) && (
              <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errors.camera && <p>Camera: {errors.camera}</p>}
                {errors.handTracking && <p>Hand Tracking: {errors.handTracking}</p>}
              </div>
            )}
          </section>

          <section
            className={`studio-control-panel-shell${
              isFullscreenMode ? ' studio-essential-popup' : ''
            }${isFullscreenMode && !showEssentialPanel ? ' is-hidden' : ''}`}
          >
            {isFullscreenMode && (
              <div className="essential-popup-header">
                <h3>Essential Edit Panel</h3>
                <button type="button" onClick={closeEssentialPanel}>
                  Close
                </button>
              </div>
            )}

            <HandTracker
              videoRef={videoRef}
              canvasRef={overlayRef}
              enabled={isReady}
              compactMode={isFullscreenMode}
            />
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-slate-900">Live Camera + Gesture</h2>
        <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
          {isReady ? 'Camera Active' : 'Camera Idle'}
        </span>
      </header>

      <p className="mb-2 text-xs text-slate-600">
        Detected gesture: <span className="font-semibold">{latestInput?.gesture ?? 'NO_HANDS'}</span>
      </p>

      {cameraFrame}

      <div className="mt-3">
        <HandTracker videoRef={videoRef} canvasRef={overlayRef} enabled={isReady} />
      </div>
    </section>
  );
}
