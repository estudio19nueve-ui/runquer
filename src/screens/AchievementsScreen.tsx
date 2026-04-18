import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trophy, ChevronLeft, Timer, MapPin, Zap } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

interface Achievement {
  id: string;
  name: string;
  distance: number;
  bestTime: number; // seconds
  date: string;
}

const DISTANCE_GOALS = [
  { name: '1 km', value: 1000 },
  { name: '5 km', value: 5000 },
  { name: '10 km', value: 10000 },
  { name: 'Media Maratón', value: 21097 },
  { name: 'Maratón', value: 42195 },
];

export const AchievementsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const { data: runs, error } = await supabase
        .from('runs')
        .select('*')
        .order('duration', { ascending: true });

      if (error) throw error;

      // Lógica simplificada de mejores marcas
      const bests = DISTANCE_GOALS.map(goal => {
        const matchingRuns = runs.filter(run => run.distance >= goal.value - 50); // Margen de error GPS
        if (matchingRuns.length > 0) {
          // Calculamos el ritmo proporcional
          const best = matchingRuns[0];
          return {
            ...goal,
            time: best.duration * (goal.value / best.distance),
            date: new Date(best.created_at).toLocaleDateString()
          };
        }
        return { ...goal, time: null };
      });

      setRecords(bests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#FFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.title}>LOGROS</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.trophyHero}>
          <Trophy color="#FFD700" size={60} />
          <Text style={styles.heroText}>Tus Mejores Marcas</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF0000" size="large" style={{ marginTop: 40 }} />
        ) : (
          records.map((item, index) => (
            <View key={index} style={styles.recordCard}>
              <View style={styles.recordIcon}>
                <Zap color={item.time ? "#FFD700" : "#333"} size={20} />
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordName}>{item.name}</Text>
                <Text style={styles.recordDate}>{item.time ? `Récord: ${item.date}` : 'Aún sin registrar'}</Text>
              </View>
              <Text style={[styles.recordTime, !item.time && { color: '#333' }]}>
                {item.time ? formatTime(item.time) : '--:--'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Black', letterSpacing: 2 },
  scroll: { padding: 20 },
  trophyHero: { alignItems: 'center', marginBottom: 30, backgroundColor: '#111', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#222' },
  heroText: { color: '#FFF', fontSize: 18, fontFamily: 'Outfit-Bold', marginTop: 10 },
  recordCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  recordIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  recordInfo: { flex: 1, marginLeft: 15 },
  recordName: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold' },
  recordDate: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Regular', marginTop: 2 },
  recordTime: { color: '#FF0000', fontSize: 22, fontFamily: 'Outfit-Black' }
});

export default AchievementsScreen;
