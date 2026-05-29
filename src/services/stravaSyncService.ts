import { supabase } from '../lib/supabase';
import { externalImportService } from '../api/externalImportService';

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || 'TU_STRAVA_CLIENT_ID';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || 'TU_STRAVA_CLIENT_SECRET';

/**
 * Descodificador del algoritmo Google Polyline
 * Transforma una cadena comprimida en un array de coordenadas [longitud, latitud] compatible con Turf y PostGIS.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    // El formato original entrega [latitud, longitud]. Lo invertimos a [longitud, latitud] para GeoJSON.
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

export const stravaSyncService = {
  /**
   * Obtiene o refresca el token de acceso de Strava del usuario.
   */
  async getOrRefreshToken(userId: string): Promise<string> {
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .maybeSingle();

    if (error || !integration) {
      throw new Error("Strava no está vinculado.");
    }

    const now = new Date();
    const expiresAt = new Date(integration.expires_at);

    // Refrescar si el token expira en menos de 5 minutos
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log("[Strava Sync] Token expirado o próximo a expirar. Refrescando...");

      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al refrescar token de Strava: ${errorText}`);
      }

      const refreshData = await response.json();
      const newExpiresAt = new Date(refreshData.expires_at * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('user_integrations')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      if (updateError) throw updateError;

      return refreshData.access_token;
    }

    return integration.access_token;
  },

  /**
   * Sincroniza las carreras de Strava descargándolas e importándolas en Supabase.
   */
  async syncActivities(userId: string): Promise<{ imported: number; skipped: number; errors: number }> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // 1. Obtener token válido
      const accessToken = await this.getOrRefreshToken(userId);

      // 2. Determinar la marca de tiempo de la última sincronización
      const { data: lastActivity } = await supabase
        .from('external_activities')
        .select('raw_start_time')
        .eq('user_id', userId)
        .eq('source_provider', 'strava')
        .order('raw_start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      let afterTimestamp = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000); // 14 días por defecto
      if (lastActivity?.raw_start_time) {
        // Añadir 1 segundo para evitar descargar el último ya importado
        afterTimestamp = Math.floor(new Date(lastActivity.raw_start_time).getTime() / 1000) + 1;
      }

      // 3. Consultar la API de Strava
      console.log(`[Strava Sync] Descargando actividades desde timestamp: ${afterTimestamp}`);
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=30`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error consultando API de Strava: ${await response.text()}`);
      }

      const activities = await response.json();
      console.log(`[Strava Sync] Actividades obtenidas de la API: ${activities.length}`);

      // 4. Filtrar y procesar cada actividad
      for (const activity of activities) {
        // Sincronizar solo carreras (Running)
        const isRun = activity.type === 'Run' || activity.sport_type === 'Run';
        if (!isRun) continue;

        try {
          // Decodificar la polilínea si está disponible
          let gpsLine: [number, number][] | undefined = undefined;
          if (activity.map?.summary_polyline) {
            gpsLine = decodePolyline(activity.map.summary_polyline);
          }

          const elapsedSeconds = activity.elapsed_time || activity.moving_time || 0;
          const endIsoString = new Date(
            new Date(activity.start_date).getTime() + elapsedSeconds * 1000
          ).toISOString();

          const input = {
            userId: userId,
            sourceProvider: 'strava' as const,
            externalActivityId: activity.id.toString(),
            startTime: activity.start_date,
            endTime: endIsoString,
            distanceMeters: activity.distance || 0,
            durationSeconds: activity.moving_time || elapsedSeconds,
            gpsLineString: gpsLine,
            name: activity.name,
            metadata: {
              elevation_gain: activity.total_elevation_gain,
              average_heartrate: activity.average_heartrate,
              max_heartrate: activity.max_heartrate,
              suffer_score: activity.suffer_score,
            }
          };

          // Procesar con el motor de de-duplicación
          const result = await externalImportService.importExternalActivity(input);

          if (result.isDuplicate) {
            skipped++;
            console.log(`[Strava Sync] Actividad ${activity.id} omitida (duplicada)`);
          } else {
            imported++;
            console.log(`[Strava Sync] Actividad ${activity.id} importada con éxito. Run ID: ${result.runId}`);
          }

        } catch (actErr) {
          console.error(`[Strava Sync] Error importando actividad ${activity.id}:`, actErr);
          errors++;
        }
      }

    } catch (err) {
      console.error("[Strava Sync] Falló la sincronización general:", err);
      throw err;
    }

    return { imported, skipped, errors };
  }
};
