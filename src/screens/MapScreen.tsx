import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useNavigation } from '@react-navigation/native';
import { Shield, Zap } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { useRunStore } from '../store/useRunStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { geometryService } from '../utils/geometryService';
import { territoryService, Territory } from '../api/territoryService';
import { runService } from '../api/runService';
import { gamificationService } from '../api/gamificationService';

// IMPORTANTE: El token se carga desde el archivo .env (ignorado por Git)
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    route, 
    clearRoute,
    totalDistance,
    duration,
    currentPace,
    averagePace
  } = useRunStore();
  const { currentLocation, errorMsg } = useLocationTracker();
  
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userColor, setUserColor] = useState('#FF0000');

  // Obtener perfil y ID del usuario actual
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const profile = await gamificationService.getMyProfile();
        if (profile) setUserColor(profile.territory_color);
      }
    };
    fetchProfile();
  }, []);

  // Cargar territorios globales al iniciar
  const loadTerritories = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await territoryService.fetchTerritories();
      setTerritories(data);
    } catch (error) {
      console.error('Error al cargar territorios:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadTerritories();
  }, [loadTerritories]);

  // Detectar si el usuario está dentro de su propio territorio
  const currentMyTerritory = useMemo(() => {
    if (!currentLocation || !userId || territories.length === 0) return null;
    
    const point = turf.point([currentLocation.coords.longitude, currentLocation.coords.latitude]);
    return territories.find(t => 
      t.user_id === userId && 
      turf.booleanPointInPolygon(point, t.geom)
    );
  }, [currentLocation, userId, territories]);

  const handleAction = async () => {
    if (isRecording) {
      if (route.length < 10) {
        Alert.alert('Ruta demasiado corta', 'Sigue corriendo para poder conquistar.');
        stopRecording();
        return;
      }

      const { isValid, area, polygon } = geometryService.createAndValidatePolygon(route);
      
      if (geometryService.isClosedLoop(route) && isValid && polygon) {
        setIsLoading(true);
        try {
          // 1. Guardar en el historial de carreras
          const distance = turf.length(turf.lineString(route), { units: 'meters' });
          await runService.saveRun(polygon.geometry, area, distance);

          // 2. LLAMADA RPC PARA CONQUISTA Y COMBATE
          const result = await territoryService.conquerTerritory(polygon);
          
          if (result.success) {
            // Navegar a la pantalla de resumen
            navigation.navigate('Summary', {
              area: result.final_area,
              distance: distance,
              polygon: polygon
            });
            await loadTerritories(); // Recargar mapa
          }
        } catch (error: any) {
          console.error(error);
          Alert.alert('Error', error.message || 'Error al procesar la conquista.');
        } finally {
          setIsLoading(false);
          stopRecording();
        }
      } else {
        Alert.alert('No se pudo conquistar', 'Bucle no cerrado o área insuficiente (< 500m²)');
        stopRecording();
      }
    } else {
      clearRoute();
      startRecording();
    }
  };

  const handleUpgradeShield = async () => {
    if (!currentMyTerritory || isLoading) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('upgrade_territory', { 
        p_territory_id: currentMyTerritory.id 
      });

      if (error) throw error;
      if (data.success) {
        Alert.alert('¡Escudo Reforzado!', 'Has aumentado la defensa de tu territorio.');
        await loadTerritories();
      } else {
        Alert.alert('Atención', data.error);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo reforzar el escudo.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number) => {
    if (!pace || pace > 30 || pace < 1) return '-:--';
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: insets.bottom + 80, right: 15 }}
        scaleBarEnabled={true}
        scaleBarPosition={{ top: insets.top + 15, left: screenWidth / 2 - 30 }}
        pitchEnabled={true}
      >
        <Mapbox.Camera
          followZoomLevel={isRecording ? 18.5 : 15}
          followPitch={isRecording ? 80 : 45}
          animationDuration={2000}
          animationMode="flyTo"
          followUserLocation={true}
        />
        
        <Mapbox.RasterDemSource id="mapbox-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} />
        <Mapbox.Terrain sourceID="mapbox-dem" style={{ exaggeration: 1.5 }} />

        <Mapbox.UserLocation />

        <Mapbox.VectorSource id="mapbox-streets" url="mapbox://mapbox.mapbox-streets-v8">
          <Mapbox.FillExtrusionLayer
            id="buildings-3d"
            sourceLayerID="building"
            style={{
              fillExtrusionHeight: ['get', 'height'],
              fillExtrusionBase: ['get', 'min_height'],
              fillExtrusionColor: '#222',
              fillExtrusionOpacity: 0.8,
            }}
          />
        </Mapbox.VectorSource>

        {territories.length > 0 && (
          <Mapbox.ShapeSource id="heatmapSource" shape={{ type: 'FeatureCollection', features: territories.map(t => turf.centroid(t.geom)) as any }}>
            <Mapbox.HeatmapLayer
              id="territory-heat"
              style={{
                heatmapIntensity: 1,
                heatmapRadius: 20,
                heatmapColor: [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,0,0)',
                  1, userColor
                ]
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {route.length > 1 && (
          <Mapbox.ShapeSource id="routeSource" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: route }, properties: {} }}>
            <Mapbox.LineLayer id="routeLayer" style={{ lineColor: userColor, lineWidth: 4, lineJoin: 'round', lineCap: 'round' }} />
          </Mapbox.ShapeSource>
        )}

        {territories.map((t) => (
          <Mapbox.ShapeSource key={t.id} id={`source-${t.id}`} shape={t.geom}>
            <Mapbox.FillLayer 
              id={`fill-${t.id}`} 
              style={{ 
                fillOpacity: t.layers * 0.15,
                fillColor: t.user_id === userId ? userColor : '#444',
                fillOutlineColor: t.user_id === userId ? userColor : '#888'
              }} 
            />
            <Mapbox.FillExtrusionLayer 
              id={`extru-${t.id}`}
              style={{
                fillExtrusionHeight: t.layers * 2,
                fillExtrusionColor: t.user_id === userId ? userColor : '#444',
                fillExtrusionOpacity: 0.5
              }}
            />
          </Mapbox.ShapeSource>
        ))}
      </Mapbox.MapView>

      {isRecording && (
        <View style={[styles.statsOverlay, { top: insets.top + 80 }]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TIEMPO</Text>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISTANCIA</Text>
            <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(2)} km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RITMO</Text>
            <Text style={styles.statValue}>{formatPace(currentPace)}</Text>
            <Text style={styles.statSubValue}>Med: {formatPace(averagePace)}</Text>
          </View>
        </View>
      )}

      <View style={[styles.uiContainer, { bottom: insets.bottom + 15 }]}>
        {currentMyTerritory && !isRecording && (
          <TouchableOpacity 
            style={[styles.shieldButton, { borderColor: userColor }]} 
            onPress={handleUpgradeShield}
            disabled={isLoading || currentMyTerritory.layers >= 3}
          >
            <Shield size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.shieldText}>
              {currentMyTerritory.layers >= 3 ? 'DEFENSA MÁXIMA' : `REFORZAR (Nivel ${currentMyTerritory.layers})`}
            </Text>
          </TouchableOpacity>
        )}

        {isSyncing && <ActivityIndicator color={userColor} style={{ marginBottom: 10 }} />}
        
        <TouchableOpacity
          disabled={isLoading}
          style={[styles.button, isRecording ? styles.buttonStop : { backgroundColor: userColor }]}
          onPress={handleAction}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              {isRecording ? <Zap size={20} color="#FFF" style={{ marginRight: 8 }} /> : null}
              <Text style={styles.buttonText}>
                {isRecording ? 'FINALIZAR Y CONQUISTAR' : 'EMPEZAR CONQUISTA'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    flex: 1,
  },
  uiContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statsOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statSubValue: {
    color: '#FF0000',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonStop: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  shieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
  },
  shieldText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  }
});

export default MapScreen;
