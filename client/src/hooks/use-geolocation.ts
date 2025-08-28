import { useState, useCallback, useEffect } from 'react';

interface GeolocationState {
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  isLoading: boolean;
  error: string | null;
  permission: PermissionState | null;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000, // Cache for 1 minute
};

export function useGeolocation(options: GeolocationOptions = DEFAULT_OPTIONS) {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    isLoading: false,
    error: null,
    permission: null,
  });

  // Check initial permission state
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState(prev => ({ ...prev, permission: result.state }));
      });
    }
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser.',
        isLoading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const successCallback = (position: GeolocationPosition) => {
      setState(prev => ({
        ...prev,
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        isLoading: false,
        error: null,
      }));
    };

    const errorCallback = (error: GeolocationPositionError) => {
      let errorMessage: string;
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable. Please check your internet connection.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.';
          break;
        default:
          errorMessage = 'An unknown error occurred while retrieving your location.';
          break;
      }

      setState(prev => ({
        ...prev,
        coordinates: null,
        isLoading: false,
        error: errorMessage,
      }));
    };

    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      { ...DEFAULT_OPTIONS, ...options }
    );
  }, [options]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      coordinates: null,
      isLoading: false,
      error: null,
      permission: null,
    });
  }, []);

  return {
    ...state,
    getCurrentPosition,
    clearError,
    reset,
    isSupported: !!navigator.geolocation,
  };
}