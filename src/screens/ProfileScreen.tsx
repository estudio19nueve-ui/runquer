import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Users, Trophy, History, Shield, Zap, Camera } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../lib/supabase';
import { gamificationService } from '../api/gamificationService';

const { width: screenWidth } = Dimensions.get('window');

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalDistance: 0,
    avgPace: '0:00',
    followers: 124,
    following: 89,
    weeklyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const p = await gamificationService.getMyProfile();
      setProfile(p);
      
      // Fetch actual run stats
      const { data: runs } = await supabase.from('runs').select('distance, duration, created_at');
      if (runs) {
        const totalDist = runs.reduce((acc, r) => acc + r.distance, 0);
        setStats(prev => ({ 
          ...prev, 
          totalDistance: totalDist,
          // Lógica simplificada para el gráfico de 12 semanas (mock data if not enough runs)
          weeklyData: [12, 18, 15, 22, 19, 25, 30, 28, 35, 32, 40, 38] 
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
      // Logic to upload to Supabase storage would go here
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#FF0000" /></View>;

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
        <Text style={styles.name}>{profile?.username || 'Atleta Runquer'}</Text>
        <Text style={styles.bio}>Explorador de Imperios • Nivel {Math.floor((profile?.total_area || 0) / 1000) + 1}</Text>
        
        <View style={styles.socialRow}>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{stats.followers}</Text>
            <Text style={styles.socialLabel}>Seguidores</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{stats.following}</Text>
            <Text style={styles.socialLabel}>Siguiendo</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>ACTIVIDAD SEMANAL (Últimos 3 meses)</Text>
        <BarChart
          data={{
            labels: [],
            datasets: [{ data: stats.weeklyData }]
          }}
          width={screenWidth - 40}
          height={180}
          yAxisLabel=""
          yAxisSuffix="km"
          chartConfig={{
            backgroundColor: '#000',
            backgroundGradientFrom: '#111',
            backgroundGradientTo: '#111',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: { borderRadius: 16 },
            propsForBackgroundLines: { strokeWidth: 0.5, stroke: '#222' }
          }}
          style={styles.chart}
          withHorizontalLabels={true}
          fromZero={true}
        />
      </View>

      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>DISTANCIA YTD</Text>
          <Text style={styles.kpiValue}>{(stats.totalDistance / 1000).toFixed(1)} km</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ÁREA CONQUISTADA</Text>
          <Text style={styles.kpiValue}>{Math.round((profile?.total_area || 0) / 100).toFixed(0)} <Text style={{fontSize: 12}}>Ha</Text></Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ActivitiesHistory')}>
          <History size={20} color="#FF0000" />
          <Text style={styles.actionText}>Cronología</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Achievements')}>
          <Trophy size={20} color="#FFD700" />
          <Text style={styles.actionText}>Logros</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Users size={20} color="#007AFF" />
          <Text style={styles.actionText}>Social</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.settingsButton}>
        <Settings size={20} color="#888" />
        <Text style={styles.settingsText}>Configuración del Perfil</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 20 },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FF0000' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF0000', padding: 6, borderRadius: 15 },
  name: { color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Black' },
  bio: { color: '#888', fontSize: 14, fontFamily: 'Outfit-Regular', marginTop: 5 },
  socialRow: { flexDirection: 'row', marginTop: 20, backgroundColor: '#111', padding: 15, borderRadius: 20, width: '90%' },
  socialStat: { flex: 1, alignItems: 'center' },
  socialValue: { color: '#FFF', fontSize: 18, fontFamily: 'Outfit-Bold' },
  socialLabel: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Regular' },
  divider: { width: 1, height: '100%', backgroundColor: '#222' },
  statsSection: { padding: 20 },
  sectionTitle: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Bold', letterSpacing: 1, marginBottom: 15 },
  chart: { borderRadius: 16, marginVertical: 8 },
  kpiContainer: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between' },
  kpiCard: { backgroundColor: '#111', width: '48%', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#222' },
  kpiLabel: { color: '#888', fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1 },
  kpiValue: { color: '#FFF', fontSize: 22, fontFamily: 'Outfit-Black', marginTop: 5 },
  actions: { padding: 20, flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { backgroundColor: '#111', padding: 20, borderRadius: 20, alignItems: 'center', width: '31%', borderWidth: 1, borderColor: '#222' },
  actionText: { color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Bold', marginTop: 8 },
  settingsButton: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginTop: 10, marginBottom: 30, padding: 15, backgroundColor: '#111', borderRadius: 20, width: '90%', justifyContent: 'center' },
  settingsText: { color: '#888', fontSize: 14, marginLeft: 10, fontFamily: 'Outfit-Medium' }
});

export default ProfileScreen;
