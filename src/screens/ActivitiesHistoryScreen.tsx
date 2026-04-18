import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Calendar, Map as MapIcon, Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export const ActivitiesHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Eliminar Actividad",
      "¿Estás seguro de que quieres borrar esta carrera permanentemente?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            await supabase.from('runs').delete().eq('id', id);
            setActivities(prev => prev.filter(a => a.id !== id));
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.name || 'Carrera Matinal'}</Text>
          <View style={styles.dateRow}>
            <Calendar size={12} color="#888" />
            <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Trash2 size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>DISTANCIA</Text>
          <Text style={styles.statValue}>{(item.distance / 1000).toFixed(2)} km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TIEMPO</Text>
          <Text style={styles.statValue}>{Math.floor(item.duration / 60)}m {item.duration % 60}s</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>ÁREA</Text>
          <Text style={styles.statValue}>{Math.round(item.area || 0)} m²</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#FFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.title}>CRONOLOGÍA</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#FF0000" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MapIcon size={64} color="#222" />
              <Text style={styles.emptyText}>Aún no has conquistado ningún territorio.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Black', letterSpacing: 2 },
  list: { padding: 20 },
  card: { backgroundColor: '#111', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  cardTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Outfit-Bold' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardDate: { color: '#888', fontSize: 12, marginLeft: 5, fontFamily: 'Outfit-Regular' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1 },
  statLabel: { color: '#666', fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1 },
  statValue: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Black', marginTop: 2 },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 16, textAlign: 'center', marginTop: 20, paddingHorizontal: 40, fontFamily: 'Outfit-Medium' }
});

export default ActivitiesHistoryScreen;
