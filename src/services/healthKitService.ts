import HealthKit, { WorkoutActivityType, WorkoutTypeIdentifier } from '@kingstinct/react-native-healthkit';
import { externalImportService } from '../api/externalImportService';

export const healthKitService = {
  /**
   * Inicializa HealthKit y solicita los permisos de usuario en iOS.
   */
  async initializeHealthKit(): Promise<boolean> {
    try {
      const isAvailable = await HealthKit.isHealthDataAvailableAsync();
      if (!isAvailable) {
        console.warn("[HealthKit] No está disponible en este dispositivo");
        return false;
      }
      
      const success = await HealthKit.requestAuthorization({
        toRead: [WorkoutTypeIdentifier]
      });
      
      console.log("[HealthKit] Autorización completada:", success);
      return success;
    } catch (err) {
      console.warn("[HealthKit] Error inicializando o acceso denegado:", err);
      return false;
    }
  },

  /**
   * Obtiene entrenos de correr (Running) completados en los últimos X días.
   */
  async getRunningWorkouts(daysBack: number = 14): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const results = await HealthKit.queryWorkoutSamples({
        limit: 100,
        filter: {
          workoutActivityType: WorkoutActivityType.running
        },
        ascending: false
      });

      // Filtrar por fecha manualmente por si acaso
      const runningWorkouts = results.filter(w => new Date(w.startDate) >= startDate);
      
      return runningWorkouts;
    } catch (err) {
      console.error("[HealthKit] Error cargando historial de entrenos:", err);
      throw err;
    }
  },

  /**
   * Sincroniza los entrenos desde HealthKit hacia el backend (Supabase).
   */
  async syncWorkouts(userId: string): Promise<{ imported: number, skipped: number, errors: number }> {
    console.log(`[HealthKit Sync] Iniciando sincronización para el usuario: ${userId}`);
    
    const isAuthorized = await this.initializeHealthKit();
    if (!isAuthorized) {
      throw new Error("Permisos de HealthKit denegados o no disponibles.");
    }

    try {
      const workouts = await this.getRunningWorkouts(30);
      console.log(`[HealthKit Sync] Encontradas ${workouts.length} carreras en HealthKit.`);

      const syncResult = { imported: 0, skipped: 0, errors: 0 };

      for (const workout of workouts) {
        // En la nueva API, totalDistance puede tener el valor en quantity.
        const distanceVal = workout.totalDistance?.value || 0;
        
        // Si no hay distancia significativa, saltar
        if (distanceVal < 100) {
          syncResult.skipped++;
          continue;
        }

        // Determinar duración en segundos
        let elapsedSeconds = 0;
        if (workout.duration && typeof workout.duration === 'object' && workout.duration.value) {
            elapsedSeconds = workout.duration.value;
        } else if (typeof workout.duration === 'number') {
            elapsedSeconds = workout.duration;
        } else if (workout.endDate && workout.startDate) {
            elapsedSeconds = (new Date(workout.endDate).getTime() - new Date(workout.startDate).getTime()) / 1000;
        }

        const startIsoString = new Date(workout.startDate).toISOString();
        const endIsoString = workout.endDate 
          ? new Date(workout.endDate).toISOString() 
          : new Date(new Date(workout.startDate).getTime() + elapsedSeconds * 1000).toISOString();

        const runData = {
          userId,
          sourceProvider: 'apple_health' as const,
          externalActivityId: workout.uuid || `hk-${new Date(workout.startDate).getTime()}`,
          startTime: startIsoString,
          endTime: endIsoString,
          distanceMeters: distanceVal,
          durationSeconds: elapsedSeconds,
          gpsLineString: undefined,
          name: `Carrera con Apple Health`
        };

        const result = await externalImportService.importExternalActivity(runData);
        if (result && !result.isDuplicate) {
          syncResult.imported++;
        } else {
          syncResult.skipped++;
        }
      }

      console.log(`[HealthKit Sync] Fin sincronización: Importadas: ${syncResult.imported}, Omitidas: ${syncResult.skipped}`);
      return syncResult;

    } catch (error) {
      console.error("[HealthKit Sync] Error de sincronización general:", error);
      throw error;
    }
  }
};
