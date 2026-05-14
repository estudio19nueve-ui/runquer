import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useRunStore } from '../store/useRunStore';
import * as turf from '@turf/turf';

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[TaskManager] Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    if (locations && locations.length > 0) {
      const state = useRunStore.getState();
      
      if (!state.isRecording) {
        return; // Ignore updates if not actively recording
      }

      // Process each location received in the background batch
      for (const location of locations) {
        const newPos: [number, number] = [location.coords.longitude, location.coords.latitude];
        const currentTime = location.timestamp;

        let newDistance = state.totalDistance;

        // Calculate distance from last route point using Turf.js
        if (state.route.length > 0) {
          const lastPoint = state.route[state.route.length - 1];
          const from = turf.point([lastPoint[0], lastPoint[1]]);
          const to = turf.point(newPos);
          const distanceKM = turf.distance(from, to, { units: 'kilometers' });
          
          if (!isNaN(distanceKM) && distanceKM > 0) {
             newDistance += distanceKM * 1000; // meters
          }
        }

        // Calculate Pace
        let currentPace = 0;
        
        // Priority 1: Sensor speed (fastest response)
        if (location.coords.speed && location.coords.speed > 0.5) {
           currentPace = (1 / (location.coords.speed * 3.6)) * 60; // min/km
        } 
        // Priority 2: Mathematical fallback (essential for Fake GPS)
        else if (state.route.length > 0) {
          const lastPoint = state.route[state.route.length - 1];
          const timeDiffSeconds = (currentTime - lastPoint[2]) / 1000;
          
          if (timeDiffSeconds > 0) {
            const p1 = turf.point([lastPoint[0], lastPoint[1]]);
            const p2 = turf.point(newPos);
            const distMeters = turf.distance(p1, p2, { units: 'meters' });
            
            if (distMeters > 1) { // Only if moved more than 1m
              const speedMps = distMeters / timeDiffSeconds;
              if (speedMps > 0.5) {
                currentPace = (1 / (speedMps * 3.6)) * 60;
              }
            }
          }
        }

        let lastKmPaceDisplay = '--:--';
        // Cálculo del ritmo del último km usando newPos como punto FINAL (corrección del bug)
        // state.route aún no tiene newPos porque addPosition() se llama después
        if (newDistance > 200 && state.route.length > 3) {
          let distAcum = 0;
          let i = state.route.length - 1;
          
          // Primero acumular desde el último punto del store hasta newPos
          const lastStored = state.route[i];
          const distToNew = turf.distance(
            turf.point([lastStored[0], lastStored[1]]),
            turf.point(newPos),
            { units: 'meters' }
          );
          distAcum += distToNew;
          
          // Luego seguir acumulando hacia atrás en la ruta
          while (i > 0 && distAcum < 1000) {
            const p1 = turf.point([state.route[i][0], state.route[i][1]]);
            const p2 = turf.point([state.route[i-1][0], state.route[i-1][1]]);
            distAcum += turf.distance(p1, p2, { units: 'meters' });
            i--;
          }
          
          if (distAcum >= 100) {
            // El tiempo final es currentTime, el inicial es el punto i en la ruta
            const startTime = state.route[i][2];
            const timeDiff = currentTime - startTime;
            const paceMin = (timeDiff / 1000 / 60) / (distAcum / 1000);
            if (!isNaN(paceMin) && paceMin > 2 && paceMin < 30) {
              const mins = Math.floor(paceMin);
              const secs = Math.floor((paceMin - mins) * 60);
              lastKmPaceDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          }
        }

        // Update Store
        state.addPosition(newPos);
        state.updateStats({ 
          totalDistance: newDistance, 
          currentPace: currentPace, 
          lastKmPace: lastKmPaceDisplay 
        });
      }
    }
  }
});
