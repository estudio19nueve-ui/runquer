import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useNavigation } from '@react-navigation/native';
import { Zap, Map as MapIcon } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { useRunStore } from '../store/useRunStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { territoryService, Territory } from '../api/territoryService';
import { runService } from '../api/runService';
import { gamificationService } from '../api/gamificationService';
import { weatherService, WeatherData } from '../api/weatherService';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracker';

// Configuración de Temas
const MAP_THEMES = {
  neon: {
    name: 'Neon Colores',
    mapStyle: Mapbox.StyleURL.Dark,
    background: '#555566',
    water: '#05050A',
    roadPrimary: '#FF007F',
    roadSecondary: '#7B2FF7',
    labels: '#00F3FF',
    buildings: '#1A1B2E',
    land: '#555566',
    territoryMe: '#0044FF',
    uiBackground: 'rgba(8, 9, 22, 0.9)',
    uiText: '#FFF',
    uiAccent: '#00F3FF'
  }
};

export const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const lastFetchLocationRef = useRef<{lat: number, lon: number} | null>(null);

  const [currentThemeKey] = useState<keyof typeof MAP_THEMES>('neon');
  const theme = MAP_THEMES[currentThemeKey];

  const {
    isRecording,
    startRecording,
    stopRecording,
    route,
    clearRoute,
    totalDistance,
    duration
  } = useRunStore();

  const { currentLocation } = useLocationTracker();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastKmPace, setLastKmPace] = useState<string>('--:--');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchProfile();
    loadTerritories();
  }, []);

  useEffect(() => {
    if (currentLocation && currentLocation.coords) {
      // Seguimiento de cámara manual (Bypass para evitar crash nativo)
      if (isMapReady && !isRecording) {
        cameraRef.current?.setCamera({
          centerCoordinate: [currentLocation.coords.longitude, currentLocation.coords.latitude],
          zoomLevel: 15.5,
          animationDuration: 2000,
          animationMode: 'flyTo'
        });
      }

      if (!weather && !isRecording) {
        weatherService.getWeather(currentLocation.coords.latitude, currentLocation.coords.longitude)
          .then(setWeather)
          .catch(() => { });
      }
    }
  }, [currentLocation?.coords?.latitude, isMapReady, isRecording]);

  const loadTerritories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .limit(1000);
      if (error) throw error;
      setTerritories(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  }, []);

  const territoryGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: territories
      .filter(t => t.geom && t.geom.coordinates)
      .map(t => ({
        type: 'Feature',
        properties: {
          user_id: t.user_id || '',
          color: t.profiles?.territory_color || '#555',
          layers: t.layers || 1
        },
        geometry: {
          type: 'Polygon',
          coordinates: t.geom.coordinates
        }
      }))
  }), [territories]);

  const [currentPace, setCurrentPace] = useState<string>('--:--');

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRecording && currentLocation?.coords?.speed) {
        const speedKmh = currentLocation.coords.speed * 3.6;
        if (speedKmh > 0.5) {
          const paceMin = 60 / speedKmh;
          const mins = Math.floor(paceMin);
          const secs = Math.floor((paceMin - mins) * 60);
          setCurrentPace(`${mins}:${secs.toString().padStart(2, '0')}`);
        } else {
          setCurrentPace('0:00');
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isRecording, currentLocation?.coords?.speed]);

  useEffect(() => {
    if (isRecording && route.length > 5) {
      const avgSpeed = currentLocation?.coords?.speed || 0;
      if (avgSpeed > 0) {
        const paceMin = 60 / (avgSpeed * 3.6);
        const mins = Math.floor(paceMin);
        const secs = Math.floor((paceMin - mins) * 60);
        setLastKmPace(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }
  }, [totalDistance]);

  useEffect(() => {
    if (!currentLocation?.coords) return;
    const { latitude, longitude } = currentLocation.coords;
    if (!lastFetchLocationRef.current) {
      loadTerritories();
      lastFetchLocationRef.current = { lat: latitude, lon: longitude };
    } else {
      const dist = turf.distance(
        turf.point([lastFetchLocationRef.current.lon, lastFetchLocationRef.current.lat]),
        turf.point([longitude, latitude]),
        { units: 'meters' }
      );
      if (dist > 100) {
        loadTerritories();
        lastFetchLocationRef.current = { lat: latitude, lon: longitude };
      }
    }
  }, [currentLocation?.coords?.latitude, currentLocation?.coords?.longitude]);

  const handleAction = async () => {
    if (isRecording) {
      setIsLoading(true);
      try {
        const routeLine = turf.lineString(route);
        const dist = turf.length(routeLine, { units: 'meters' });
        await runService.saveRun(routeLine.geometry, 0, dist, duration);
        const result = await territoryService.conquerTerritory(routeLine);
        if (result.success) {
          await stopBackgroundTracking();
          stopRecording();
          await loadTerritories();
          navigation.navigate('Summary', { area: 0, distance: dist, polygon: null, routePath: route });
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'No se pudo procesar la conquista.');
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        await startBackgroundTracking();
        clearRoute();
        startRecording();
      } catch (e) {
        Alert.alert('Permisos necesarios', 'Runquer necesita permisos de ubicación.');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.uiAccent} />
        <Text style={[styles.loadingText, { color: theme.uiText, fontFamily: 'Outfit-Bold' }]}>Procesando conquista...</Text>
      </View>
    );
  }

  const WeatherIcon = weather?.Icon;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={theme.mapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        {isMapReady && (
          <>
            <Mapbox.Camera
              ref={cameraRef}
              zoomLevel={15.5}
              pitch={45}
            />
            <Mapbox.BackgroundLayer id="themeBackground" style={{ backgroundColor: theme.background }} />
            
            {/* Punto de ubicación manual (Sustituye al nativo que fallaba) */}
            {currentLocation && currentLocation.coords && (
              <Mapbox.ShapeSource
                id="manualLocationSource"
                shape={{
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [currentLocation.coords.longitude, currentLocation.coords.latitude]
                  }
                }}
              >
                <Mapbox.CircleLayer
                  id="manualLocationCircle"
                  style={{
                    circleRadius: 8,
                    circleColor: theme.uiAccent,
                    circleStrokeWidth: 3,
                    circleStrokeColor: '#FFFFFF',
                    circleOpacity: 1
                  }}
                />
              </Mapbox.ShapeSource>
            )}

            <Mapbox.FillLayer
              id="waterTheme"
              sourceID="composite"
              sourceLayerID="water"
              style={{ fillColor: theme.water }}
            />
            <Mapbox.LineLayer
              id="roadsTheme"
              sourceID="composite"
              sourceLayerID="road"
              filter={['match', ['get', 'class'], ['motorway', 'primary', 'trunk', 'street', 'secondary', 'tertiary'], true, false]}
              style={{
                lineColor: ['match', ['get', 'class'], ['motorway', 'primary', 'trunk'], theme.roadPrimary, theme.roadSecondary],
                lineWidth: ['match', ['get', 'class'], ['motorway', 'primary', 'trunk'], 2.5, 1.2],
              }}
            />
            <Mapbox.SymbolLayer
              id="labelsTheme"
              sourceID="composite"
              sourceLayerID="place_label"
              style={{
                textField: ['get', 'name'],
                textColor: theme.labels,
                textSize: 12,
                textHaloColor: theme.background,
                textHaloWidth: 1.5,
              }}
            />
            <Mapbox.ShapeSource id="territoriesSource" shape={territoryGeoJSON as any}>
              <Mapbox.FillLayer 
                id="territoriesFill" 
                style={{ 
                  fillOpacity: ['interpolate', ['linear'], ['get', 'layers'], 1, 0.4, 5, 0.8],
                  fillColor: ['case', ['==', ['get', 'user_id'], userId || ''], theme.territoryMe, ['get', 'color']],
                }} 
              />
              <Mapbox.LineLayer id="territoriesOutline" style={{ lineColor: theme.uiAccent, lineWidth: 1.5 }} />
            </Mapbox.ShapeSource>
          </>
        )}
      </Mapbox.MapView>

      {!isRecording && weather && (
        <View style={[styles.weatherWidget, { top: insets.top + 20, backgroundColor: theme.uiBackground, borderColor: theme.uiAccent }]}>
          {WeatherIcon && <WeatherIcon size={20} color={theme.uiAccent} />}
          <Text style={[styles.weatherTemp, { color: theme.uiText, fontFamily: 'Outfit-Bold' }]}>{weather.temperature}°</Text>
        </View>
      )}

      {isRecording && (
        <View style={[styles.statsOverlay, { top: insets.top + 10, backgroundColor: theme.uiBackground, borderColor: theme.uiAccent }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.uiAccent, fontFamily: 'Outfit-Bold' }]}>RITMO</Text>
            <Text style={[styles.statValue, { color: theme.uiText, fontFamily: 'Outfit-Black' }]}>{currentPace}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.uiAccent, fontFamily: 'Outfit-Bold' }]}>TIEMPO</Text>
            <Text style={[styles.statValue, { color: theme.uiText, fontFamily: 'Outfit-Black' }]}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.uiAccent, fontFamily: 'Outfit-Bold' }]}>DISTANCIA</Text>
            <Text style={[styles.statValue, { color: theme.uiText, fontFamily: 'Outfit-Black' }]}>{(totalDistance / 1000).toFixed(2)}</Text>
            <Text style={[styles.statSubLabel, { color: theme.uiAccent, fontFamily: 'Outfit-Bold' }]}>KM</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.uiAccent, fontFamily: 'Outfit-Bold' }]}>ÚLTIMO KM</Text>
            <Text style={[styles.statValue, { color: theme.uiText, fontFamily: 'Outfit-Black' }]}>{lastKmPace}</Text>
          </View>
        </View>
      )}

      <View style={[styles.uiContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          disabled={isLoading}
          style={[styles.button, isRecording ? styles.buttonStop : { backgroundColor: theme.uiAccent }]}
          onPress={handleAction}
        >
          <Text style={[styles.buttonText, { fontFamily: 'Outfit-Black' }]}>
            {isRecording ? 'FINALIZAR CONQUISTA' : 'EMPEZAR CONQUISTA'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10 },
  uiContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  statsOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
  },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 24 },
  statSubLabel: { fontSize: 10 },
  button: { paddingVertical: 18, paddingHorizontal: 40, borderRadius: 34 },
  buttonStop: { backgroundColor: '#222' },
  buttonText: { color: '#FFF', fontSize: 16 },
  weatherWidget: { 
    position: 'absolute', 
    right: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderRadius: 20,
    borderWidth: 1,
  },
  weatherTemp: { marginLeft: 6, fontSize: 14 }
});

export default MapScreen;
