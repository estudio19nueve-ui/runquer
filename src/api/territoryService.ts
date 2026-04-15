import { supabase } from '../lib/supabase';
import * as turf from '@turf/turf';

export interface Territory {
  id: string;
  user_id: string;
  geom: any; // GeoJSON
  area_sqm: number;
  layers: number;
  last_activity: string;
}

export const territoryService = {
  /**
   * Obtiene todos los territorios activos para mostrar en el mapa.
   */
  async fetchTerritories(): Promise<Territory[]> {
    const { data, error } = await supabase
      .from('territories')
      .select('*');

    if (error) {
      console.error('Error fetching territories:', error);
      throw error;
    }

    return data as Territory[];
  },

  /**
   * Envía un polígono a la base de datos para intentar una conquista.
   * Llama a la función RPC 'conquer_territory'.
   */
  async conquerTerritory(polygon: turf.helpers.Feature<turf.helpers.Polygon>): Promise<{ success: boolean; final_area: number }> {
    const geojson = JSON.stringify(polygon.geometry);
    
    const { data, error } = await supabase.rpc('conquer_territory', {
      p_new_geom_geojson: geojson
    });

    if (error) {
      console.error('Error in conquer_territory RPC:', error);
      throw error;
    }

    return data as { success: boolean; final_area: number };
  }
};
