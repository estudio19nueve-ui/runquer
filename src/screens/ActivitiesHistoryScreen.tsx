import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Calendar, Map as MapIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import Mapbox from '@rnmapbox/maps';

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

  const renderItem = ({ item }: { item: any }) => {
    // Manejar tanto el formato antiguo (array) como el nuevo (GeoJSON)
    const coordinates = item.path?.coordinates || item.path || [];
    const hasCoords = coordinates && coordinates.length > 0;
    const center = hasCoords ? coordinates[0] : [0, 0];

    return (
      <View style={styles.card}>
        <View style={styles.itemRow}>
          <View style={styles.mapThumbnail}>
            <Mapbox.MapView 
              style={styles.miniMap}
              styleURL={Mapbox.StyleURL.Dark}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Mapbox.Camera
                centerCoordinate={center}
                zoomLevel={15}
                animationMode="none"
              />
              {hasCoords && coordinates.length > 1 && (
                <Mapbox.ShapeSource id={`route-${item.id}`} shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates } }}>
                  <Mapbox.LineLayer id={`layer-${item.id}`} style={{ lineColor: '#00F3FF', lineWidth: 4, lineOpacity: 1 }} />
                </Mapbox.ShapeSource>
              )}
            </Mapbox.MapView>
          </View>

          <View style={styles.infoColumn}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name || 'Carrera Matinal'}</Text>
                <View style={styles.dateRow}>
                  <Calendar size={12} color="#888" />
                  <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Trash2 size={18} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatLabel}>DIST.</Text>
                <Text style={styles.miniStatValue}>{(item.distance_meters / 1000).toFixed(2)}km</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatLabel}>TIEMPO</Text>
                <Text style={styles.miniStatValue}>{item.duration ? `${Math.floor(item.duration / 60)}m` : '--'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
        <ActivityIndicator color="#00F3FF" size="large" style={{ marginTop: 40 }} />
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
  list: { padding: 15 },
  card: { backgroundColor: '#0A0B14', borderRadius: 24, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  mapThumbnail: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111' },
  miniMap: { flex: 1 },
  infoColumn: { flex: 1, marginLeft: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cardDate: { color: '#888', fontSize: 11, marginLeft: 5, fontFamily: 'Outfit-Regular' },
  statsGrid: { flexDirection: 'row', marginTop: 8 },
  miniStat: { marginRight: 20 },
  miniStatLabel: { color: '#666', fontSize: 9, fontFamily: 'Outfit-Bold' },
  miniStatValue: { color: '#00F3FF', fontSize: 14, fontFamily: 'Outfit-Black', marginTop: 2 },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 16, textAlign: 'center', marginTop: 20, paddingHorizontal: 40, fontFamily: 'Outfit-Medium' }
});

export default ActivitiesHistoryScreen;
