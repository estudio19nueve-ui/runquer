import { supabase } from '../lib/supabase';
import * as turf from '@turf/turf';

export interface ExternalActivityInput {
  userId: string;
  sourceProvider: 'native_gps' | 'apple_health' | 'strava' | 'garmin';
  externalActivityId: string;
  startTime: string; // ISO String (UTC)
  endTime: string; // ISO String (UTC)
  distanceMeters: number;
  durationSeconds: number;
  gpsLineString?: [number, number][]; // Array de [longitud, latitud]
  metadata?: any;
  conqueredArea?: number; // Opcional, área en m2 si ya se calculó
  name?: string;
}

export interface ImportResult {
  runId: string;
  isDuplicate: boolean;
}

export const externalImportService = {
  /**
   * Ejecuta el algoritmo heurístico de de-duplicación espacio-temporal.
   * Retorna el run_id enlazado si es un duplicado, o null si es una actividad única.
   */
  async checkForDuplicateActivity(input: ExternalActivityInput): Promise<string | null> {
    const { userId, sourceProvider, externalActivityId, startTime, durationSeconds, distanceMeters, gpsLineString } = input;

    // 1. Verificación rápida de duplicado exacto por ID externo en external_activities
    const { data: exactMatch, error: exactError } = await supabase
      .from('external_activities')
      .select('run_id')
      .eq('user_id', userId)
      .eq('source_provider', sourceProvider)
      .eq('external_activity_id', externalActivityId)
      .maybeSingle();

    if (exactMatch?.run_id) {
      console.log(`[De-duplication] Match exacto encontrado para ID ${externalActivityId} (${sourceProvider})`);
      return exactMatch.run_id;
    }

    // 2. Definir ventanas de tolerancia heurística
    const startWindowSec = 5 * 60; // 5 minutos de ventana
    const startTimeDate = new Date(startTime);
    const startRangeLower = new Date(startTimeDate.getTime() - startWindowSec * 1000).toISOString();
    const startRangeUpper = new Date(startTimeDate.getTime() + startWindowSec * 1000).toISOString();

    const durationTolerance = 0.03; // 3% de tolerancia en duración
    const durationMin = Math.floor(durationSeconds * (1 - durationTolerance));
    const durationMax = Math.ceil(durationSeconds * (1 + durationTolerance));

    const distanceTolerance = 0.05; // 5% de tolerancia en distancia
    const distanceMin = distanceMeters * (1 - distanceTolerance);
    const distanceMax = distanceMeters * (1 + distanceTolerance);

    // 3. Buscar candidatos potenciales en la base de datos por tiempo y métricas
    const { data: candidates, error: candidateError } = await supabase
      .from('external_activities')
      .select('run_id, raw_start_time, raw_duration, raw_distance, raw_gps_line')
      .eq('user_id', userId)
      .gte('raw_start_time', startRangeLower)
      .lte('raw_start_time', startRangeUpper)
      .gte('raw_duration', durationMin)
      .lte('raw_duration', durationMax)
      .gte('raw_distance', distanceMin)
      .lte('raw_distance', distanceMax);

    if (candidateError) {
      console.error("[De-duplication] Error consultando candidatos:", candidateError);
      return null;
    }

    if (!candidates || candidates.length === 0) {
      return null; // Actividad única garantizada (métricamente)
    }

    // 4. Validación espacial usando Turf.js si hay coordenadas disponibles
    if (gpsLineString && gpsLineString.length > 1) {
      const inputStart = gpsLineString[0];
      const inputEnd = gpsLineString[gpsLineString.length - 1];

      for (const candidate of candidates) {
        // Ignorar si el candidato no tiene run_id asociado
        if (!candidate.run_id) continue;

        // Si el candidato tiene ruta GPS, comparamos los extremos
        if (candidate.raw_gps_line && candidate.raw_gps_line.coordinates) {
          const candCoords = candidate.raw_gps_line.coordinates;
          if (candCoords.length > 1) {
            const candStart = candCoords[0];
            const candEnd = candCoords[candCoords.length - 1];

            // Distancia de inicio y fin en metros
            const startDist = turf.distance(turf.point(inputStart), turf.point(candStart), { units: 'meters' });
            const endDist = turf.distance(turf.point(inputEnd), turf.point(candEnd), { units: 'meters' });

            // Si los extremos están dentro de la tolerancia de 150m, es un duplicado espacial
            if (startDist <= 150 && endDist <= 150) {
              console.log(`[De-duplication] Duplicado espacial detectado. Dist Inicio: ${startDist.toFixed(1)}m, Fin: ${endDist.toFixed(1)}m. Run ID: ${candidate.run_id}`);
              return candidate.run_id;
            }
          }
        }
      }
    }

    // 5. Fallback: Si no hay coordenadas GPS pero la hora de inicio y duración coinciden extremadamente cerca
    // (ej. diferencia menor a 60 segundos y distancia menor a 2%), asumimos coincidencia
    for (const candidate of candidates) {
      if (!candidate.run_id) continue;

      const candStartTime = new Date(candidate.raw_start_time).getTime();
      const timeDiff = Math.abs(candStartTime - startTimeDate.getTime()) / 1000; // segundos
      const distDiffPercent = Math.abs(candidate.raw_distance - distanceMeters) / distanceMeters;

      if (timeDiff <= 60 && distDiffPercent <= 0.02) {
        console.log(`[De-duplication] Match por fallback temporal/métrico muy cercano (${timeDiff}s dif, ${(distDiffPercent * 100).toFixed(1)}% dist). Run ID: ${candidate.run_id}`);
        return candidate.run_id;
      }
    }

    return null;
  },

  /**
   * Importa una actividad externa. 
   * Crea una nueva carrera (run) si es única, o la asocia a una existente si es duplicada.
   */
  async importExternalActivity(input: ExternalActivityInput): Promise<ImportResult> {
    const {
      userId,
      sourceProvider,
      externalActivityId,
      startTime,
      endTime,
      distanceMeters,
      durationSeconds,
      gpsLineString,
      metadata = {},
      conqueredArea = 0,
      name
    } = input;

    // 1. Verificar duplicidad
    const duplicateRunId = await this.checkForDuplicateActivity(input);

    if (duplicateRunId) {
      // Registrar la actividad externa enlazada al Run existente (sin duplicar juego)
      const { error: extError } = await supabase
        .from('external_activities')
        .insert({
          run_id: duplicateRunId,
          user_id: userId,
          source_provider: sourceProvider,
          external_activity_id: externalActivityId,
          raw_start_time: startTime,
          raw_end_time: endTime,
          raw_distance: distanceMeters,
          raw_duration: durationSeconds,
          raw_gps_line: gpsLineString ? { type: 'LineString', coordinates: gpsLineString } : null,
          metadata: metadata
        });

      // Si da error por llave única (concurrencia), ignoramos pacíficamente
      if (extError && extError.code !== '23505') {
        throw extError;
      }

      return { runId: duplicateRunId, isDuplicate: true };
    }

    // 2. Si no es duplicado, calcular la conquista territorial si hay coordenadas GPS
    let finalConqueredArea = conqueredArea || 0;
    if (gpsLineString && gpsLineString.length > 1) {
      try {
        const geojson = JSON.stringify({ type: 'LineString', coordinates: gpsLineString });
        const { data: rpcData, error: rpcError } = await supabase.rpc('conquer_h3_territory', {
          p_user_id: userId,
          p_route_geojson: geojson
        });
        if (rpcError) {
          console.error('[Import Service] Error al ejecutar conquer_h3_territory:', rpcError);
        } else {
          const stats = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          finalConqueredArea = stats?.total_area_new || 0;
          console.log(`[Import Service] Conquista procesada. Área nueva: ${finalConqueredArea} m²`);
        }
      } catch (err) {
        console.error('[Import Service] Excepción al ejecutar conquer_h3_territory:', err);
      }
    }

    // 3. Crear el Run lógico del juego
    const runName = name || `Carrera con ${sourceProvider.charAt(0).toUpperCase() + sourceProvider.slice(1)}`;
    const { data: newRun, error: runError } = await supabase
      .from('runs')
      .insert({
        user_id: userId,
        path: gpsLineString ? { type: 'LineString', coordinates: gpsLineString } : null,
        area_sqm: finalConqueredArea,
        distance_meters: distanceMeters,
        duration: durationSeconds,
        name: runName
      })
      .select('id')
      .single();

    if (runError) {
      throw runError;
    }

    // 3.5 Vincular los territorios conquistados con la nueva carrera
    if (newRun?.id) {
      try {
        await supabase
          .from('territories')
          .update({ run_id: newRun.id })
          .eq('user_id', userId)
          .is('run_id', null);
      } catch (linkError) {
        console.warn('[Import Service] Error al vincular territorios a la carrera:', linkError);
      }
    }

    // 4. Registrar la actividad externa enlazada al nuevo Run
    const { error: extError } = await supabase
      .from('external_activities')
      .insert({
        run_id: newRun.id,
        user_id: userId,
        source_provider: sourceProvider,
        external_activity_id: externalActivityId,
        raw_start_time: startTime,
        raw_end_time: endTime,
        raw_distance: distanceMeters,
        raw_duration: durationSeconds,
        raw_gps_line: gpsLineString ? { type: 'LineString', coordinates: gpsLineString } : null,
        metadata: metadata
      });

    if (extError) {
      // Si la inserción del log falla, intentamos hacer rollback del run creado
      await supabase.from('runs').delete().eq('id', newRun.id);
      throw extError;
    }

    return { runId: newRun.id, isDuplicate: false };
  }
};
