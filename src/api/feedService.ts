import { supabase } from '../lib/supabase';

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

/**
 * Servicio para el Feed de Actividad Global.
 */
export const feedService = {
  /**
   * Obtiene los últimos eventos globales.
   */
  async getGlobalFeed(): Promise<FeedEvent[]> {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error al obtener el feed:', error);
      throw error;
    }

    return data as any[];
  }
};
