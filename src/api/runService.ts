import { supabase } from '../lib/supabase';

export interface Run {
  id: string;
  name?: string;
  path: any;
  area_sqm: number;
  distance_meters: number;
  duration: number; // segundos
  created_at: string;
}

export const runService = {
  /**
   * Obtiene el historial de carreras del usuario actual.
   */
  async getMyRuns(): Promise<Run[]> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Run[];
  },

  /**
   * Guarda una nueva carrera en el historial.
   */
  async saveRun(path: any, area: number, distance: number = 0, duration: number = 0, name?: string): Promise<Run> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data, error } = await supabase.from('runs').insert({
      path: path,
      area_sqm: area,
      distance_meters: distance,
      duration: duration,
      name: name,
      user_id: user.id
    }).select().single();

    if (error) throw error;

    // Registrar en external_activities para que el sistema de-duplique futuras importaciones (HealthKit/Strava)
    if (data?.id) {
      try {
        const startTime = new Date(Date.now() - duration * 1000).toISOString();
        const endTime = new Date().toISOString();
        await supabase.from('external_activities').insert({
          run_id: data.id,
          user_id: user.id,
          source_provider: 'native_gps',
          external_activity_id: `native_${data.id}`,
          raw_start_time: startTime,
          raw_end_time: endTime,
          raw_distance: distance,
          raw_duration: duration,
          raw_gps_line: path
        });
        console.log(`[RunService] Registro de de-duplicación nativo creado para run ${data.id}`);
      } catch (extError) {
        console.warn('[RunService] Error no crítico al registrar actividad para de-duplicación:', extError);
      }
    }

    return data as Run;
  }

};
