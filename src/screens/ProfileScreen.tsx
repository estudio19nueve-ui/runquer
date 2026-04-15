import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { runService, Run } from '../api/runService';
import { gamificationService, Achievement } from '../api/gamificationService';
import { supabase } from '../lib/supabase';
import { History, LogOut, ChevronRight, Ruler, Trophy, Palette, Zap } from 'lucide-react-native';

const COLORS = ['#FF0000', '#007AFF', '#32D74B', '#FFD600', '#BF5AF2', '#FF9F0A'];

export default function ProfileScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const profileData = await gamificationService.getMyProfile();
      setProfile(profileData);
      
      const runData = await runService.getMyRuns();
      setRuns(runData);

      const achievementData = await gamificationService.getMyAchievements();
      setAchievements(achievementData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleColorChange = async (color: string) => {
    try {
      await gamificationService.updateTerritoryColor(color);
      setProfile({ ...profile, territory_color: color });
    } catch (e) {
      console.error(e);
    }
  };

  const renderAchievement = ({ item }: { item: Achievement }) => (
    <View style={styles.achievementCard}>
      <View style={styles.achievementIcon}>
        <Trophy size={20} color="#FFD700" />
      </View>
      <Text style={styles.achievementName}>{item.name}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF0000" />}
      >
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View>
              <Text style={styles.userName}>{profile?.username || 'Explorador'}</Text>
              <View style={styles.levelBadge}>
                <Zap size={10} color="#FF0000" />
                <Text style={styles.levelText}>NIVEL {profile?.level || 1}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => supabase.auth.signOut()}>
              <LogOut size={20} color="#444" />
            </TouchableOpacity>
          </View>

          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarLabel}>
              <Text style={styles.xpText}>{profile?.experience % 1000} / 1000 XP</Text>
            </View>
            <View style={styles.xpBarBackground}>
              <View style={[styles.xpBarFill, { width: `${(profile?.experience % 1000) / 10}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ESTILO DE IMPERIO</Text>
          <View style={styles.colorRow}>
            {COLORS.map(color => (
              <TouchableOpacity 
                key={color} 
                style={[
                  styles.colorCircle, 
                  { backgroundColor: color },
                  profile?.territory_color === color && styles.colorCircleActive
                ]} 
                onPress={() => handleColorChange(color)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOGROS DESBLOQUEADOS</Text>
          <FlatList
            data={achievements}
            horizontal
            renderItem={renderAchievement}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Continúa conquistando para ganar insignias.</Text>}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HISTORIAL DE CARRERAS</Text>
          {runs.map(run => (
            <View key={run.id} style={styles.runItem}>
              <History size={18} color="#888" />
              <View style={styles.runInfo}>
                <Text style={styles.runDate}>{new Date(run.created_at).toLocaleDateString()}</Text>
                <Text style={styles.runArea}>{Math.round(run.area_sqm)} m² conquistados</Text>
              </View>
              <ChevronRight size={18} color="#222" />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    backgroundColor: '#0A0A0A',
  },
  profileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#222',
  },
  levelText: {
    color: '#FF0000',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 4,
  },
  xpBarContainer: {
    marginTop: 10,
  },
  xpBarLabel: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  xpText: {
    color: '#555',
    fontSize: 10,
    fontWeight: 'bold',
  },
  xpBarBackground: {
    height: 6,
    backgroundColor: '#111',
    borderRadius: 3,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FF0000',
    borderRadius: 3,
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderColor: '#0A0A0A',
  },
  sectionTitle: {
    color: '#444',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: '#FFF',
    transform: [{ scale: 1.1 }],
  },
  achievementCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: 120,
    marginRight: 12,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  achievementName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  runInfo: {
    flex: 1,
    marginLeft: 12,
  },
  runDate: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  runArea: {
    color: '#555',
    fontSize: 12,
  },
  emptyText: {
    color: '#333',
    fontSize: 12,
    fontStyle: 'italic',
  }
});
