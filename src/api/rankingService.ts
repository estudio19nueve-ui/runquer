import { supabase } from '../lib/supabase';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_area_sqm: number;
  total_territories: number;
  last_conquest: string;
}

/**
 * Servicio para gestionar el ranking y estadísticas de usuarios.
 */
export const rankingService = {
  /**
   * Obtiene la tabla de líderes desde la vista SQL 'leaderboard'.
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_area_sqm', { ascending: false });

    if (error) {
      console.error('Error al obtener el ranking:', error);
      throw error;
    }

    return data as LeaderboardEntry[];
  }
};
