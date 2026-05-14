import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { socialService } from '../api/socialService';
import { User, ChevronLeft, UserMinus, UserPlus } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

type SocialRouteParams = {
  SocialList: {
    type: 'followers' | 'following';
    userId: string;
    username: string;
  };
};

export default function SocialListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<SocialRouteParams, 'SocialList'>>();
  const { type, userId, username } = route.params;

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = async () => {
    if (!userId || userId === 'undefined') {
      console.warn('SocialListScreen: userId is missing');
      setLoading(false);
      return;
    }

    try {
      let data;
      if (type === 'followers') {
        data = await socialService.getFollowers(userId);
      } else {
        data = await socialService.getFollowing(userId);
      }
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => (navigation as any).navigate('UserProfile', { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <User size={24} color={COLORS.accent} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username || 'Explorador'}</Text>
        <Text style={styles.userBio}>{item.total_area ? `${(item.total_area / 1000000).toFixed(2)} km² conquistados` : 'Iniciando conquista'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{type === 'followers' ? 'SEGUIDORES' : 'SIGUIENDO'}</Text>
          <Text style={styles.subtitle}>de {username}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {type === 'followers' ? 'Nadie te sigue aún.' : 'No sigues a nadie todavía.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#111',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#111',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  userBio: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    marginTop: 2,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444',
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
  }
});
