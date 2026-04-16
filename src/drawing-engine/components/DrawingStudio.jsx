import { CameraGestureDock } from './CameraGestureDock.jsx';

export function DrawingStudio() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(251,191,36,0.26),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(20,184,166,0.24),transparent_30%),linear-gradient(180deg,#fffdf7,#f8fafc_45%,#f3f4f6)] px-3 py-4 text-slate-900 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-4 rounded-2xl border border-amber-200 bg-white/70 px-5 py-4 shadow-sm backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
            NeuroFlux Camera Draw Studio
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Draw Directly Through Camera
          </h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600 sm:text-base">
            The white canvas workspace is removed. Your drawing now happens on top of the live camera
            feed using hand gestures and the draw controls.
          </p>
        </header>

        <CameraGestureDock mode="full" />
      </div>
    </div>
  );
}
