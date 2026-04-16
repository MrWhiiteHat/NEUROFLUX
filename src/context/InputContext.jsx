import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const INITIAL_INPUT = {
  handLandmarks: [],
  gesture: 'NO_HANDS',
  handsCount: 0,
  voiceCommand: '',
  timestamp: Date.now()
};

const INITIAL_STATUS = {
  cameraReady: false,
  voiceListening: false,
  speechSupported: true
};

const INITIAL_ERRORS = {
  camera: null,
  handTracking: null,
  voice: null
};

const InputContext = createContext(null);

export function InputProvider({ children }) {
  const [latestInput, setLatestInput] = useState(INITIAL_INPUT);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [errors, setErrors] = useState(INITIAL_ERRORS);

  const latestInputRef = useRef(INITIAL_INPUT);
  const lastUiSyncRef = useRef(0);

  const syncUiSnapshot = useCallback((force = false) => {
    const now = Date.now();

    if (force || now - lastUiSyncRef.current >= 120) {
      lastUiSyncRef.current = now;
      setLatestInput(latestInputRef.current);
    }
  }, []);

  const updateHandData = useCallback(
    (payload) => {
      const handLandmarks = payload?.handLandmarks ?? [];
      const gesture = payload?.gesture ?? 'NO_HANDS';
      const handsCount = payload?.handsCount ?? 0;

      const previous = latestInputRef.current;
      latestInputRef.current = {
        ...previous,
        handLandmarks,
        gesture,
        handsCount,
        timestamp: Date.now()
      };

      const changed = previous.gesture !== gesture || previous.handsCount !== handsCount;
      syncUiSnapshot(changed);
    },
    [syncUiSnapshot]
  );

  const updateVoiceCommand = useCallback(
    (voiceCommand) => {
      latestInputRef.current = {
        ...latestInputRef.current,
        voiceCommand: voiceCommand?.trim() ?? '',
        timestamp: Date.now()
      };

      syncUiSnapshot(true);
    },
    [syncUiSnapshot]
  );

  const updateStatus = useCallback((nextStatus) => {
    setStatus((previous) => ({
      ...previous,
      ...nextStatus
    }));
  }, []);

  const setError = useCallback((key, message) => {
    setErrors((previous) => ({
      ...previous,
      [key]: message
    }));
  }, []);

  const resetInput = useCallback(() => {
    const snapshot = {
      ...INITIAL_INPUT,
      timestamp: Date.now()
    };

    latestInputRef.current = snapshot;
    setLatestInput(snapshot);
  }, []);

  const getLatestInput = useCallback(() => latestInputRef.current, []);

  const contextValue = useMemo(
    () => ({
      latestInput,
      status,
      errors,
      updateHandData,
      updateVoiceCommand,
      updateStatus,
      setError,
      resetInput,
      getLatestInput
    }),
    [
      errors,
      getLatestInput,
      latestInput,
      resetInput,
      setError,
      status,
      updateHandData,
      updateStatus,
      updateVoiceCommand
    ]
  );

  return <InputContext.Provider value={contextValue}>{children}</InputContext.Provider>;
}

export function useInputContext() {
  const context = useContext(InputContext);

  if (!context) {
    throw new Error('useInputContext must be used inside InputProvider.');
  }

  return context;
}
