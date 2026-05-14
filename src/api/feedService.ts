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
   * Obtiene los últimos eventos globales e intenta cargar rutas para los resúmenes.
   */
  async getGlobalFeed(): Promise<FeedEvent[]> {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error al obtener el feed:', error);
      throw error;
    }

    const events = data as any[];

    // Para cada evento de tipo SUMMARY, intentamos cargar la ruta de la carrera
    const enrichedEvents = await Promise.all(events.map(async (event) => {
      if (event.event_type === 'RUN_SUMMARY' && event.content.startsWith('SUMMARY|')) {
        const parts = event.content.split('|');
        const runId = parts[parts.length - 1];
        if (runId) {
          const { data: runData } = await supabase
            .from('runs')
            .select('path')
            .eq('id', runId)
            .single();
          
          return { ...event, runPath: runData?.path?.coordinates || null };
        }
      }
      return event;
    }));

    return enrichedEvents;
  },

  /**
   * Publica un resumen de actividad en el feed global.
   */
  async postActivitySummary(userId: string, area: number, distanceKm: number, pace: string, runId?: string) {
    // El contenido incluye el ID de la carrera para poder abrirla
    const content = `SUMMARY|${area}|${distanceKm}|${pace}|${runId || ''}`;

    const { error } = await supabase
      .from('activity_feed')
      .insert({
        user_id: userId,
        event_type: 'RUN_SUMMARY',
        content: content
      });

    if (error) {
      console.error('Error al publicar resumen:', error);
    }
  }
};
