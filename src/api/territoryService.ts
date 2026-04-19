import { supabase } from '../lib/supabase';
import * as turf from '@turf/turf';

export interface Territory {
  id: string;
  user_id: string;
  hex_id: string;
  geom: any;
  area_sqm: number;
  layers: number;
  last_activity: string;
  profiles?: {
    territory_color: string;
  };
}

export const territoryService = {
  /**
   * Obtiene territorios con el color del dueño mediante un join.
   */
  async fetchTerritories(): Promise<Territory[]> {
    const { data, error } = await supabase
      .from('territories')
      .select('*, profiles(territory_color)')
      .order('last_activity', { ascending: false })
      .limit(2000);

    if (error) {
      console.error('Error fetching territories:', error);
      throw error;
    }

    const realTerritories = data as Territory[];
    
    // INYECCIÓN MOCK: Un puesto avanzado rival cerca del Retiro para demo visual
    const mockRival: Territory = {
      id: 'mock-rival-1',
      user_id: 'rival-id-007',
      hex_id: '8b39082ea6aafff',
      geom: {
        type: 'Polygon',
        coordinates: [[
          [-3.6826, 40.4154], [-3.6810, 40.4158], [-3.6794, 40.4154], 
          [-3.6794, 40.4146], [-3.6810, 40.4142], [-3.6826, 40.4146], [-3.6826, 40.4154]
        ]]
      },
      area_sqm: 1500,
      layers: 5, // Nivel máximo (muy opaco)
      last_activity: new Date().toISOString(),
      profiles: {
        territory_color: '#FF00FF' // Fucsia Neón
      }
    };

    return [...realTerritories, mockRival];
  },

  /**
   * Envía la ruta para procesar una conquista hexagonal masiva.
   * Llama a la nueva función RPC 'conquer_h3_territory'.
   */
  async conquerTerritory(route: turf.helpers.Feature<turf.helpers.LineString>): Promise<{ success: boolean; final_area: number }> {
    const geojson = JSON.stringify(route.geometry);

    const { data, error } = await supabase.rpc('conquer_h3_territory', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_route_geojson: geojson
    });

    if (error) {
      console.error('Error in conquer_h3_territory RPC:', error);
      throw error;
    }

    // Por ahora devolvemos success true si la función terminó sin error
    return {
      success: true,
      final_area: 0 // El área total se calcularía en el resumen si es necesario
    };
  }
};
