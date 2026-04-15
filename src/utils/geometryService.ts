import * as turf from '@turf/turf';
import { Position } from '../store/useRunStore';

export const MIN_AREA_SQM = 500;
export const MAX_LOOP_DISTANCE_M = 50;

/**
 * Servicio encargado de la lógica geométrica del juego usando Turf.js
 */
export const geometryService = {
  /**
   * Verifica si la ruta actual ha cerrado un bucle.
   * Compara la primera coordenada con la última.
   */
  isClosedLoop: (route: Position[]): boolean => {
    if (route.length < 10) return false; // Evitamos cierres accidentales con pocos puntos

    const start = turf.point(route[0]);
    const end = turf.point(route[route.length - 1]);
    
    const distance = turf.distance(start, end, { units: 'meters' });
    return distance < MAX_LOOP_DISTANCE_M;
  },

  /**
   * Convierte una serie de puntos en un polígono y calcula su área.
   */
  createAndValidatePolygon: (route: Position[]): { 
    polygon: turf.helpers.Feature<turf.helpers.Polygon> | null, 
    area: number, 
    isValid: boolean 
  } => {
    if (route.length < 3) return { polygon: null, area: 0, isValid: false };

    // Cerrar el anillo para Turf (el primer y último punto deben ser iguales)
    const ring = [...route, route[0]];
    
    try {
      const polygon = turf.polygon([ring]);
      const area = turf.area(polygon);
      
      return {
        polygon,
        area,
        isValid: area >= MIN_AREA_SQM
      };
    } catch (error) {
      console.error('Error creando polígono:', error);
      return { polygon: null, area: 0, isValid: false };
    }
  },

  /**
   * Lógica de resolución de conflictos (Robo de territorio)
   * @param attackerPoly Polígono del atacante
   * @param defenderPoly Polígono del defensor
   * @param defenderLayers Capas actuales del defensor
   */
  calculateCombatOutcome: (
    attackerPoly: turf.helpers.Feature<turf.helpers.Polygon>, 
    defenderPoly: turf.helpers.Feature<turf.helpers.Polygon>, 
    defenderLayers: number
  ) => {
    // Verificar si hay solapamiento real
    const intersection = turf.intersect(turf.featureCollection([attackerPoly, defenderPoly]));
    
    if (!intersection) return { type: 'NONE' };

    if (defenderLayers > 1) {
      // El defensor tiene "escudos" (capas extra)
      return {
        type: 'DAMAGE',
        defenderNewLayers: defenderLayers - 1
      };
    } else {
      // Robo total: Recortamos el área del defensor y la sumamos al atacante
      const newDefenderPoly = turf.difference(defenderPoly, attackerPoly);
      const newAttackerPoly = turf.union(attackerPoly, defenderPoly);

      return {
        type: 'STEAL',
        newDefenderPoly,
        newAttackerPoly
      };
    }
  }
};
