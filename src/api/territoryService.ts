import { supabase } from '../lib/supabase';
import { Feature, LineString } from 'geojson';

export interface Territory {
  id: string;
  user_id: string;
  geom: any;
  area_sqm: number;
  layers: number;
  profiles?: {
    username?: string;
    total_area?: number;
    territory_color: string;
  };
}

export const territoryService = {
  async fetchTerritories(): Promise<Territory[]> {
    try {
      console.log('Fetching territories from Supabase...');
      const { data, error } = await supabase
        .from('territories')
        .select('*, profiles(username, total_area, territory_color)')
        .limit(1000);

      if (error) {
        console.error('Supabase error fetching territories:', error);
        throw error;
      }
      console.log(`Fetched ${data?.length || 0} territories`);
      return (data || []) as Territory[];
    } catch (err) {
      console.error('Crash in fetchTerritories:', err);
      return [];
    }
  },

  async conquerTerritory(route: Feature<LineString>): Promise<{ success: boolean; final_area: number }> {
    const geojson = JSON.stringify(route.geometry);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    const { data, error } = await supabase.rpc('conquer_h3_territory', {
      p_user_id: userId,
      p_route_geojson: geojson
    });
    if (error) throw error;
    
    // El RPC devuelve una tabla, tomamos el primer resultado si existe
    const stats = Array.isArray(data) ? data[0] : data;
    return { 
      success: true, 
      final_area: stats?.total_area_new || 0 
    };
  }
};
