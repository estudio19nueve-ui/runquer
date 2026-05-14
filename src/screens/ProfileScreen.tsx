import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert, TextInput, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Users, Trophy, History, Shield, Zap, Camera, ChevronDown, ChevronUp, Hexagon, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../lib/supabase';
import { gamificationService } from '../api/gamificationService';

const { width: screenWidth } = Dimensions.get('window');

const COLORS = {
  accent: '#00F3FF',
  background: '#000',
  card: '#0A0B14',
  text: '#FFF',
  textSecondary: '#888'
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
        setProfile(p);
        setNewUsername(p.username || "");
      }

      // Bug fix: calcular el área real sumando directamente los hexágonos actuales
      // Esto evita depender del Trigger SQL y garantiza datos correctos
      if (p?.id) {
        const { data: areaData } = await supabase
          .from('territories')
          .select('area_sqm')
          .eq('user_id', p.id);

        if (areaData) {
          const realArea = areaData.reduce((sum, t) => sum + (t.area_sqm || 0), 0);
          setProfile((prev: any) => ({ ...prev, total_area: realArea }));
        }
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
        for(let i=0; i<12; i++) {
          const weeksAgo = 11 - i;
          const start = new Date(startOfThisWeek.getTime() - (weeksAgo * MS_PER_WEEK));
          const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
          labels[i] = `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`;
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
    try {
      await gamificationService.updateTerritoryColor(color);
      setProfile({ ...profile, territory_color: color });
    } catch (e) {
      console.error(e);
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
        { text: "Salir", style: "destructive", onPress: () => supabase.auth.signOut() }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "ELIMINAR CUENTA",
      "¿ESTÁS COMPLETAMENTE SEGURO? Esta acción es irreversible y borrará para siempre todas tus carreras, conquistas y perfil. No podrás recuperar tus datos.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "ELIMINAR TODO", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase.rpc('delete_user_account');
              if (error) throw error;
              await supabase.auth.signOut();
            } catch (e: any) {
              Alert.alert("Error", "No se pudo eliminar la cuenta. Asegúrate de haber ejecutado el SQL en Supabase.");
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
      .map(char =>  127397 + char.charCodeAt(0));
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
          <TouchableOpacity onPress={pickImage}>
            <Image 
              source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/150' }} 
              style={styles.avatar} 
            />
            <View style={styles.cameraIcon}>
              <Camera size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
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
        <Text style={styles.bio}>Explorador de Imperios • Nivel {Math.floor((profile?.experience || 0) / 1000) + 1}</Text>
        
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
                  profile?.territory_color === color && { borderColor: '#FFF', borderWidth: 3 }
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
            <Text style={{fontSize: 12}}> km²</Text>
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
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#00F3FF' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#00F3FF', padding: 6, borderRadius: 15 },
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
  settingsButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginTop: 10, marginBottom: 30, padding: 15, backgroundColor: '#0A0B14', borderRadius: 20, width: '90%', justifyContent: 'center' },
  settingsText: { color: '#888', fontSize: 14, marginLeft: 10, fontFamily: 'Outfit-Medium' },
  deleteButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginBottom: 50, padding: 15, backgroundColor: '#110005', borderRadius: 20, width: '90%', justifyContent: 'center', borderWidth: 1, borderColor: '#330011' },
  deleteText: { color: '#FF0055', fontSize: 14, marginLeft: 10, fontFamily: 'Outfit-Bold' },
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
  }
});

export default ProfileScreen;
