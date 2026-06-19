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

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, experience, level, territory_color, username, total_area, followers_count, following_count, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn('Error fetching detailed profile:', error);
        // Fallback simple si fallan las columnas nuevas
        const { data: basicData } = await supabase
          .from('profiles')
          .select('id, username, territory_color, avatar_url')
          .eq('id', user.id)
          .single();
        return basicData;
      }
      return data;
    } catch (e) {
      console.error('Crash in getMyProfile:', e);
      return null;
    }
  },

  async uploadAvatar(uri: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      // 1. Preparar FormData (Método estándar de React Native)
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      // 2. Subir a Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Obtener la URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 4. Actualizar el perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
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

  async updateUsername(username: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username })
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
      ...(ua.achievements as any),
      earned_at: ua.earned_at
    })) as Achievement[];
  },

  async getUserMedals(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_medals')
      .select('*')
      .eq('user_id', userId)
      .order('period_start', { ascending: false });

    if (error) {
      console.warn('Error fetching user medals:', error);
      return [];
    }
    return data || [];
  },

  async checkAndAwardMedals(): Promise<void> {
    try {
      const { error } = await supabase.rpc('check_and_award_medals');
      if (error) {
        console.warn('[GamificationService] RPC check_and_award_medals notice/warning:', error.message);
      }
    } catch (e) {
      console.warn('[GamificationService] Failsafe RPC execution failed (likely database not migrated yet):', e);
    }
  }
};

export function getLevelTitle(level: number): string {
  if (level <= 2) return "Observador Territorial";
  if (level <= 5) return "Técnico de Límites";
  if (level <= 8) return "Mediador de Solapamientos";
  if (level <= 12) return "Delegado de Fronteras";
  if (level <= 16) return "Administrador de Enclaves";
  if (level <= 20) return "Comisionado de Límites";
  if (level <= 25) return "Garante de Soberanía";
  if (level <= 30) return "Canciller del Territorio";
  return "Soberano del Tratado";
}
