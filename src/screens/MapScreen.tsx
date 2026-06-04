import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useNavigation } from '@react-navigation/native';
import { Map as MapIcon, Shield, ShieldAlert, MapPin } from 'lucide-react-native';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Linking } from 'react-native';

import { supabase } from '../lib/supabase';
import { useRunStore } from '../store/useRunStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { territoryService, Territory } from '../api/territoryService';
import { runService } from '../api/runService';
import { feedService } from '../api/feedService';
import { weatherService, WeatherData } from '../api/weatherService';
import { gamificationService } from '../api/gamificationService';

// Colores originales de Runquer
const COLORS = {
  accent: '#00F3FF',
  me: '#00F3FF',
  background: '#000',
  stop: '#FF0055'
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const lastFetchLocationRef = useRef<{ lat: number, lon: number } | null>(null);
  
  const {
    isRecording,
    startRecording,
    stopRecording,
    route,
    clearRoute,
    totalDistance,
    duration,
    lastKmPace
  } = useRunStore();

  const { currentLocation } = useLocationTracker();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentPace, setCurrentPace] = useState<string>('--:--');
  const [profile, setProfile] = useState<any>(null);
  const [isBatteryOptimized, setIsBatteryOptimized] = useState(false);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const isFetchingRef = useRef(false);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Comprobar si ya se mostró el disclosure en esta sesión (o usar storage para persistir)
    setShowLocationDisclosure(true);
  }, []);

  const handleAcceptDisclosure = async () => {
    setShowLocationDisclosure(false);
    await initPermissions();
  };

  const initPermissions = async () => {
    if (Platform.OS === 'android') {
      // Permisos de Mapbox para el punto azul nativo
      await Mapbox.requestAndroidLocationPermissions();
      
      // Comprobar optimización de batería
      const isOptimizing = await Battery.isBatteryOptimizationEnabledAsync();
      setIsBatteryOptimized(isOptimizing);

      // Si es Android 10+ pedir permiso de actividad física explícitamente
      // @ts-ignore
      if (Platform.Version >= 29 && typeof BackgroundGeolocation !== 'undefined') {
        // @ts-ignore
        const { status } = await BackgroundGeolocation.requestPermission();
        console.log("[Permissions] BackgroundGeolocation status:", status);
      }
    } else {
      // En iOS simplemente iniciamos permisos básicos si es necesario
      await Mapbox.requestAndroidLocationPermissions(); // Mapbox maneja iOS internamente
    }
  };

  const openBatterySettings = () => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } else {
      Linking.openSettings();
    }
  };

  const lastRecordingState = useRef(isRecording);

  useEffect(() => {
    // Solo actualizar si el estado de grabación ha cambiado realmente
    if (lastRecordingState.current !== isRecording) {
      navigation.getParent()?.setOptions({
        tabBarStyle: isRecording ? { display: 'none' } : {
          backgroundColor: '#000000',
          borderTopColor: '#111',
          height: 80 + (insets.bottom > 0 ? insets.bottom : 10), 
          paddingBottom: (insets.bottom > 0 ? insets.bottom : 10),
          paddingTop: 12,
        }
      });
      lastRecordingState.current = isRecording;
    }
  }, [isRecording, navigation]); // No incluimos insets.bottom para evitar el bucle infinito

  useEffect(() => {
    const fetchProfile = async () => {
      const p = await gamificationService.getMyProfile();
      if (p) setProfile(p);
    };
    fetchProfile();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
      loadTerritories(); // Refrescar mapa al volver de cualquier pantalla
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      loadTerritories();
    };
    fetchInitialData();
  }, []);

  const loadTerritories = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      console.log('MapScreen: Triggering loadTerritories...');
      const data = await territoryService.fetchTerritories();
      console.log('MapScreen: Territories received:', data.length);
      if (data.length > 0) {
        console.log('MapScreen: Sample territory:', JSON.stringify(data[0]).substring(0, 100));
      }
      setTerritories(data);
    } catch (error) {
      console.error('MapScreen: Error loading territories:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const territoryGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: territories
      .map(t => {
        try {
          let geometry = t.geom;
          if (typeof geometry === 'string') {
            geometry = JSON.parse(geometry);
          }
          
          if (!geometry) return null;

          const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;

          return {
            type: 'Feature',
            properties: {
              user_id: t.user_id || '',
              color: prof?.territory_color || COLORS.me,
              layers: t.layers || 1
            },
            geometry: geometry
          };
        } catch (e) {
          console.warn('Error parsing territory geom:', e);
          return null;
        }
      })
      .filter((f): f is any => f !== null)
  }), [territories]);

  const routeGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route
        }
      }
    ]
  }), [route]);

  useEffect(() => {
    if (isMapReady && currentLocation?.coords && !isRecording && !hasAnimatedRef.current) {
      const { latitude, longitude } = currentLocation.coords;
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 18.5,
        animationDuration: 5000,
        animationMode: 'flyTo',
        pitch: 75
      });
      hasAnimatedRef.current = true;
    }
  }, [isMapReady, currentLocation, isRecording]);

  useEffect(() => {
    if (currentLocation?.coords) {
      const { latitude, longitude, speed } = currentLocation.coords;
      
      if (isRecording) {
        // Prioridad 1: velocidad del sensor GPS (más precisa y rápida)
        if (speed != null && speed > 0.5) {
          const paceMin = 60 / (speed * 3.6);
          const mins = Math.floor(paceMin);
          const secs = Math.floor((paceMin - mins) * 60);
          setCurrentPace(`${mins}:${secs.toString().padStart(2, '0')}`);
        } else {
          // Prioridad 2: fallback matemático con los últimos puntos del store
          // locationTask.ts ya habrá añadido el punto anterior al store
          const currentRoute = useRunStore.getState().route;
          if (currentRoute.length >= 2) {
            const last = currentRoute[currentRoute.length - 1];
            const prev = currentRoute[currentRoute.length - 2];
            const timeDiffSec = (last[2] - prev[2]) / 1000;
            if (timeDiffSec > 0 && timeDiffSec < 60) {
              const distM = turf.distance(
                turf.point([prev[0], prev[1]]),
                turf.point([last[0], last[1]]),
                { units: 'meters' }
              );
              if (distM > 2) {
                const speedMps = distM / timeDiffSec;
                if (speedMps > 0.3 && speedMps < 15) { // 0.3 m/s mínimo, 15 m/s máximo (54 km/h)
                  const paceMin = 1000 / (speedMps * 60); // min/km
                  const mins = Math.floor(paceMin);
                  const secs = Math.floor((paceMin - mins) * 60);
                  setCurrentPace(`${mins}:${secs.toString().padStart(2, '0')}`);
                }
              }
            }
          }
        }
      } else {
        // No grabando: resetear ritmo
        setCurrentPace('--:--');
      }

      // Carga proactiva de territorios y clima cada 100m
      if (!lastFetchLocationRef.current || turf.distance(
        turf.point([lastFetchLocationRef.current.lon, lastFetchLocationRef.current.lat]),
        turf.point([longitude, latitude]),
        { units: 'meters' }
      ) > 100) {
        loadTerritories();
        weatherService.getWeather(latitude, longitude).then(setWeather);
        lastFetchLocationRef.current = { lat: latitude, lon: longitude };
      }
    }
  }, [currentLocation, isRecording]);

  const isProcessingRef = useRef(false);

  const handleAction = async () => {
    if (isRecording) {
      if (isProcessingRef.current) return;
      
      // Filtro de seguridad para rutas demasiado cortas
      if (route.length < 3) {
        Alert.alert('Ruta muy corta', '¡Corre un poco más para poder conquistar este territorio!');
        stopRecording();
        setIsLoading(false);
        return;
      }

      isProcessingRef.current = true;
      setIsLoading(true);

      try {
        // Detener la grabación localmente lo antes posible
        stopRecording();

        const routeLine = turf.lineString(route.map(p => [p[0], p[1]]), { properties: {} });
        const dist = turf.length(routeLine, { units: 'kilometers' }) * 1000;
        
        // 1. Intentar la conquista primero para obtener la superficie real
        let conqueredArea = 0;
        try {
          const result = await territoryService.conquerTerritory(routeLine);
          conqueredArea = result.final_area; // Superficie en m2 de esta conquista
          console.log('Conquista exitosa, área:', conqueredArea);
        } catch (terrErr) {
          console.warn('Error en la conquista (pero guardaremos la carrera):', terrErr);
        }

        // Determinar nombre dinámico según horario
        const getDynamicName = () => {
          const hour = new Date().getHours();
          if (hour >= 5 && hour < 12) return 'Carrera Matinal';
          if (hour >= 12 && hour < 18) return 'Carrera';
          if (hour >= 18 && hour < 21) return 'Carrera al Atardecer';
          return 'Carrera Nocturna';
        };
        
        // 2. Guardar la carrera con la superficie real obtenida
        const savedRun = await runService.saveRun(routeLine.geometry, conqueredArea, dist, duration, getDynamicName());
        
        // 2.5 Vincular los nuevos hexágonos con la carrera (para que el borrado limpie el ranking)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (savedRun?.id && authUser) {
          await supabase
            .from('territories')
            .update({ run_id: savedRun.id })
            .eq('user_id', authUser.id)
            .is('run_id', null);
        }
        
        // 3. Publicar resumen en el chat global
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const distanceKm = dist / 1000;
            const paceMins = (duration / 60) / distanceKm;
            const paceFinal = isFinite(paceMins) && paceMins > 0 
              ? `${Math.floor(paceMins)}:${Math.floor((paceMins % 1) * 60).toString().padStart(2, '0')}`
              : "--:--";
            
            await feedService.postActivitySummary(
              user.id,
              conqueredArea,
              distanceKm,
              paceFinal,
              savedRun.id
            );
          }
        } catch (feedErr) {
          console.warn('Error al publicar en feed (pero la carrera se guardó):', feedErr);
        }
        
        loadTerritories();
        navigation.navigate('Summary', { 
          area: conqueredArea, 
          distance: dist, 
          polygon: null, 
          routePath: route.map(p => [p[0], p[1]]) 
        });
      } catch (error) {
        console.error('Error al finalizar:', error);
        Alert.alert('Error', 'No se pudo procesar la actividad, pero se intentó guardar.');
      } finally {
        setIsLoading(false);
        isProcessingRef.current = false;
      }
    } else {
      if (Platform.OS === 'android') {
        try {
          const isOptimizing = await Battery.isBatteryOptimizationEnabledAsync();
          if (isOptimizing) {
            Alert.alert(
              "Precisión del GPS",
              "La optimización de batería de Android está activa. Esto puede suspender el GPS cuando la pantalla está bloqueada y hacer que los datos del ranking sean erróneos.\n\nTe recomendamos cambiar la batería de Runquer a 'Sin Restricciones'.",
              [
                {
                  text: "Configurar Ahora",
                  onPress: () => openBatterySettings()
                },
                {
                  text: "Empezar de todas formas",
                  style: "cancel",
                  onPress: () => {
                    clearRoute();
                    startRecording();
                  }
                }
              ]
            );
            return;
          }
        } catch (err) {
          console.warn("[Battery Check] Error checking battery optimization:", err);
        }
      }
      clearRoute();
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView 
        style={styles.map} 
        styleURL="mapbox://styles/mapbox/dark-v11"
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        <Mapbox.Camera 
          ref={cameraRef}
          defaultSettings={{ 
            zoomLevel: 1.0, // Visión planetaria
            centerCoordinate: [10, 20], 
            pitch: 0 
          }}
        />
        
        {isMapReady && (
          <>
            <Mapbox.FillExtrusionLayer
              id="3d-buildings"
              sourceLayerID="building"
              minZoomLevel={15}
              maxZoomLevel={22}
              style={{
                fillExtrusionColor: '#333333',
                fillExtrusionHeight: ['get', 'height'],
                fillExtrusionBase: ['get', 'min_height'],
                fillExtrusionOpacity: 0.8,
              }}
            />

            <Mapbox.ShapeSource id="routeSource" shape={{
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route.map(p => [p[0], p[1]]) }
              }]
            } as any}>
              <Mapbox.LineLayer id="routeLayer" style={{ lineColor: COLORS.me, lineWidth: 5, lineOpacity: 0.8 }} />
            </Mapbox.ShapeSource>

            <Mapbox.ShapeSource id="territoriesSource" shape={territoryGeoJSON as any}>
              <Mapbox.FillLayer 
                id="territoriesFill" 
                style={{ 
                  fillOpacity: ['interpolate', ['linear'], ['get', 'layers'], 1, 0.4, 5, 0.8],
                  fillColor: ['case', 
                    ['==', ['get', 'user_id'], userId || ''], 
                    profile?.territory_color || COLORS.me, 
                    ['get', 'color']
                  ],
                }} 
              />
              <Mapbox.LineLayer id="territoriesOutline" style={{ lineColor: '#FFF', lineWidth: 0.5, lineOpacity: 0.3 }} />
            </Mapbox.ShapeSource>

            {Platform.OS === 'android' ? (
              <Mapbox.UserLocation 
                visible={true} 
                animated={true} 
                androidRenderMode="gps"
                showsUserHeadingIndicator={true}
              />
            ) : (
              currentLocation?.coords && (
                <Mapbox.ShapeSource id="userLocationSource" shape={{
                  type: 'Point',
                  coordinates: [currentLocation.coords.longitude, currentLocation.coords.latitude]
                } as any}>
                  <Mapbox.CircleLayer id="userLocationHalo" style={{ circleColor: COLORS.me, circleRadius: 12, circleOpacity: 0.4 }} />
                  <Mapbox.CircleLayer id="userLocationCore" style={{ circleColor: '#FFFFFF', circleRadius: 6 }} />
                </Mapbox.ShapeSource>
              )
            )}
          </>
        )}
      </Mapbox.MapView>

      {!isRecording && weather && (
        <View style={[styles.weatherBadge, { top: insets.top + 10 }]}>
          <weather.Icon size={20} color={COLORS.accent} />
          <Text style={styles.weatherText}>{weather.temperature}°C</Text>
        </View>
      )}

      {!isRecording && isBatteryOptimized && (
        <TouchableOpacity 
          style={[styles.batteryWarning, { top: insets.top + 50 }]} 
          onPress={openBatterySettings}
        >
          <ShieldAlert size={16} color="#FFD700" />
          <Text style={styles.batteryWarningText}>MEJORAR PRECISIÓN GPS</Text>
        </TouchableOpacity>
      )}

      {isRecording ? (
        <View style={[styles.fullOverlay, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.brandText}>RUNQUER</Text>
          
          <View style={styles.mainMetrics}>
             <Text style={styles.giantLabel}>DISTANCIA</Text>
             <Text style={styles.giantValue}>{(totalDistance / 1000).toFixed(2)}</Text>
             <Text style={styles.giantUnit}>KM</Text>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.metricBox}>
              <Text style={styles.smallLabel}>RITMO ACTUAL</Text>
              <Text style={styles.smallValue}>{currentPace}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.smallLabel}>ÚLTIMO KM</Text>
              <Text style={styles.smallValue}>{lastKmPace}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.smallLabel}>TIEMPO</Text>
              <Text style={styles.smallValue}>{formatTime(duration)}</Text>
            </View>
          </View>

          <TouchableOpacity
            disabled={isLoading}
            style={styles.buttonStopLarge}
            onPress={handleAction}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonTextLarge}>FINALIZAR CONQUISTA</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.uiContainer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={styles.buttonStart}
            onPress={handleAction}
          >
            <Text style={styles.buttonText}>EMPEZAR CONQUISTA</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{color: '#FFF', marginTop: 10, fontFamily: 'Outfit-Bold'}}>PROCESANDO CONQUISTA...</Text>
        </View>
      )}
      <Modal
        visible={showLocationDisclosure}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.disclosureOverlay}>
          <View style={styles.disclosureContainer}>
            <MapPin size={40} color={COLORS.accent} style={{ marginBottom: 15 }} />
            <Text style={styles.disclosureTitle}>Tu Privacidad y el GPS</Text>
            <Text style={styles.disclosureText}>
              Runquer necesita acceder a tu ubicación <Text style={{ fontFamily: 'Outfit-Bold', color: '#FFF' }}>"Siempre"</Text> o <Text style={{ fontFamily: 'Outfit-Bold', color: '#FFF' }}>"En segundo plano"</Text> para poder:
            </Text>
            <View style={styles.disclosureList}>
              <Text style={styles.disclosureItem}>• Trazar tus rutas mientras corres.</Text>
              <Text style={styles.disclosureItem}>• Conquistar territorios con la pantalla apagada.</Text>
              <Text style={styles.disclosureItem}>• Sincronizar tu ranking en tiempo real.</Text>
            </View>
            <Text style={styles.disclosureSubtext}>
              Estos datos se recogen incluso cuando la aplicación está cerrada o no se está utilizando activamente, siempre que haya una carrera en curso.
            </Text>
            <TouchableOpacity style={styles.disclosureButton} onPress={handleAcceptDisclosure}>
              <Text style={styles.disclosureButtonText}>ENTENDIDO Y ACEPTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    padding: 30,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  brandText: {
    color: COLORS.accent,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Outfit-Black',
    letterSpacing: 4,
  },
  mainMetrics: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  giantLabel: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 2,
    marginBottom: 5,
  },
  giantValue: {
    color: COLORS.accent,
    fontSize: 110,
    fontFamily: 'Outfit-Black',
    lineHeight: 120,
  },
  giantUnit: {
    color: '#666',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  smallLabel: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  smallValue: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Outfit-Black',
  },
  uiContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 35,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  buttonStopLarge: {
    backgroundColor: '#FF0055',
    paddingVertical: 22,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#FF0055',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  buttonTextLarge: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  weatherBadge: { 
    position: 'absolute', 
    left: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,243,255,0.3)',
    zIndex: 10,
  },
  weatherText: { color: '#FFF', marginLeft: 8, fontFamily: 'Outfit-Bold', fontSize: 16 },
  batteryWarning: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    zIndex: 10,
  },
  batteryWarningText: { 
    color: '#FFD700', 
    marginLeft: 8, 
    fontFamily: 'Outfit-Bold', 
    fontSize: 10,
    letterSpacing: 0.5
  },
  disclosureOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  disclosureContainer: { backgroundColor: '#0A0B14', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: '#222', alignItems: 'center', width: '100%' },
  disclosureTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Outfit-Black', marginBottom: 15, textAlign: 'center' },
  disclosureText: { color: '#888', fontSize: 14, fontFamily: 'Outfit-Regular', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  disclosureList: { alignSelf: 'flex-start', marginBottom: 20, paddingLeft: 10 },
  disclosureItem: { color: '#AAA', fontSize: 13, fontFamily: 'Outfit-Medium', marginBottom: 8 },
  disclosureSubtext: { color: '#666', fontSize: 11, fontFamily: 'Outfit-Regular', textAlign: 'center', lineHeight: 16, marginBottom: 30 },
  disclosureButton: { backgroundColor: COLORS.accent, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, width: '100%', alignItems: 'center' },
  disclosureButtonText: { color: '#000', fontSize: 14, fontFamily: 'Outfit-Black' }
});
