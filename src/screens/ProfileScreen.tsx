import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert, TextInput, Vibration, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Users, Trophy, History, Shield, Zap, Camera, ChevronDown, ChevronUp, Hexagon, Trash2, Heart, Volume2, VolumeX, Play } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';

import { supabase } from '../lib/supabase';
import { gamificationService, getLevelTitle } from '../api/gamificationService';
import { healthKitService } from '../services/healthKitService';
import { stravaAuthService } from '../services/stravaAuthService';
import { stravaSyncService } from '../services/stravaSyncService';
import { useRunStore } from '../store/useRunStore';
import { LOCATION_TASK_NAME } from '../services/locationTask';
import { 
  getSpanishVoices, 
  getPreferredVoice, 
  setPreferredVoice, 
  isAudioCuesEnabled, 
  setAudioCuesEnabled 
} from '../utils/voiceHelper';

const { width: screenWidth } = Dimensions.get('window');

const COLORS = {
  accent: '#00F3FF',
  background: '#000',
  card: '#0A0B14',
  text: '#FFF',
  textSecondary: '#888'
};

const StravaIcon = ({ size = 20, color = "#FF5A00" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" style={{ marginRight: 10 }}>
    <Path
      fill={color}
      d="M6.731 0 2 9.125h2.788L6.73 5.497l1.93 3.628h2.766zm4.694 9.125-1.372 2.756L8.66 9.125H6.547L10.053 16l3.484-6.875z"
    />
  </Svg>
);

const StravaWordmark = ({ height = 12, color = "#FF5A00" }: { height?: number; color?: string }) => {
  const width = height * (432 / 91);
  return (
    <Svg width={width} height={height} viewBox="0 0 432 91" style={{ marginLeft: 6 }}>
      <Path
        fill={color}
        d="M74.5 49.5c1.6 2.8 2.5 6.3 2.5 10.4v0.2c0 4.2-0.8 8-2.5 11.4 -1.7 3.4-4.1 6.2-7.1 8.6 -3.1 2.3-6.8 4.1-11.2 5.4 -4.4 1.3-9.3 1.9-14.7 1.9 -8.2 0-15.9-1.1-23-3.4 -7.1-2.3-13.2-5.7-18.3-10.2l14.4-17.1c4.4 3.4 9 5.8 13.8 7.2 4.8 1.5 9.6 2.2 14.4 2.2 2.5 0 4.2-0.3 5.3-0.9 1.1-0.6 1.6-1.5 1.6-2.5v-0.2c0-1.2-0.8-2.1-2.4-2.9 -1.6-0.8-4.5-1.6-8.8-2.4 -4.5-0.9-8.8-2-12.9-3.2 -4.1-1.2-7.7-2.8-10.8-4.7 -3.1-1.9-5.6-4.3-7.4-7.2C5.4 39 4.5 35.4 4.5 31.2V31c0-3.8 0.7-7.4 2.2-10.7 1.5-3.3 3.7-6.2 6.6-8.6 2.9-2.5 6.5-4.4 10.7-5.8 4.2-1.4 9.1-2.1 14.7-2.1 7.8 0 14.7 0.9 20.5 2.8 5.9 1.8 11.1 4.6 15.8 8.3L61.9 33c-3.8-2.8-7.9-4.8-12.1-6.1 -4.3-1.3-8.3-1.9-12-1.9 -2 0-3.5 0.3-4.4 0.9 -1 0.6-1.4 1.4-1.4 2.4v0.2c0 1.1 0.7 2 2.2 2.8 1.5 0.8 4.3 1.6 8.5 2.4 5.1 0.9 9.8 2 14 3.3 4.2 1.3 7.8 3 10.9 5C70.5 44.2 72.9 46.6 74.5 49.5zM75.5 28.1h23.7v57.8h26.9V28.1h23.7V5.3H75.5V28.1zM387.9 0.3l-43.3 85.6h25.8l17.5-34.6 17.6 34.6h25.8L387.9 0.3zM267.3 0.3l43.4 85.6h-25.8l-17.5-34.6 -17.5 34.6h-17.5 -8.3 -22.4l-15.2-23h-0.2 -5.5v23h-26.9V5.3H193c7.2 0 13.1 0.8 17.8 2.5 4.6 1.6 8.4 3.9 11.2 6.7 2.5 2.4 4.3 5.2 5.5 8.3 1.2 3.1 1.8 6.7 1.8 10.8v0.2c0 5.9-1.4 10.9-4.3 14.9 -2.8 4.1-6.7 7.3-11.6 9.7l14 20.4L267.3 0.3zM202.5 35.6c0-2.6-0.9-4.5-2.8-5.8 -1.8-1.3-4.3-1.9-7.5-1.9h-11.7v15.8h11.6c3.2 0 5.8-0.7 7.6-2.1 1.8-1.4 2.8-3.3 2.8-5.8V35.6zM345.2 5.3L327.6 40 310 5.3h-25.8l43.4 85.6 43.3-85.6H345.2z"
      />
    </Svg>
  );
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalDistance: 0,
    avgPace: '0:00',
    followers: 0,
    following: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    weekLabels: [] as string[]
  });
  const [isKmsExpanded, setIsKmsExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [isStravaLinked, setIsStravaLinked] = useState(false);
  const [stravaSyncing, setStravaSyncing] = useState(false);

  const [audioCuesEnabled, setAudioCuesEnabledState] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    const initVoiceSettings = async () => {
      try {
        const enabled = await isAudioCuesEnabled();
        setAudioCuesEnabledState(enabled);

        const voices = await getSpanishVoices();
        // Ordenar las voces: poner las de España (es-ES) primero
        const sortedVoices = [...voices].sort((a, b) => {
          const aIsES = a.language.toLowerCase().replace('_', '-').startsWith('es-es');
          const bIsES = b.language.toLowerCase().replace('_', '-').startsWith('es-es');
          if (aIsES && !bIsES) return -1;
          if (!aIsES && bIsES) return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableVoices(sortedVoices);

        const preferred = await getPreferredVoice();
        if (preferred) {
          setSelectedVoiceId(preferred);
        }
      } catch (err) {
        console.error("[ProfileScreen] Error initializing voice settings:", err);
      }
    };
    initVoiceSettings();
  }, []);

  const handleToggleAudioCues = async (val: boolean) => {
    setAudioCuesEnabledState(val);
    await setAudioCuesEnabled(val);
  };

  const handleSelectVoice = async (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    await setPreferredVoice(voiceId);
  };

  const handlePlayTestVoice = async () => {
    if (!selectedVoiceId || isPlayingTest) return;
    try {
      setIsPlayingTest(true);
      await Speech.stop();
      Speech.speak("Audioguía de Runquer activa. ¡A conquistar la ciudad!", {
        voice: selectedVoiceId,
        language: 'es-ES',
        rate: 0.95,
        pitch: 1.0,
        onDone: () => setIsPlayingTest(false),
        onError: () => setIsPlayingTest(false),
      });
    } catch (err) {
      console.warn("Error playing test voice:", err);
      setIsPlayingTest(false);
    }
  };

  const cleanupBackgroundTracking = async () => {
    useRunStore.getState().reset();
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("[Profile Logout] Se detuvo el seguimiento de GPS en segundo plano.");
      }
    } catch (err) {
      console.warn("[Profile Logout] Error deteniendo el GPS en segundo plano:", err);
    }
  };

  useEffect(() => {
    fetchProfileData();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfileData();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchProfileData = async () => {
    try {
      const p = await gamificationService.getMyProfile() as any;
      console.log('Profile Data Received:', p?.username, 'Area:', p?.total_area);
      if (p) {
        let realArea = p.total_area || 0;

        // Bug fix: calcular el área real sumando directamente los hexágonos actuales
        // Esto evita depender del Trigger SQL y garantiza datos correctos
        const { data: areaData } = await supabase
          .from('territories')
          .select('area_sqm')
          .eq('user_id', p.id);

        if (areaData) {
          realArea = areaData.reduce((sum, t) => sum + (t.area_sqm || 0), 0);
        }

        // Comprobar vinculación de Strava
        const linked = await stravaAuthService.isLinked(p.id);
        setIsStravaLinked(linked);

        setProfile({
          ...p,
          total_area: realArea
        });
        setNewUsername(p.username || "");
      }

      const { data: runs } = await supabase
        .from('runs')
        .select('distance_meters, created_at')
        .eq('user_id', p.id)
        .order('created_at', { ascending: true });

      if (runs) {
        const totalDist = runs.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
        const weeksData = new Array(12).fill(0);
        const labels = new Array(12).fill("");

        // Calcular el inicio de la semana actual (Lunes 00:00:00)
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfThisWeek = new Date(now.setDate(diffToMonday));
        startOfThisWeek.setHours(0, 0, 0, 0);

        const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

        // 1. Calcular datos de la gráfica por semanas naturales
        runs.forEach(run => {
          const runTime = new Date(run.created_at).getTime();
          const startOfThisWeekMs = startOfThisWeek.getTime();

          const diffMs = startOfThisWeekMs - runTime;
          const weeksAgo = diffMs < 0 ? 0 : Math.floor(diffMs / MS_PER_WEEK) + 1;

          const index = 11 - weeksAgo;
          if (index >= 0 && index < 12) {
            weeksData[index] += (run.distance_meters || 0) / 1000;
          }
        });

        // 2. Generar etiquetas de fecha para el registro (Lunes a Domingo)
        for (let i = 0; i < 12; i++) {
          const weeksAgo = 11 - i;
          const start = new Date(startOfThisWeek.getTime() - (weeksAgo * MS_PER_WEEK));
          const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
          labels[i] = `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`;
        }

        setStats({
          totalDistance: totalDist,
          followers: p?.followers_count || 0,
          following: p?.following_count || 0,
          weeklyData: weeksData,
          weekLabels: labels,
          avgPace: '0:00'
        });
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return;
    try {
      await gamificationService.updateUsername(newUsername.trim());
      setProfile({ ...profile, username: newUsername });
      setEditMode(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar el nombre.");
    }
  };

  const handleColorSelect = async (color: string) => {
    const previousColor = profile?.territory_color;
    // Actualización optimista del estado local para respuesta instantánea en UI
    setProfile((prev: any) => prev ? { ...prev, territory_color: color } : null);

    try {
      await gamificationService.updateTerritoryColor(color);
    } catch (e) {
      console.error("[ProfileScreen] Error actualizando color:", e);
      // Revertir en caso de error
      setProfile((prev: any) => prev ? { ...prev, territory_color: previousColor } : null);
      Alert.alert("Error", "No se pudo actualizar el color en el servidor.");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      try {
        setLoading(true);
        const publicUrl = await gamificationService.uploadAvatar(result.assets[0].uri);
        setProfile({ ...profile, avatar_url: publicUrl });
        Alert.alert("Éxito", "Foto de perfil actualizada.");
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "No se pudo subir la imagen. Asegúrate de tener el bucket 'avatars' creado en Supabase.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir de Runquer?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Salir", 
          style: "destructive", 
          onPress: async () => {
            await cleanupBackgroundTracking();
            await supabase.auth.signOut();
          } 
        }
      ]
    );
  };

  const handleSyncHealthKit = async () => {
    if (!profile?.id) return;
    try {
      setSyncing(true);
      Vibration.vibrate(50);
      const result = await healthKitService.syncWorkouts(profile.id);

      Vibration.vibrate([0, 100, 50, 100]);

      Alert.alert(
        "Sincronización Completada",
        `Se han importado ${result.imported} carreras nuevas.\nSe omitieron ${result.skipped} carreras duplicadas.\nErrores de procesamiento: ${result.errors || 0}.`,
        [
          {
            text: "Aceptar",
            onPress: () => {
              if (result.imported > 0) {
                fetchProfileData();
              }
            }
          }
        ]
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert("Sincronización Fallida", e?.message || "Ocurrió un error al conectar con HealthKit.");
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkStrava = async () => {
    if (!profile?.id) return;
    try {
      if (isStravaLinked) {
        Alert.alert(
          "Desvincular Strava",
          "¿Estás seguro de que quieres desvincular tu cuenta de Strava?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Desvincular",
              style: "destructive",
              onPress: async () => {
                try {
                  setLoading(true);
                  await stravaAuthService.unlinkStrava(profile.id);
                  setIsStravaLinked(false);
                  Alert.alert("Éxito", "Strava desvinculado correctamente.");
                } catch (err) {
                  Alert.alert("Error", "No se pudo desvincular.");
                } finally {
                  setLoading(false);
                }
              }
            }
          ]
        );
      } else {
        const success = await stravaAuthService.linkStrava(profile.id);
        if (success) {
          setIsStravaLinked(true);
          Alert.alert("Éxito", "¡Strava vinculado correctamente!");
        }
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error de Vinculación", e?.message || "No se pudo completar la operación.");
    }
  };

  const handleSyncStrava = async () => {
    if (!profile?.id) return;
    try {
      setStravaSyncing(true);
      Vibration.vibrate(50);
      const result = await stravaSyncService.syncActivities(profile.id);

      Vibration.vibrate([0, 100, 50, 100]);

      Alert.alert(
        "Sincronización de Strava",
        `Sincronización completada.\n\nCarreras importadas: ${result.imported}\nCarreras duplicadas omitidas: ${result.skipped}\nErrores: ${result.errors || 0}`,
        [
          {
            text: "Aceptar",
            onPress: () => {
              if (result.imported > 0) {
                fetchProfileData();
              }
            }
          }
        ]
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error de Sincronización", e?.message || "No se pudo conectar con Strava.");
    } finally {
      setStravaSyncing(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Eliminar Cuenta",
      "¿Estás seguro de que quieres eliminar tu cuenta definitivamente? Esta acción es irreversible y perderás todos tus territorios conquistados, carreras y estadísticas de juego.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await cleanupBackgroundTracking();
              if (profile?.id) {
                // Borrar datos asociados del usuario en la base de datos
                await supabase.from('territories').delete().eq('user_id', profile.id);
                await supabase.from('runs').delete().eq('user_id', profile.id);
                await supabase.from('user_integrations').delete().eq('user_id', profile.id);
                await supabase.from('profiles').delete().eq('id', profile.id);
              }
              await supabase.auth.signOut();
              Alert.alert("Cuenta Eliminada", "Tus datos han sido eliminados de la plataforma.");
            } catch (err) {
              console.error("Error al borrar cuenta:", err);
              // Si falla por políticas de RLS, al menos forzar el cierre de sesión
              await supabase.auth.signOut();
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.accent} size="large" />
    </View>
  );

  const TERRITORY_COLORS = [
    '#00FFFF', '#FF007F', '#8000FF', '#FFD700',
    '#31007E', '#FF3399', '#00FF99', '#FF8C00',
    '#87CEEB', '#FFF48D', '#FF4D4D', '#ADFF2F',
    '#FF1493', '#40E0D0', '#64B5F6', '#FFD600',
    '#000080', '#4B0082', '#9400D3', '#32CD32',
    '#E0FFFF', '#99FFFF', '#FFC107', '#E6E6FA'
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top }}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarTouch}>
            <Svg width={116} height={116} style={styles.progressRing}>
              <Circle
                cx="58"
                cy="58"
                r="53"
                stroke="#161722"
                strokeWidth="4"
                fill="none"
              />
              <Circle
                cx="58"
                cy="58"
                r="53"
                stroke="#00F3FF"
                strokeWidth="4"
                fill="none"
                strokeDasharray="333"
                strokeDashoffset={333 * (1 - ((profile?.experience || 0) % 1000) / 1000)}
                strokeLinecap="round"
                transform="rotate(-90 58 58)"
              />
            </Svg>
            <Image
              source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
            <View style={styles.cameraIcon}>
              <Camera size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Info de Puntos XP y restantes */}
        <View style={styles.xpInfoContainer}>
          <Text style={styles.xpTextMain}>
            {((profile?.experience || 0) % 1000)} <Text style={styles.xpTextSub}>/ 1000 XP</Text>
          </Text>
          <Text style={styles.xpRemainingText}>
            Faltan {1000 - ((profile?.experience || 0) % 1000)} XP para el siguiente nivel
          </Text>
        </View>

        <View style={styles.nameRow}>
          {editMode ? (
            <TextInput
              style={styles.nameInput}
              value={newUsername}
              onChangeText={setNewUsername}
              autoFocus
              onBlur={handleUpdateUsername}
              onSubmitEditing={handleUpdateUsername}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditMode(true)} style={styles.nameEditBtn}>
              <View style={styles.nameContainer}>
                <Text style={styles.name}>{profile?.username || 'Atleta Runquer'}</Text>
                <Text style={styles.profileFlag}>{getFlagEmoji(profile?.country_code || 'ES')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.bio}>{getLevelTitle(Math.floor((profile?.experience || 0) / 1000) + 1)} • Nivel {Math.floor((profile?.experience || 0) / 1000) + 1}</Text>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => {
              if (!profile?.id) return;
              navigation.navigate('SocialList', {
                type: 'followers',
                userId: profile.id,
                username: profile.username || 'Atleta'
              });
            }}
          >
            <Text style={styles.socialValue}>{stats.followers}</Text>
            <Text style={styles.socialLabel}>Seguidores</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => {
              if (!profile?.id) return;
              navigation.navigate('SocialList', {
                type: 'following',
                userId: profile.id,
                username: profile.username || 'Atleta'
              });
            }}
          >
            <Text style={styles.socialValue}>{stats.following}</Text>
            <Text style={styles.socialLabel}>Siguiendo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorPickerSection}>
          <Text style={styles.colorPickerTitle}>COLOR DE TERRITORIO (ESTILO)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorList}>
            {TERRITORY_COLORS.map((color, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleColorSelect(color)}
                style={[
                  styles.hexagonWrapper,
                  { backgroundColor: color, transform: [{ rotate: '45deg' }] }, // Un diamante (parecido a hexágono) muy estable
                  profile?.territory_color?.toLowerCase() === color.toLowerCase() && { borderColor: '#FFF', borderWidth: 3 }
                ]}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>CARGA SEMANAL - ÚLTIMOS 3 MESES (Kms)</Text>
        <LineChart
          data={{
            labels: ["12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "Ult"],
            datasets: [{
              data: stats.weeklyData,
              color: (opacity = 1) => `rgba(0, 243, 255, ${opacity})`,
              strokeWidth: 3
            }]
          }}
          width={screenWidth - 40}
          height={180}
          chartConfig={{
            backgroundColor: '#000',
            backgroundGradientFrom: '#0A0B14',
            backgroundGradientTo: '#0A0B14',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 243, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(136, 136, 136, ${opacity})`,
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#00F3FF" },
            propsForLabels: { fontSize: 9 }
          }}
          style={styles.chart}
          withInnerLines={false}
          withOuterLines={false}
        />

        <TouchableOpacity
          style={styles.expandHeader}
          onPress={() => setIsKmsExpanded(!isKmsExpanded)}
        >
          <Text style={styles.expandTitle}>KMS SEMANALES</Text>
          {isKmsExpanded ? <ChevronUp size={20} color="#00F3FF" /> : <ChevronDown size={20} color="#888" />}
        </TouchableOpacity>

        {isKmsExpanded && (
          <View style={styles.expandedList}>
            {stats.weekLabels.map((label, index) => (
              <View key={index} style={styles.weekRow}>
                <Text style={styles.weekRowDate}>{label}</Text>
                <Text style={styles.weekRowKm}>{stats.weeklyData[index].toFixed(1)} km</Text>
              </View>
            )).reverse()}
          </View>
        )}
      </View>

      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL KMS AÑO</Text>
          <Text style={styles.kpiValue}>{(stats.totalDistance / 1000).toFixed(1)} km</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ÁREA CONQUISTADA</Text>
          <Text style={styles.kpiValue}>
            {((profile?.total_area || 0) / 1000000).toFixed(4)}
            <Text style={{ fontSize: 12 }}> km²</Text>
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ActivitiesHistory')}>
          <History size={20} color="#FF007F" />
          <Text style={styles.actionText}>Actividades</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Achievements')}>
          <Trophy size={20} color="#00F3FF" />
          <Text style={styles.actionText}>Récords</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Chat', { initialTab: 'global' })}>
          <Users size={20} color="#FFD700" />
          <Text style={styles.actionText}>Social</Text>
        </TouchableOpacity>
      </View>

      {/* SECCIÓN DE CONFIGURACIÓN DE AUDIOGUÍA */}
      <View style={styles.audioguideCard}>
        <Text style={styles.audioguideTitle}>AUDIOGUÍA (ALERTAS DE VOZ)</Text>
        
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Alertas de voz en carrera</Text>
          <TouchableOpacity 
            style={[styles.toggleBtn, audioCuesEnabled ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={() => handleToggleAudioCues(!audioCuesEnabled)}
          >
            <Text style={audioCuesEnabled ? styles.toggleTextActive : styles.toggleTextInactive}>
              {audioCuesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
            </Text>
          </TouchableOpacity>
        </View>

        {audioCuesEnabled && (
          <View style={styles.voiceSelectSection}>
            <Text style={styles.voiceListLabel}>Seleccionar voz en español:</Text>
            {availableVoices.length === 0 ? (
              <Text style={{ color: '#666', fontSize: 12, fontFamily: 'Outfit-Medium', marginBottom: 10 }}>
                No se encontraron voces en español instaladas.
              </Text>
            ) : (
              <ScrollView 
                style={styles.voiceScrollView} 
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {availableVoices.map((voice) => {
                  const isActive = voice.identifier === selectedVoiceId;
                  const isES = voice.language.toLowerCase().replace('_', '-').startsWith('es-es');
                  const nameLower = voice.name.toLowerCase();
                  const isMale = nameLower.includes('jorge') || nameLower.includes('sfs') || nameLower.includes('esc') || nameLower.includes('dcc') || nameLower.includes('male') || nameLower.includes('varón') || nameLower.includes('varon');
                  
                  return (
                    <TouchableOpacity 
                      key={voice.identifier}
                      style={[styles.voiceItem, isActive && styles.voiceItemActive]}
                      onPress={() => handleSelectVoice(voice.identifier)}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.voiceName}>{voice.name}</Text>
                        <Text style={styles.voiceLang}>
                          {isES ? 'España (Nacional)' : 'Internacional'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.voiceBadge, isActive && styles.voiceBadgeActive]}>
                          <Text style={[styles.voiceBadgeText, isActive && styles.voiceBadgeTextActive]}>
                            {isMale ? 'Varón' : 'Mujer'}
                          </Text>
                        </View>
                        {isActive && (
                          <View style={[styles.voiceBadge, { backgroundColor: '#00F3FF' }]}>
                            <Text style={[styles.voiceBadgeText, { color: '#000' }]}>Activo</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {selectedVoiceId !== "" && (
              <TouchableOpacity 
                style={[styles.playTestBtn, isPlayingTest && styles.playTestBtnActive]} 
                onPress={handlePlayTestVoice}
                disabled={isPlayingTest}
              >
                {isPlayingTest ? (
                  <ActivityIndicator size="small" color="#00F3FF" style={{ marginRight: 8 }} />
                ) : (
                  <Play size={16} color={isPlayingTest ? '#00F3FF' : '#FFF'} style={{ marginRight: 8 }} />
                )}
                <Text style={[styles.playTestText, isPlayingTest && { color: '#00F3FF' }]}>
                  {isPlayingTest ? 'Reproduciendo...' : 'Reproducir prueba de voz'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncHealthKit}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#00F3FF" size="small" style={{ marginRight: 10 }} />
          ) : (
            <Heart size={20} color="#FF007F" fill="#FF007F" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.syncText}>
            {syncing ? "Sincronizando Apple Health..." : "Sincronizar Apple Health"}
          </Text>
        </TouchableOpacity>
      )}

      {/* BOTÓN DE VINCULACIÓN / SINCRONIZACIÓN DE STRAVA */}
      {isStravaLinked ? (
        <TouchableOpacity
          style={[styles.syncButton, { borderColor: '#FF5A00', marginTop: 10 }]}
          onPress={handleSyncStrava}
          disabled={stravaSyncing}
          onLongPress={handleLinkStrava}
        >
          {stravaSyncing ? (
            <ActivityIndicator color="#FF5A00" size="small" style={{ marginRight: 10 }} />
          ) : (
            <StravaIcon size={20} color="#FF5A00" />
          )}
          <Text style={styles.syncText}>
            {stravaSyncing ? "Sincronizando..." : "Sincronizar "}
          </Text>
          {!stravaSyncing && <StravaWordmark color="#FF5A00" height={13} />}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.syncButton, { borderColor: '#FF5A00', backgroundColor: '#FF5A00', marginTop: 10 }]}
          onPress={handleLinkStrava}
        >
          <StravaIcon size={20} color="#FFF" />
          <Text style={[styles.syncText, { color: '#FFF' }]}>Vincular con </Text>
          <StravaWordmark color="#FFF" height={13} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.settingsButton} onPress={handleLogout}>
        <Settings size={20} color="#888" />
        <Text style={styles.settingsText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Trash2 size={20} color="#FF0055" />
        <Text style={styles.deleteText}>Eliminar Cuenta Definitivamente</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 20 },
  avatarContainer: {
    width: 116,
    height: 116,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  avatarTouch: {
    width: 116,
    height: 116,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#00F3FF',
    padding: 6,
    borderRadius: 15,
  },
  xpInfoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  xpTextMain: {
    color: '#00F3FF',
    fontSize: 16,
    fontFamily: 'Outfit-Black',
  },
  xpTextSub: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
  },
  xpRemainingText: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    marginTop: 2,
  },
  name: { color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Black' },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  profileFlag: { fontSize: 20, marginLeft: 10 },
  bio: { color: '#888', fontSize: 14, fontFamily: 'Outfit-Regular', marginTop: 5 },
  socialRow: { flexDirection: 'row', marginTop: 20, backgroundColor: '#0A0B14', padding: 15, borderRadius: 20, width: '90%' },
  socialStat: { flex: 1, alignItems: 'center' },
  socialValue: { color: '#FFF', fontSize: 18, fontFamily: 'Outfit-Bold' },
  socialLabel: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Regular' },
  divider: { width: 1, height: '100%', backgroundColor: '#222' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  nameInput: { color: '#00F3FF', fontSize: 24, fontFamily: 'Outfit-Black', borderBottomWidth: 1, borderBottomColor: '#00F3FF' },
  nameEditBtn: { padding: 5 },
  statsSection: { padding: 20 },
  sectionTitle: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Bold', letterSpacing: 1, marginBottom: 15 },
  chart: { borderRadius: 16, marginVertical: 8 },
  kpiContainer: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between' },
  kpiCard: { backgroundColor: '#0A0B14', width: '48%', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#222' },
  kpiLabel: { color: '#888', fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1 },
  kpiValue: { color: '#FFF', fontSize: 22, fontFamily: 'Outfit-Black', marginTop: 5 },
  actions: { padding: 20, flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { backgroundColor: '#0A0B14', padding: 20, borderRadius: 20, alignItems: 'center', width: '31%', borderWidth: 1, borderColor: '#222' },
  actionText: { color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Bold', marginTop: 8 },
  settingsButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginTop: 10, marginBottom: 15, padding: 15, backgroundColor: '#0A0B14', borderRadius: 20, width: '90%', justifyContent: 'center' },
  settingsText: { color: '#888', fontSize: 14, marginLeft: 10, fontFamily: 'Outfit-Medium' },
  deleteButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginBottom: 50, padding: 15, backgroundColor: '#110005', borderRadius: 20, width: '90%', justifyContent: 'center', borderWidth: 1, borderColor: '#330011' },
  deleteText: { color: '#FF0055', fontSize: 14, marginLeft: 10, fontFamily: 'Outfit-Bold' },
  syncButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginTop: 25, marginBottom: 10, padding: 15, backgroundColor: '#0A0B14', borderRadius: 20, width: '90%', justifyContent: 'center', borderWidth: 1, borderColor: '#331122' },
  syncText: { color: '#FFF', fontSize: 14, fontFamily: 'Outfit-Bold' },
  colorPickerSection: { width: '90%', marginTop: 25, paddingBottom: 10 },
  colorPickerTitle: { color: '#666', fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1, marginBottom: 15, textAlign: 'center' },
  colorList: { paddingHorizontal: 20, alignItems: 'center' },
  hexagonWrapper: {
    width: 30,
    height: 30,
    marginHorizontal: 12,
    marginVertical: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 15,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  expandTitle: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  expandedList: {
    backgroundColor: '#0A0B14',
    padding: 10,
    marginTop: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#1A1B25',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1B25',
    paddingHorizontal: 10,
  },
  weekRowDate: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  weekRowKm: {
    color: '#00F3FF',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  audioguideCard: {
    backgroundColor: '#0A0B14',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222',
    width: '90%',
    alignSelf: 'center',
    marginTop: 20,
  },
  audioguideTitle: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
    marginBottom: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  toggleLabel: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#001A1F',
    borderColor: '#00F3FF',
  },
  toggleBtnInactive: {
    backgroundColor: '#111',
    borderColor: '#333',
  },
  toggleTextActive: {
    color: '#00F3FF',
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
  },
  toggleTextInactive: {
    color: '#666',
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
  },
  voiceSelectSection: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 15,
  },
  voiceListLabel: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    marginBottom: 10,
  },
  voiceScrollView: {
    maxHeight: 150,
    marginBottom: 15,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  voiceItemActive: {
    borderColor: '#00F3FF',
    backgroundColor: '#001A1F',
  },
  voiceName: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  voiceLang: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    marginTop: 2,
  },
  voiceBadge: {
    backgroundColor: '#222',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginLeft: 6,
  },
  voiceBadgeActive: {
    backgroundColor: '#00F3FF',
  },
  voiceBadgeText: {
    color: '#AAA',
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
  },
  voiceBadgeTextActive: {
    color: '#000',
  },
  playTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  playTestBtnActive: {
    borderColor: '#00F3FF',
    backgroundColor: '#001A1F',
  },
  playTestText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    marginLeft: 8,
  }
});

export default ProfileScreen;
