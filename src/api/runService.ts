import { supabase } from '../lib/supabase';

export interface Run {
  id: string;
  path: any;
  area_sqm: number;
  distance_meters: number;
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
  async saveRun(path: any, area: number, distance: number = 0): Promise<void> {
    const { error } = await supabase.from('runs').insert({
      path: path,
      area_sqm: area,
      distance_meters: distance,
      user_id: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) throw error;
  }
};
