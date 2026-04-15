import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  content: string;
  username: string;
  created_at: string;
}

/**
 * Servicio de Chat Local basado en geolocalización.
 */
export const chatService = {
  /**
   * Obtiene mensajes en un radio determinado desde la posición del usuario.
   */
  async getLocalMessages(lng: number, lat: number, radiusMeters: number = 5000): Promise<ChatMessage[]> {
    const { data, error } = await supabase.rpc('get_local_messages', {
      p_lng: lng,
      p_lat: lat,
      p_radius: radiusMeters
    });
    
    if (error) {
      console.error('Error al obtener mensajes:', error);
      throw error;
    }
    
    return data as ChatMessage[];
  },

  /**
   * Envía un mensaje con la ubicación actual del usuario.
   */
  async sendMessage(content: string, lng: number, lat: number): Promise<void> {
    const { 
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Usuario no autenticado');

    const { error } = await supabase.from('messages').insert({
      content,
      location: `POINT(${lng} ${lat})`,
      user_id: user.id
    });
    
    if (error) {
      console.error('Error al enviar mensaje:', error);
      throw error;
    }
  }
};
