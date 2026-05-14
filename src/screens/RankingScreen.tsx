import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rankingService, LeaderboardEntry } from '../api/rankingService';
import { Trophy, Map as MapIcon, UserPlus, UserCheck } from 'lucide-react-native';
import { socialService } from '../api/socialService';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function RankingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'total'>('total');

  const loadRanking = async () => {
    setLoading(true);
    try {
      const data = await rankingService.getLeaderboard(period);
      setLeaders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      if (user) {
        const { data: follows } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('follower_id', user.id);
        if (follows) {
          setFollowingIds(new Set(follows.map(f => f.followed_id)));
        }
      }
      await loadRanking();
    };
    init();
  }, [period]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRanking();
    setRefreshing(false);
  };

  const handleFollow = async (userId: string) => {
    if (!currentUserId || userId === currentUserId) return;
    try {
      if (followingIds.has(userId)) {
        await socialService.unfollowUser(userId);
        followingIds.delete(userId);
      } else {
        await socialService.followUser(userId);
        followingIds.add(userId);
      }
      setFollowingIds(new Set(followingIds));
    } catch (e: any) {
      Alert.alert("Error Social", e.message || "No se pudo realizar la acción.");
    }
  };

  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return "🌍";
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return "🌍";
    }
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.user_id === currentUserId;
    const isFollowing = followingIds.has(item.user_id);

    return (
      <View style={styles.rankItem}>
        <View style={styles.rankNumberContainer}>
          {index < 3 ? (
            <Trophy size={24} color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
        >
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{item.username || 'Explorador Anónimo'}</Text>
            <Text style={styles.flag}>{getFlagEmoji(item.country_code || 'ES')}</Text>
          </View>
          <View style={styles.statsRow}>
            <MapIcon size={12} color="#888" style={{ marginRight: 4 }} />
            <Text style={styles.territories}>{item.total_territories} zonas</Text>
          </View>
        </TouchableOpacity>
  
        <View style={styles.areaInfo}>
          <Text style={styles.areaAmount}>{(item.total_area_sqm / 1000000).toFixed(4)}</Text>
          <Text style={styles.areaUnit}>km²</Text>
        </View>

        {!isMe && (
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing && styles.followingBtn]} 
            onPress={() => handleFollow(item.user_id)}
          >
            {isFollowing ? <UserCheck size={18} color="#00F3FF" /> : <UserPlus size={18} color="#666" />}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>RANKING</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, period === 'weekly' && styles.tabActive]} 
            onPress={() => setPeriod('weekly')}
          >
            <Text style={[styles.tabText, period === 'weekly' && styles.tabTextActive]}>SEM</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, period === 'monthly' && styles.tabActive]} 
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.tabText, period === 'monthly' && styles.tabTextActive]}>MES</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, period === 'total' && styles.tabActive]} 
            onPress={() => setPeriod('total')}
          >
            <Text style={[styles.tabText, period === 'total' && styles.tabTextActive]}>TODO</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={leaders}
        renderItem={renderItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00F3FF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Cargando ranking...' : 'Todavía no hay conquistas en este periodo'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, marginBottom: 10 },
  title: { color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Black', letterSpacing: 2 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, marginTop: 15, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#00F3FF' },
  tabText: { color: '#666', fontSize: 11, fontFamily: 'Outfit-Bold' },
  tabTextActive: { color: '#000' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  rankItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0B14', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  rankNumberContainer: { width: 40, alignItems: 'center' },
  rankNumber: { color: '#888', fontSize: 18, fontFamily: 'Outfit-Bold' },
  userInfo: { flex: 1, marginLeft: 10 },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { color: '#FFF', fontSize: 15, fontFamily: 'Outfit-Bold' },
  flag: { fontSize: 14, marginLeft: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  territories: { color: '#888', fontSize: 11, fontFamily: 'Outfit-Medium' },
  areaInfo: { alignItems: 'flex-end' },
  areaAmount: { color: '#00F3FF', fontSize: 18, fontFamily: 'Outfit-Black' },
  areaUnit: { color: '#888', fontSize: 10, fontFamily: 'Outfit-Medium', textTransform: 'uppercase' },
  followBtn: { padding: 8, marginLeft: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  followingBtn: { borderColor: '#00F3FF', backgroundColor: '#001A1F' },
  emptyContainer: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 16, fontFamily: 'Outfit-Medium' }
});
