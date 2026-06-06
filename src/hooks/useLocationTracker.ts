import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useRunStore } from '../store/useRunStore';
import { LOCATION_TASK_NAME } from '../services/locationTask';

export const useLocationTracker = () => {
  const { isRecording, startTime, updateStats } = useRunStore();
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    
    const initForegroundLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ coords: loc.coords });

      // SIEMPRE actualizamos currentLocation (también durante la grabación)
      // El store (ruta) lo gestiona locationTask.ts en background
      // Aquí solo necesitamos los datos de ubicación para calcular el ritmo en la UI
      locationSubscription = await Location.watchPositionAsync(
        { 
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (loc) => {
          setCurrentLocation({ coords: loc.coords });
        }
      );
    };

    initForegroundLocation();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    async function startTracking() {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission denied');
        return;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,          // Mínimo 5m entre puntos
        timeInterval: 3000,           // Máximo 3 segundos entre puntos
        deferredUpdatesInterval: 0,   // Impedir que el sistema operativo agrupe/demore actualizaciones
        deferredUpdatesDistance: 0,   // Entregar puntos al instante
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,  // Nunca pausar el GPS automáticamente
        activityType: Location.ActivityType.Fitness, // iOS: optimizado para running
        foregroundService: {
          notificationTitle: "Runquer",
          notificationBody: "Registrando tu ruta en segundo plano...",
          notificationColor: "#FF0000",
        },
      });


      console.log("[Location] Background tracking started successfully");
    }

    async function stopTracking() {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("[Location] Background tracking stopped");
      }
    }

    if (isRecording && startTime) {
      startTracking();
      
      timer = setInterval(() => {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        const { totalDistance } = useRunStore.getState();
        
        let averagePace = 0;
        if (totalDistance > 50 && durationSeconds > 10) {
          averagePace = (durationSeconds / 60) / (totalDistance / 1000);
        }
        
        updateStats({ duration: durationSeconds, averagePace });
      }, 1000);

    } else {
      stopTracking();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, startTime]);

  return { currentLocation };
};
