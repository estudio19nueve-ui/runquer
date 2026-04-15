import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { useRunStore } from '../store/useRunStore';

/**
 * Hook para rastrear la ubicación del usuario y actualizar el store de la carrera.
 */
export const useLocationTracker = () => {
  const { isRecording, addPosition } = useRunStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado');
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Actualizar cada 2 segundos
          distanceInterval: 5, // O cada 5 metros
        },
        (location) => {
          setCurrentLocation(location);
          
          if (isRecording) {
            addPosition([location.coords.longitude, location.coords.latitude]);
          }
        }
      );
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isRecording, addPosition]);

  return { errorMsg, currentLocation };
};
