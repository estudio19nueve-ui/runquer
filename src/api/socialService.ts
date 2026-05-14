import { supabase } from '../lib/supabase';

export interface FollowStats {
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

export const socialService = {
  /**
   * Sigue a un usuario.
   */
  async followUser(followedId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        followed_id: followedId
      });

    if (error && error.code !== '23505') throw error; // Ignorar si ya se sigue
  },

  /**
   * Deja de seguir a un usuario.
   */
  async unfollowUser(followedId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followed_id', followedId);

    if (error) throw error;
  },

  /**
   * Verifica si el usuario actual sigue a otro.
   */
  async checkFollowing(followedId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('followed_id', followedId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  /**
   * Obtiene la lista de seguidores de un usuario.
   */
  async getFollowers(userId: string) {
    const { data, error } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(*)')
      .eq('followed_id', userId);
    
    if (error) throw error;
    return data.map(item => item.follower);
  },

  /**
   * Obtiene la lista de personas a las que sigue un usuario.
   */
  async getFollowing(userId: string) {
    const { data, error } = await supabase
      .from('follows')
      .select('followed:profiles!followed_id(*)')
      .eq('follower_id', userId);
    
    if (error) throw error;
    return data.map(item => item.followed);
  },

  /**
   * Da un "Keni" a una carrera.
   */
  async giveKeni(runId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('run_kenis')
      .insert({ run_id: runId, user_id: user.id });

    if (error && error.code !== '23505') throw error;
  },

  /**
   * Quita un "Keni" de una carrera.
   */
  async removeKeni(runId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('run_kenis')
      .delete()
      .eq('run_id', runId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Obtiene el conteo de Kenis y si el usuario actual ha dado uno.
   */
  async getKeniStats(runId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { count, error } = await supabase
      .from('run_kenis')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', runId);

    let hasKeni = false;
    if (user) {
      const { data } = await supabase
        .from('run_kenis')
        .select('id')
        .eq('run_id', runId)
        .eq('user_id', user.id)
        .maybeSingle();
      hasKeni = !!data;
    }

    return { count: count || 0, hasKeni };
  },

  /**
   * Obtiene los comentarios de una carrera.
   */
  async getComments(runId: string) {
    const { data, error } = await supabase
      .from('run_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Publica un comentario.
   */
  async postComment(runId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('run_comments')
      .insert({
        run_id: runId,
        user_id: user.id,
        content: content
      });

    if (error) throw error;
  },

  /**
   * Reporta contenido inapropiado.
   */
  async reportContent(reportedUserId: string, contentId: string, contentType: 'CHAT' | 'COMMENT' | 'ACTIVITY', reason: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        content_id: contentId,
        content_type: contentType,
        reason: reason
      });

    if (error) throw error;
  },

  /**
   * Bloquea a un usuario.
   */
  async blockUser(blockedId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: user.id,
        blocked_id: blockedId
      });

    if (error && error.code !== '23505') throw error;
  },

  /**
   * Obtiene la lista de IDs de usuarios bloqueados.
   */
  async getBlockedUsers(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);

    if (error) return [];
    return data.map(b => b.blocked_id);
  }
};
