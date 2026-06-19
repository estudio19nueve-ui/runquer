import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, UserPlus, UserMinus, Calendar, Map as MapIcon, Shield, Trophy } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { socialService } from '../api/socialService';
import { gamificationService, getLevelTitle } from '../api/gamificationService';
import { MedalIcon } from '../components/MedalIcon';
import Mapbox from '@rnmapbox/maps';
import { COLORS } from '../constants/theme';

type UserProfileRouteParams = {
  UserProfile: {
    userId: string;
  };
};

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<UserProfileRouteParams, 'UserProfile'>>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [medals, setMedals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDistance: 0,
    territoryCount: 0,
    bestPace: '--:--',
    maxDistance: 0
  });

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      // 1. Obtener perfil
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. Obtener actividades y calcular récords
      const { data: activitiesData, error: activitiesErr } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (activitiesErr) throw activitiesErr;
      setActivities(activitiesData || []);

      // Calcular estadísticas de carrera
      let totalDist = 0;
      let maxDist = 0;
      let minPaceSecs = Infinity;

      activitiesData?.forEach(run => {
        totalDist += (run.distance_meters || 0);
        if ((run.distance_meters || 0) > maxDist) maxDist = run.distance_meters;
        
        if (run.duration && run.distance_meters > 500) { // Mínimo 500m para ritmo real
          const pace = run.duration / (run.distance_meters / 1000);
          if (pace < minPaceSecs) minPaceSecs = pace;
        }
      });

      // 3. Contar territorios
      const { count: territoryCount } = await supabase
        .from('territories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setStats({
        totalDistance: totalDist,
        territoryCount: territoryCount || 0,
        maxDistance: maxDist,
        bestPace: minPaceSecs !== Infinity 
          ? `${Math.floor(minPaceSecs / 60)}:${Math.floor(minPaceSecs % 60).toString().padStart(2, '0')}`
          : '--:--'
      });

      // 4. Verificar si le sigo
      const following = await socialService.checkFollowing(userId);
      setIsFollowing(following);

      // 5. Obtener medallas del usuario visitado
      const medalsData = await gamificationService.getUserMedals(userId);
      setMedals(medalsData || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        await socialService.unfollowUser(userId);
        setIsFollowing(false);
      } else {
        await socialService.followUser(userId);
        setIsFollowing(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderActivity = ({ item }: { item: any }) => {
    const coordinates = item.path?.coordinates || item.path || [];
    const center = coordinates.length > 0 ? coordinates[0] : [0, 0];

    return (
      <TouchableOpacity 
        style={styles.activityCard}
        onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
      >
        <View style={styles.miniMapContainer}>
          <Mapbox.MapView 
            style={styles.miniMap}
            styleURL={Mapbox.StyleURL.Dark}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            {coordinates.length > 1 ? (
              <Mapbox.Camera
                bounds={{
                  ne: [
                    coordinates.reduce((max: number, c: number[]) => Math.max(max, c[0]), coordinates[0][0]),
                    coordinates.reduce((max: number, c: number[]) => Math.max(max, c[1]), coordinates[0][1])
                  ],
                  sw: [
                    coordinates.reduce((min: number, c: number[]) => Math.min(min, c[0]), coordinates[0][0]),
                    coordinates.reduce((min: number, c: number[]) => Math.min(min, c[1]), coordinates[0][1])
                  ],
                  paddingTop: 15,
                  paddingRight: 15,
                  paddingBottom: 15,
                  paddingLeft: 15,
                }}
                animationDuration={0}
              />
            ) : (
              <Mapbox.Camera centerCoordinate={center} zoomLevel={14} animationMode="none" />
            )}
            {coordinates.length > 1 && (
              <Mapbox.ShapeSource id={`route-${item.id}`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }}>
                <Mapbox.LineLayer id={`layer-${item.id}`} style={{ lineColor: COLORS.accent, lineWidth: 3 }} />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
        </View>
        <View style={styles.activityInfo}>
          <Text style={styles.activityName}>{item.name || 'Carrera Matinal'}</Text>
          <View style={styles.activityDateRow}>
            <Calendar size={12} color="#666" />
            <Text style={styles.activityDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.activityStats}>
            <View>
              <Text style={styles.statLabel}>KM</Text>
              <Text style={styles.statValue}>{(item.distance_meters / 1000).toFixed(2)}</Text>
            </View>
            <View style={{ marginLeft: 20 }}>
              <Text style={styles.statLabel}>RITMO</Text>
              <Text style={styles.statValue}>
                {item.duration && item.distance_meters > 0 
                  ? (() => {
                      const paceSecs = (item.duration / (item.distance_meters / 1000));
                      const mins = Math.floor(paceSecs / 60);
                      const secs = Math.floor(paceSecs % 60);
                      return `${mins}:${secs.toString().padStart(2, '0')}`;
                    })()
                  : '--:--'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.accent} size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Fijo */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PERFIL ATLETA</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        renderItem={renderActivity}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <Image 
              source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/150' }} 
              style={styles.avatar} 
            />
            <Text style={styles.username}>{profile?.username || 'Atleta Runquer'}</Text>
            <Text style={styles.bio}>{getLevelTitle(Math.floor((profile?.experience || 0) / 1000) + 1)} • Nivel {Math.floor((profile?.experience || 0) / 1000) + 1}</Text>
            
            <View style={styles.mainStats}>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{((profile?.total_area || 0) / 1000000).toFixed(2)}</Text>
                <Text style={styles.mainStatLabel}>km² ÁREA</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{stats.territoryCount}</Text>
                <Text style={styles.mainStatLabel}>ZONAS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{(stats.totalDistance / 1000).toFixed(1)}</Text>
                <Text style={styles.mainStatLabel}>KM TOTAL</Text>
              </View>
            </View>

            <View style={styles.prSection}>
              <Text style={styles.prTitle}>RÉCORDS PERSONALES (PRs)</Text>
              <View style={styles.prGrid}>
                <View style={styles.prCard}>
                  <Text style={styles.prLabel}>MEJOR RITMO</Text>
                  <Text style={styles.prValue}>{stats.bestPace}</Text>
                </View>
                <View style={styles.prCard}>
                  <Text style={styles.prLabel}>MAYOR DIST.</Text>
                  <Text style={styles.prValue}>{(stats.maxDistance / 1000).toFixed(1)}k</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.followButton, isFollowing && styles.unfollowButton]}
              onPress={handleFollowToggle}
            >
              {isFollowing ? (
                <><UserMinus size={18} color="#FFF" /><Text style={styles.followButtonText}> DEJAR DE SEGUIR</Text></>
              ) : (
                <><UserPlus size={18} color="#FFF" /><Text style={styles.followButtonText}> SEGUIR ATLETA</Text></>
              )}
            </TouchableOpacity>

            {/* SECCIÓN DE CONQUISTAS (MEDALLAS) */}
            <View style={styles.medalsSection}>
              <Text style={styles.medalsTitleHeader}>CONQUISTAS (MEDALLAS DIGITALES)</Text>
              {medals.length === 0 ? (
                <View style={styles.emptyMedalsCard}>
                  <Trophy size={24} color="#333" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyMedalsText}>
                    Este explorador aún no ha ganado medallas de clasificación.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.medalsList}>
                  {medals.map((medal) => {
                    const formattedDate = new Date(medal.period_start).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    const periodLabel = medal.period_type === 'weekly' ? 'Semanal' : medal.period_type === 'monthly' ? 'Mensual' : 'Anual';
                    const medalLabel = medal.medal_type === 'gold' ? 'Oro' : medal.medal_type === 'silver' ? 'Plata' : 'Bronce';
                    const area = (medal.area_sqm / 1000000).toFixed(4);

                    const handlePressMedal = () => {
                      Alert.alert(
                        `Conquista: ¡Medalla de ${medalLabel}!`,
                        `Otorgada a ${profile?.username || 'este explorador'} en la clasificación ${periodLabel.toLowerCase()} correspondiente al período que inició el ${formattedDate}.\n\nÁrea acumulada en ese período: ${area} km².`,
                        [{ text: "¡Genial!" }]
                      );
                    };

                    return (
                      <TouchableOpacity key={medal.id} style={styles.medalCard} onPress={handlePressMedal}>
                        <MedalIcon medalType={medal.medal_type} periodType={medal.period_type} size={64} />
                        <Text style={styles.medalTitle}>{medalLabel}</Text>
                        <Text style={styles.medalSubtitle}>{periodLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Text style={styles.sectionTitle}>ÚLTIMAS CONQUISTAS</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Shield size={48} color="#222" />
            <Text style={styles.emptyText}>Este explorador aún no ha registrado actividades públicas.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#111'
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Black', letterSpacing: 2 },
  backButton: { padding: 5 },
  listContent: { paddingBottom: 40 },
  profileHeader: { alignItems: 'center', padding: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.accent },
  username: { color: '#FFF', fontSize: 28, fontFamily: 'Outfit-Black', marginTop: 15 },
  bio: { color: '#666', fontSize: 14, fontFamily: 'Outfit-Medium' },
  mainStats: { 
    flexDirection: 'row', 
    backgroundColor: '#0A0B14', 
    padding: 20, 
    borderRadius: 25, 
    marginTop: 25, 
    width: '100%',
    borderWidth: 1,
    borderColor: '#111'
  },
  mainStat: { flex: 1, alignItems: 'center' },
  mainStatValue: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Black' },
  mainStatLabel: { color: '#555', fontSize: 10, fontFamily: 'Outfit-Bold' },
  statDivider: { width: 1, height: '100%', backgroundColor: '#222' },
  followButton: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.accent, 
    paddingVertical: 15, 
    paddingHorizontal: 30, 
    borderRadius: 30, 
    marginTop: 25,
    alignItems: 'center'
  },
  unfollowButton: { backgroundColor: '#333' },
  followButtonText: { color: '#FFF', fontSize: 14, fontFamily: 'Outfit-Black' },
  prSection: { width: '100%', marginTop: 30 },
  prTitle: { color: '#444', fontSize: 10, fontFamily: 'Outfit-Black', letterSpacing: 1, marginBottom: 10 },
  prGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  prCard: { backgroundColor: '#0A0B14', padding: 15, borderRadius: 15, width: '48%', borderWidth: 1, borderColor: '#111' },
  prLabel: { color: '#666', fontSize: 8, fontFamily: 'Outfit-Bold' },
  prValue: { color: '#FFF', fontSize: 18, fontFamily: 'Outfit-Black', marginTop: 4 },
  sectionTitle: { 
    color: '#333', 
    fontSize: 12, 
    fontFamily: 'Outfit-Black', 
    alignSelf: 'flex-start', 
    marginTop: 40,
    letterSpacing: 2
  },
  activityCard: { 
    flexDirection: 'row', 
    backgroundColor: '#0A0B14', 
    marginHorizontal: 20, 
    marginBottom: 15, 
    borderRadius: 20, 
    padding: 12,
    borderWidth: 1,
    borderColor: '#111'
  },
  miniMapContainer: { width: 90, height: 90, borderRadius: 15, overflow: 'hidden', backgroundColor: '#111' },
  miniMap: { flex: 1 },
  activityInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  activityName: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold' },
  activityDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  activityDate: { color: '#666', fontSize: 11, marginLeft: 5 },
  activityStats: { flexDirection: 'row', marginTop: 10 },
  statLabel: { color: '#444', fontSize: 8, fontFamily: 'Outfit-Black' },
  statValue: { color: COLORS.accent, fontSize: 16, fontFamily: 'Outfit-Black' },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginTop: 15 },
  medalsSection: {
    width: '100%',
    marginTop: 25,
  },
  medalsTitleHeader: {
    color: '#444',
    fontSize: 10,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  medalsList: {
    paddingVertical: 5,
    paddingRight: 10,
  },
  medalCard: {
    backgroundColor: '#0A0B14',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 20,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    width: 95,
  },
  medalTitle: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
    marginTop: 6,
  },
  medalSubtitle: {
    color: '#666',
    fontSize: 9,
    fontFamily: 'Outfit-Medium',
    marginTop: 1,
  },
  emptyMedalsCard: {
    backgroundColor: '#0A0B14',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyMedalsText: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
    lineHeight: 16,
  },
});
