import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';
import * as turf from '@turf/turf';
import { useRunStore } from '../store/useRunStore';

/**
 * Hook para rastrear la ubicación del usuario y actualizar el store de la carrera.
 */
export const useLocationTracker = () => {
  const { isRecording, addPosition, updateStats, startTime, route, totalDistance } = useRunStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const lastPositionRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let timer: NodeJS.Timeout | null = null;

    if (isRecording && startTime) {
      timer = setInterval(() => {
        const now = Date.now();
        const durationSeconds = Math.floor((now - startTime) / 1000);
        
        // Calcular ritmo medio (min/km)
        let averagePace = 0;
        if (totalDistance > 5) {
          averagePace = (durationSeconds / 60) / (totalDistance / 1000);
        }

        updateStats({ duration: durationSeconds, averagePace });
      }, 1000);
    }

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado');
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, 
          distanceInterval: 5, 
        },
        (location) => {
          const newPos: [number, number] = [location.coords.longitude, location.coords.latitude];
          setCurrentLocation(location);
          
          if (isRecording) {
            let distanceInc = 0;
            if (lastPositionRef.current) {
              const from = turf.point(lastPositionRef.current);
              const to = turf.point(newPos);
              distanceInc = turf.distance(from, to, { units: 'meters' });
            }
            
            // Ritmo actual (muy simplificado, basado en el último intervalo)
            // En una versión real usaríamos una cola de los últimos 20 seg.
            let currentPace = 0;
            if (distanceInc > 0.5) {
               // ritmo = (tiempo_en_min) / (dist_en_km)
               const timeInMin = 2 / 60; // timeInterval es 2000ms
               currentPace = timeInMin / (distanceInc / 1000);
            }

            addPosition(newPos, distanceInc);
            updateStats({ currentPace });
            lastPositionRef.current = newPos;
          } else {
            lastPositionRef.current = null;
          }
        }
      );
    };

    startWatching();

    return () => {
      if (subscription) subscription.remove();
      if (timer) clearInterval(timer);
    };
  }, [isRecording, addPosition, updateStats, startTime, totalDistance]);

  return { errorMsg, currentLocation };
};
