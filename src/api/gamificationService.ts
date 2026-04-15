import { supabase } from '../lib/supabase';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  earned_at?: string;
}

/**
 * Servicio para gestionar la experiencia, niveles e insignias.
 */
export const gamificationService = {
  async getMyProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('experience, level, territory_color, username')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateTerritoryColor(color: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ territory_color: color })
      .eq('id', user.id);

    if (error) throw error;
  },

  async getMyAchievements(): Promise<Achievement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_achievements')
      .select('earned_at, achievements (*)')
      .eq('user_id', user.id);

    if (error) throw error;
    
    return data.map(ua => ({
      ...ua.achievements,
      earned_at: ua.earned_at
    })) as Achievement[];
  }
};
