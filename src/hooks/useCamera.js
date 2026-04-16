import { useCallback, useEffect, useRef, useState } from 'react';

const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false
};

export function useCamera(videoRef) {
  const streamRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt');
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsReady(false);
  }, [videoRef]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API is not supported in this browser.');
      setPermissionState('denied');
      setIsReady(false);
      return;
    }

    stopCamera();
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPermissionState('granted');
      setIsReady(true);
    } catch (requestError) {
      if (requestError?.name === 'NotAllowedError' || requestError?.name === 'SecurityError') {
        setPermissionState('denied');
        setError('Camera permission denied. Please allow access and reload the page.');
      } else if (
        requestError?.name === 'NotFoundError' ||
        requestError?.name === 'DevicesNotFoundError'
      ) {
        setError('No camera was detected on this device.');
      } else {
        setError(`Unable to access camera: ${requestError?.message ?? 'Unknown error'}`);
      }

      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, [stopCamera, videoRef]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    startCamera,
    stopCamera,
    isReady,
    isLoading,
    permissionState,
    error,
    streamRef
  };
}
