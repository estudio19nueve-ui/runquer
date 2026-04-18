import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useRunStore } from '../store/useRunStore';
import { hexagonService } from './hexagonService';

export const LOCATION_TASK_NAME = 'background-location-task';

/**
 * Define la tarea de seguimiento en segundo plano en el nivel raíz.
 * Esto es OBLIGATORIO para que Android la encuentre en el arranque del proceso nativo.
 */
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Error en la tarea de segundo plano:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    // Obtenemos el acceso al estado de Zustand sin necesidad de hooks (fuera de React)
    const state = useRunStore.getState();
    
    if (state.isRecording && location) {
      const { latitude, longitude } = location.coords;
      
      // Añadimos la posición al Store para que se guarde en la ruta
      state.addPosition([longitude, latitude], 0);
    }
  }
});

/**
 * Inicia el rastreo en segundo plano con una notificación persistente (Android).
 */
export const startBackgroundTracking = async () => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permisos de ubicación en segundo plano denegados.');
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 1, // Sensibilidad alta de 1 metro
    foregroundService: {
      notificationTitle: "Runquer: Conquista Activa",
      notificationBody: "Registrando tu ruta en segundo plano...",
      notificationColor: "#FF0000",
    },
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
  });
};

/**
 * Detiene el rastreo en segundo plano.
 */
export const stopBackgroundTracking = async () => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};
