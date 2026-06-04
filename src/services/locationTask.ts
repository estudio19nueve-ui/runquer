import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useRunStore } from '../store/useRunStore';
import * as turf from '@turf/turf';
import * as Speech from 'expo-speech';
import { getPreferredVoice, isAudioCuesEnabled } from '../utils/voiceHelper';

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

      let pendingSpeechText: string | null = null;

      // Process each location received in the background batch
      for (const location of locations) {
        const loopState = useRunStore.getState();
        const newPos: [number, number] = [location.coords.longitude, location.coords.latitude];
        const currentTime = location.timestamp;

        let newDistance = loopState.totalDistance;

        // Calculate distance from last route point using Turf.js
        if (loopState.route.length > 0) {
          const lastPoint = loopState.route[loopState.route.length - 1];
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
        else if (loopState.route.length > 0) {
          const lastPoint = loopState.route[loopState.route.length - 1];
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
        if (newDistance > 200 && loopState.route.length > 3) {
          let distAcum = 0;
          let i = loopState.route.length - 1;
          
          // Primero acumular desde el último punto del store hasta newPos
          const lastStored = loopState.route[i];
          const distToNew = turf.distance(
            turf.point([lastStored[0], lastStored[1]]),
            turf.point(newPos),
            { units: 'meters' }
          );
          distAcum += distToNew;
          
          // Luego seguir acumulando hacia atrás en la ruta
          while (i > 0 && distAcum < 1000) {
            const p1 = turf.point([loopState.route[i][0], loopState.route[i][1]]);
            const p2 = turf.point([loopState.route[i-1][0], loopState.route[i-1][1]]);
            distAcum += turf.distance(p1, p2, { units: 'meters' });
            i--;
          }
          
          if (distAcum >= 100) {
            // El tiempo final es currentTime, el inicial es el punto i en la ruta
            const startTime = loopState.route[i][2];
            const timeDiff = currentTime - startTime;
            const paceMin = (timeDiff / 1000 / 60) / (distAcum / 1000);
            if (!isNaN(paceMin) && paceMin > 2 && paceMin < 30) {
              const mins = Math.floor(paceMin);
              const secs = Math.floor((paceMin - mins) * 60);
              lastKmPaceDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          }
        }

        // Check for Audio Cue milestone (every exact 1000m)
        const currentKm = Math.floor(newDistance / 1000);
        if (currentKm > loopState.lastTriggeredKm) {
          let prevTimestamp = loopState.startTime || currentTime;
          if (loopState.lastTriggeredKm > 0 && loopState.milestones.length > 0) {
            const lastMilestone = loopState.milestones.find(m => m.km === loopState.lastTriggeredKm);
            if (lastMilestone) {
              prevTimestamp = lastMilestone.timestamp;
            }
          }

          const splitTimeMs = currentTime - prevTimestamp;
          const splitTimeSeconds = Math.max(1, Math.floor(splitTimeMs / 1000));
          const paceMin = splitTimeSeconds / 60;
          const mins = Math.floor(paceMin);
          const secs = Math.round((paceMin - mins) * 60);

          let totalTimeSeconds = 0;
          if (loopState.startTime) {
            totalTimeSeconds = Math.floor((currentTime - loopState.startTime) / 1000);
          }
          const totalMins = Math.floor(totalTimeSeconds / 60);
          const totalSecs = totalTimeSeconds % 60;

          const kmSpeechText = `Kilómetro ${currentKm}. `;
          const totalTimeSpeechText = totalMins > 0 
            ? `Tiempo acumulado, ${totalMins} ${totalMins === 1 ? 'minuto' : 'minutos'}${totalSecs > 0 ? ` con ${totalSecs} segundos` : ''}. `
            : `Tiempo acumulado, ${totalSecs} segundos. `;
          const splitPaceSpeechText = `Ritmo del último kilómetro, ${mins} ${mins === 1 ? 'minuto' : 'minutos'}${secs > 0 ? ` y ${secs} segundos` : ''}.`;

          pendingSpeechText = `${kmSpeechText}${totalTimeSpeechText}${splitPaceSpeechText}`;

          loopState.addMilestone(currentKm, currentTime);
          loopState.setLastTriggeredKm(currentKm);
        }

        // Update Store
        loopState.addPosition(newPos, currentTime);
        loopState.updateStats({ 
          totalDistance: newDistance, 
          currentPace: currentPace, 
          lastKmPace: lastKmPaceDisplay 
        });
      }

      // Speak only the latest milestone from this batch
      if (pendingSpeechText) {
        try {
          const enabled = await isAudioCuesEnabled();
          if (enabled) {
            const preferredVoice = await getPreferredVoice();
            const speakOptions: Speech.SpeechOptions = {
              language: 'es-ES',
              rate: 0.95,
              pitch: 1.0,
            };
            if (preferredVoice) {
              speakOptions.voice = preferredVoice;
            }
            
            await Speech.stop(); // Stop any currently playing speech to avoid overlaps
            Speech.speak(pendingSpeechText, speakOptions);
            console.log(`[AudioCue] Spoke (latest batch): ${pendingSpeechText} using voice: ${preferredVoice || 'default'}`);
          }
        } catch (speechError) {
          console.error("[AudioCue] Error invoking Speech.speak:", speechError);
        }
      }
    }
  }
});
