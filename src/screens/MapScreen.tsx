import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useNavigation } from '@react-navigation/native';
import { Shield, Zap, Cloud, Sun, Info } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { useRunStore } from '../store/useRunStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { territoryService, Territory } from '../api/territoryService';
import { runService } from '../api/runService';
import { gamificationService } from '../api/gamificationService';
import { weatherService, WeatherData } from '../api/weatherService';
import { geometryService } from '../utils/geometryService';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracker';

// Token de Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

export const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<Mapbox.Camera>(null);
  
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
  const { currentLocation } = useLocationTracker();
  
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userColor, setUserColor] = useState('#FF0000');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Cargar Perfil y Clima
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
    loadTerritories();
  }, []);

  useEffect(() => {
    if (currentLocation && !weather && !isRecording) {
      weatherService.getWeather(currentLocation.coords.latitude, currentLocation.coords.longitude).then(setWeather);
    }
  }, [currentLocation, isRecording]);

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

  const handleAction = async () => {
    if (isRecording) {
      if (route.length < 10) {
        Alert.alert('Ruta insuficiente', 'Sigue moviéndote para completar un circuito.');
        await stopBackgroundTracking();
        stopRecording();
        return;
      }

      const { isValid, area, polygon } = geometryService.createAndValidatePolygon(route);
      
      if (geometryService.isClosedLoop(route) && isValid && polygon) {
        setIsLoading(true);
        try {
          const distance = turf.length(turf.lineString(route), { units: 'meters' });
          await runService.saveRun(polygon.geometry, area, distance);
          const result = await territoryService.conquerTerritory(polygon);
          
          if (result.success) {
            await stopBackgroundTracking();
            stopRecording();
            await loadTerritories();
            navigation.navigate('Summary', {
              area: result.final_area,
              distance: distance,
              polygon: polygon
            });
          }
        } catch (error: any) {
          Alert.alert('Error', 'No se pudo procesar la conquista.');
        } finally {
          setIsLoading(false);
        }
      } else {
        Alert.alert('Circuito no cerrado', 'Asegúrate de volver al punto de inicio para cerrar el área.');
        await stopBackgroundTracking();
        stopRecording();
      }
    } else {
      try {
        await startBackgroundTracking();
        clearRoute();
        startRecording();
      } catch (e: any) {
        Alert.alert('Permisos necesarios', 'Runquer necesita permisos de ubicación "Siempre" para funcionar bloqueado.');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const skyConfig = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 8) return { type: 'atmosphere', color: '#ff8c3c', haloColor: 'rgba(255, 200, 150, 0.5)' };
    if (hour >= 8 && hour < 18) return { type: 'atmosphere', color: '#87ceeb', haloColor: '#ffffff' };
    if (hour >= 18 && hour < 21) return { type: 'atmosphere', color: '#ff6464', haloColor: 'rgba(255, 160, 60, 0.5)' };
    return { type: 'atmosphere', color: '#0a0a1e', haloColor: '#323264' };
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Satellite}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        {isMapReady && (
          <>
            <Mapbox.Camera
              ref={cameraRef}
              followZoomLevel={isRecording ? 18.2 : 14}
              followPitch={isRecording ? 80 : 45}
              followUserLocation={true}
              followUserMode={isRecording ? 'course' : 'normal'}
              animationDuration={2000}
            />
            
            <Mapbox.Terrain sourceID="mapbox-dem" style={{ exaggeration: 1.5 }} />
            <Mapbox.RasterDemSource id="mapbox-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} />
            <Mapbox.Atmosphere style={{ color: skyConfig.color, highColor: skyConfig.haloColor }} />
            
            <Mapbox.VectorSource id="mapbox-streets" url="mapbox://mapbox.mapbox-streets-v8">
              <Mapbox.FillExtrusionLayer
                id="3d-buildings-premium"
                sourceLayerID="building"
                filter={['==', 'extrude', 'true']}
                minZoomLevel={15}
                style={{
                  fillExtrusionColor: ['interpolate', ['linear'], ['get', 'height'], 0, '#2c3e50', 50, '#34495e', 100, '#2c3e50'],
                  fillExtrusionHeight: ['get', 'height'],
                  fillExtrusionBase: ['get', 'min_height'],
                  fillExtrusionOpacity: 0.85,
                }}
              />
            </Mapbox.VectorSource>

            {territories.map((t) => (
              <Mapbox.ShapeSource key={t.id} id={`source-${t.id}`} shape={t.geom}>
                <Mapbox.FillLayer 
                  id={`fill-${t.id}`} 
                  style={{ 
                    fillOpacity: 0.45,
                    fillColor: t.user_id === userId ? userColor : '#444',
                    fillOutlineColor: t.user_id === userId ? userColor : '#888'
                  }} 
                />
              </Mapbox.ShapeSource>
            ))}

            <Mapbox.UserLocation />

            {route.length > 1 && (
              <Mapbox.ShapeSource id="routeSource" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: route } }}>
                <Mapbox.LineLayer id="routeLayer" style={{ lineColor: '#FFF', lineWidth: 4, lineJoin: 'round', lineCap: 'round', lineOpacity: 0.7 }} />
              </Mapbox.ShapeSource>
            )}
          </>
        )}
      </Mapbox.MapView>

      {!isRecording && weather && (
        <View style={[styles.weatherWidget, { top: insets.top + 10 }]}>
          <weather.Icon size={20} color="#333" />
          <Text style={styles.weatherTemp}>{weather.temperature}°</Text>
        </View>
      )}

      {isRecording && (
        <View style={[styles.statsOverlay, { top: insets.top + 10 }]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TIEMPO</Text>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISTANCIA</Text>
            <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(2)} km</Text>
          </View>
        </View>
      )}

      <View style={[styles.uiContainer, { bottom: insets.bottom + 20 }]}>
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
                {isRecording ? 'FINALIZAR CONQUISTA' : 'EMPEZAR CONQUISTA'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  uiContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  statsOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
  },
  statBox: { alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: '#DDD' },
  statLabel: { color: '#888', fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1 },
  statValue: { color: '#000', fontSize: 24, fontFamily: 'Outfit-Black' },
  button: { paddingVertical: 18, paddingHorizontal: 40, borderRadius: 35, flexDirection: 'row', alignItems: 'center', elevation: 10 },
  buttonStop: { backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
  buttonText: { color: '#FFF', fontFamily: 'Outfit-Black', fontSize: 16, letterSpacing: 1 },
  weatherWidget: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  weatherTemp: { marginLeft: 6, fontSize: 14, fontFamily: 'Outfit-Bold', color: '#333' }
});

export default MapScreen;
