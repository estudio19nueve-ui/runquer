import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rankingService, LeaderboardEntry } from '../api/rankingService';
import { Trophy, Map as MapIcon, User } from 'lucide-react-native';

/**
 * Pantalla de Ranking Global con estética premium.
 */
export default function RankingScreen() {
  const insets = useSafeAreaInsets();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRanking = async () => {
    try {
      const data = await rankingService.getLeaderboard();
      setLeaders(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRanking();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRanking();
    setRefreshing(false);
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
    <View style={styles.rankItem}>
      <View style={styles.rankNumberContainer}>
        {index < 3 ? (
          <Trophy size={24} color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
        ) : (
          <Text style={styles.rankNumber}>{index + 1}</Text>
        )}
      </View>
      
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username || 'Explorador Anónimo'}</Text>
        <View style={styles.statsRow}>
          <MapIcon size={12} color="#888" style={{ marginRight: 4 }} />
          <Text style={styles.territories}>{item.total_territories} zonas</Text>
        </View>
      </View>

      <View style={styles.areaInfo}>
        <Text style={styles.areaAmount}>{(item.total_area_sqm / 1000000).toFixed(4)}</Text>
        <Text style={styles.areaUnit}>km²</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>TOP CONQUISTADORES</Text>
        <View style={styles.headerAccent} />
      </View>

      <FlatList
        data={leaders}
        renderItem={renderItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#00F3FF" 
            colors={['#00F3FF']} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Buscando líderes...</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    padding: 20,
    marginBottom: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Outfit-Black',
    letterSpacing: 2,
  },
  headerAccent: {
    height: 4,
    width: 60,
    backgroundColor: '#00F3FF',
    marginTop: 8,
    borderRadius: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0B14',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  rankNumberContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankNumber: {
    color: '#888888',
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  territories: {
    color: '#888888',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  areaInfo: {
    alignItems: 'flex-end',
  },
  areaAmount: {
    color: '#00F3FF',
    fontSize: 18,
    fontFamily: 'Outfit-Black',
  },
  areaUnit: {
    color: '#888888',
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444444',
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
  },
});
