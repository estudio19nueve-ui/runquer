import { supabase } from '../lib/supabase';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_area_sqm: number;
  total_territories: number;
  last_conquest: string;
  country_code?: string;
}

/**
 * Servicio para gestionar el ranking y estadísticas de usuarios.
 */
export const rankingService = {
  /**
   * Obtiene la tabla de líderes filtrada por periodo.
   * @param period 'weekly' | 'monthly' | 'total'
   */
  async getLeaderboard(period: 'weekly' | 'monthly' | 'total' = 'total'): Promise<LeaderboardEntry[]> {
    try {
      // 1. Si es total, usamos la vista optimizada de la base de datos
      if (period === 'total') {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('*')
          .order('total_area_sqm', { ascending: false });
        
        if (error) throw error;
        return (data || []).map(item => ({ ...item, country_code: item.country_code || 'ES' }));
      }

      // 2. Para semanal o mensual, calculamos dinámicamente desde la tabla 'runs'
      const now = new Date();
      let startDate = new Date();

      if (period === 'weekly') {
        // Lunes a las 00:00:00
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'monthly') {
        // Día 1 del mes a las 00:00:00
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      }

      // Consultamos las carreras en ese rango
      const { data: runs, error: runsError } = await supabase
        .from('runs')
        .select('user_id, distance_meters, area_sqm')
        .gte('created_at', startDate.toISOString());

      if (runsError) throw runsError;

      // Si no hay carreras, devolvemos vacío
      if (!runs || runs.length === 0) return [];

      // Agregamos datos por usuario y recolectamos IDs
      const aggregation: Record<string, any> = {};
      const userIds = new Set<string>();

      runs.forEach((run: any) => {
        const uid = run.user_id;
        if (!uid) return;
        userIds.add(uid);
        
        if (!aggregation[uid]) {
          aggregation[uid] = {
            user_id: uid,
            total_area_sqm: 0,
            total_territories: 0,
          };
        }
        aggregation[uid].total_area_sqm += (run.area_sqm || 0);
        aggregation[uid].total_territories += 1;
      });

      // Buscamos los perfiles de esos usuarios (paso manual por falta de FK directa detectable)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, country_code')
        .in('id', Array.from(userIds));

      if (profilesError) {
        console.warn('Error al traer perfiles, se usará info genérica:', profilesError);
      }

      // Mapeamos los perfiles a la agregación
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const results = Object.values(aggregation).map(item => {
        const p = profileMap[item.user_id];
        return {
          ...item,
          username: p?.username || 'Explorador',
          country_code: p?.country_code || 'ES',
          last_conquest: ''
        };
      });

      // Ordenar por área y devolver
      return results.sort((a, b) => b.total_area_sqm - a.total_area_sqm);

    } catch (err) {
      console.error('Error en getLeaderboard:', err);
      return [];
    }
  }
};
