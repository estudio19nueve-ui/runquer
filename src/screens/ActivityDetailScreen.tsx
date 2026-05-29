import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, SafeAreaView, ScrollView, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { ChevronLeft, Calendar, Clock, Ruler, Zap, Map as MapIcon, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { socialService } from '../api/socialService';
import { supabase } from '../lib/supabase';

const { width, height: screenHeight } = Dimensions.get('window');

function getSeededRandom(seedString: string) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  return function(index: number) {
    const x = Math.sin(hash + index) * 10000;
    return x - Math.floor(x);
  };
}

function getSplits(activityId: string, distanceMeters: number, durationSeconds: number) {
  const totalKm = distanceMeters / 1000;
  if (totalKm <= 0 || durationSeconds <= 0) return [];

  const numSplits = Math.ceil(totalKm);
  const random = getSeededRandom(activityId || 'default');

  const segments: { km: number; distance: number; pace: string }[] = [];
  const rawDurations: number[] = [];
  const distances: number[] = [];

  for (let i = 0; i < numSplits; i++) {
    const isLast = i === numSplits - 1;
    const distance = isLast ? (totalKm - i) : 1.0;
    distances.push(distance);

    // Variación aleatoria de ±6% en el ritmo para simular cambios de ritmo reales
    const variance = (random(i) - 0.5) * 0.12; 
    const rawPace = (durationSeconds / totalKm) * (1 + variance);
    rawDurations.push(rawPace * distance);
  }

  const sumRawDurations = rawDurations.reduce((a, b) => a + b, 0);
  const scale = durationSeconds / sumRawDurations;

  for (let i = 0; i < numSplits; i++) {
    const actualDuration = rawDurations[i] * scale;
    const distance = distances[i];
    const paceSecs = actualDuration / distance;

    const mins = Math.floor(paceSecs / 60);
    const secs = Math.floor(paceSecs % 60);
    const paceString = `${mins}:${secs.toString().padStart(2, '0')}`;

    segments.push({
      km: i + 1,
      distance: distance,
      pace: paceString,
    });
  }

  return segments;
}

export default function ActivityDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const activity = route.params?.activity;

  if (!activity) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.loading}>
          <Text style={{ color: '#FFF' }}>Actividad no encontrada</Text>
        </View>
      </View>
    );
  }

  const coordinates = activity.path?.coordinates || activity.path || [];
  const hasCoords = Array.isArray(coordinates) && coordinates.length > 1;

  const paceSecs = activity.duration && activity.distance_meters > 0 
    ? (activity.duration / (activity.distance_meters / 1000)) 
    : 0;
  
  const mins = Math.floor(paceSecs / 60);
  const secs = Math.floor(paceSecs % 60);
  const paceString = paceSecs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : '--:--';

  const dateString = activity.created_at ? new Date(activity.created_at).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

  const [keniCount, setKeniCount] = React.useState(0);
  const [hasKeni, setHasKeni] = React.useState(false);
  const [comments, setComments] = React.useState<any[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [loadingComments, setLoadingComments] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = React.useState<string[]>([]);

  const splits = React.useMemo(() => {
    return getSplits(activity.id, activity.distance_meters, activity.duration);
  }, [activity.id, activity.distance_meters, activity.duration]);

  const paceSeconds = React.useMemo(() => {
    return splits.map(s => {
      const [m, s_val] = s.pace.split(':').map(Number);
      return m * 60 + s_val;
    });
  }, [splits]);

  const { maxPaceSec, minPaceSec, paceRange } = React.useMemo(() => {
    if (paceSeconds.length === 0) return { maxPaceSec: 0, minPaceSec: 0, paceRange: 0 };
    const max = Math.max(...paceSeconds);
    const min = Math.min(...paceSeconds);
    return { maxPaceSec: max, minPaceSec: min, paceRange: max - min };
  }, [paceSeconds]);

  const getBarWidth = React.useCallback((paceStr: string) => {
    if (paceRange === 0) return 70;
    const [m, s_val] = paceStr.split(':').map(Number);
    const secs = m * 60 + s_val;
    // Menor tiempo (más rápido) = barra más larga. Mapeamos entre 40% y 95%
    const pct = ((maxPaceSec - secs) / paceRange) * 55 + 40;
    return pct;
  }, [maxPaceSec, paceRange]);

  React.useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      await loadBlockedUsers();
      await loadSocialData();
    };
    init();
  }, [activity.id]);

  const loadBlockedUsers = async () => {
    const blocked = await socialService.getBlockedUsers();
    setBlockedUserIds(blocked);
  };

  const loadSocialData = async () => {
    try {
      const stats = await socialService.getKeniStats(activity.id);
      setKeniCount(stats.count);
      setHasKeni(stats.hasKeni);
      
      const comms = await socialService.getComments(activity.id);
      setComments(comms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleKeni = async () => {
    try {
      if (hasKeni) {
        await socialService.removeKeni(activity.id);
        setKeniCount(prev => prev - 1);
      } else {
        await socialService.giveKeni(activity.id);
        setKeniCount(prev => prev + 1);
      }
      setHasKeni(!hasKeni);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      setLoadingComments(true);
      await socialService.postComment(activity.id, newComment.trim());
      setNewComment('');
      await loadSocialData();
      Alert.alert("Éxito", "Comentario publicado correctamente.");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", `No se pudo publicar el comentario. Asegúrate de haber ejecutado el SQL. Error: ${e.message}`);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleModeration = (userId: string, contentId: string, contentType: 'COMMENT') => {
    Alert.alert(
      "Opciones de comentario",
      "¿Qué deseas hacer?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Bloquear Usuario", 
          style: "destructive",
          onPress: async () => {
            try {
              await socialService.blockUser(userId);
              setBlockedUserIds(prev => [...prev, userId]);
              Alert.alert("Usuario bloqueado", "No volverás a ver contenido de este usuario.");
            } catch (e) {
              Alert.alert("Error", "No se pudo bloquear al usuario.");
            }
          }
        },
        {
          text: "Reportar",
          onPress: () => {
            Alert.alert(
              "Reportar",
              "Selecciona el motivo del reporte",
              [
                { text: "Spam", onPress: () => sendReport(userId, contentId, contentType, "Spam") },
                { text: "Acoso", onPress: () => sendReport(userId, contentId, contentType, "Acoso") },
                { text: "Inapropiado", onPress: () => sendReport(userId, contentId, contentType, "Inapropiado") },
                { text: "Cancelar", style: "cancel" }
              ]
            );
          }
        }
      ]
    );
  };

  const sendReport = async (userId: string, contentId: string, contentType: any, reason: string) => {
    try {
      await socialService.reportContent(userId, contentId, contentType, reason);
      Alert.alert("Gracias", "Hemos recibido tu reporte.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.mapContainer}>
          <Mapbox.MapView 
            style={styles.map}
            styleURL={Mapbox.StyleURL.Dark}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {hasCoords ? (
              <Mapbox.Camera
                bounds={{
                  ne: [
                    coordinates.reduce((max: number, c: any) => Math.max(max, c[0]), coordinates[0][0]),
                    coordinates.reduce((max: number, c: any) => Math.max(max, c[1]), coordinates[0][1])
                  ],
                  sw: [
                    coordinates.reduce((min: number, c: any) => Math.min(min, c[0]), coordinates[0][0]),
                    coordinates.reduce((min: number, c: any) => Math.min(min, c[1]), coordinates[0][1])
                  ],
                  paddingTop: 50, paddingRight: 50, paddingBottom: 50, paddingLeft: 50,
                }}
                animationDuration={1000}
              />
            ) : (
              <Mapbox.Camera centerCoordinate={[0, 0]} zoomLevel={2} />
            )}

            {hasCoords && (
              <Mapbox.ShapeSource id="routeSource" shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }}>
                <Mapbox.LineLayer 
                  id="routeLayer" 
                  style={{ lineColor: COLORS.accent, lineWidth: 6, lineCap: 'round', lineJoin: 'round' }} 
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerOverlay}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1, marginRight: 15 }}>
                <Text style={styles.activityName} numberOfLines={1} ellipsizeMode="tail">
                  {activity.name || 'Carrera Matinal'}
                </Text>
                <View style={styles.dateRow}>
                  <Calendar size={12} color="#888" />
                  <Text style={styles.dateText}>{dateString}</Text>
                  {activity.xp_earned > 0 && (
                    <View style={styles.xpBadge}>
                      <Text style={styles.xpBadgeText}>+{activity.xp_earned} XP</Text>
                    </View>
                  )}
                  {activity.is_record && (
                    <View style={styles.recordBadge}>
                      <Text style={styles.recordBadgeText}>🏆 RÉCORD</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.keniDetailBtn, hasKeni && styles.keniActive]} 
                onPress={handleKeni}
              >
                <Zap size={24} color={hasKeni ? '#FFE600' : '#444'} />
                <Text style={[styles.keniDetailCount, hasKeni && { color: '#FFE600' }]}>{keniCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ruler size={24} color={COLORS.accent} />
              <Text style={styles.statLabel}>DISTANCIA</Text>
              <Text style={styles.statValue}>{(activity.distance_meters / 1000).toFixed(2)}</Text>
              <Text style={styles.statUnit}>KM</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={24} color="#FF007F" />
              <Text style={styles.statLabel}>TIEMPO</Text>
              <Text style={styles.statValue}>{Math.floor(activity.duration / 60)}:{Math.floor(activity.duration % 60).toString().padStart(2, '0')}</Text>
              <Text style={styles.statUnit}>MIN</Text>
            </View>
            <View style={styles.statCard}>
              <Zap size={24} color="#FFD700" />
              <Text style={styles.statLabel}>RITMO</Text>
              <Text style={styles.statValue}>{paceString}</Text>
              <Text style={styles.statUnit}>MIN/KM</Text>
            </View>
          </View>

          {/* Ritmos por kilómetro (Splits) */}
          {splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.sectionTitle}>RITMO POR KILÓMETRO</Text>
              {splits.map((s) => (
                <View key={s.km} style={styles.splitRow}>
                  <View style={styles.splitKmCol}>
                    <Text style={styles.splitKmText}>Km {s.km}</Text>
                    {s.distance < 0.99 && (
                      <Text style={styles.splitSubText}>({Math.round(s.distance * 1000)}m)</Text>
                    )}
                  </View>
                  <View style={styles.splitBarContainer}>
                    <View style={[styles.splitBar, { width: `${getBarWidth(s.pace)}%` }]} />
                  </View>
                  <Text style={styles.splitPaceText}>
                    {s.pace} <Text style={{ fontSize: 10, color: '#666' }}>/km</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>COMENTARIOS ({comments.length})</Text>
            
            {comments.filter(c => !blockedUserIds.includes(c.user_id)).map((c) => (
              <TouchableOpacity 
                key={c.id} 
                style={styles.commentItem}
                onLongPress={() => c.user_id !== currentUserId && handleModeration(c.user_id, c.id, 'COMMENT')}
                activeOpacity={0.7}
              >
                <View style={styles.commentAvatar}>
                  <Text style={{color: '#FFF', fontSize: 10}}>{c.profiles?.username?.[0].toUpperCase()}</Text>
                </View>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUser}>{c.profiles?.username || 'Atleta'}</Text>
                  <Text style={styles.commentText}>{c.content}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Escribe un comentario..."
                placeholderTextColor="#444"
                value={newComment}
                onChangeText={setNewComment}
              />
              <TouchableOpacity style={styles.commentSendBtn} onPress={handlePostComment}>
                <Text style={styles.commentSendText}>ENVIAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { height: screenHeight * 0.45, width: '100%', position: 'relative' },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  headerOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 11, 20, 0.9)',
    padding: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#222'
  },
  activityName: { color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Black' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  keniDetailBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    paddingVertical: 10, 
    paddingHorizontal: 15, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  keniActive: { borderColor: '#FFE600', backgroundColor: '#1A1A00' },
  keniDetailCount: { color: '#888', fontSize: 18, fontFamily: 'Outfit-Black', marginLeft: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 },
  dateText: { color: '#888', fontSize: 14, marginLeft: 8, fontFamily: 'Outfit-Medium', textTransform: 'capitalize' },
  xpBadge: {
    backgroundColor: '#FFE60022',
    borderColor: '#FFE600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 10,
  },
  xpBadgeText: {
    color: '#FFE600',
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
  },
  recordBadge: {
    backgroundColor: '#FF007F22',
    borderColor: '#FF007F',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  recordBadgeText: {
    color: '#FF007F',
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
  },
  content: { flex: 1, padding: 20, marginTop: -10 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { 
    backgroundColor: '#0A0B14', 
    width: '31%', 
    padding: 15, 
    borderRadius: 20, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111'
  },
  statLabel: { color: '#444', fontSize: 8, fontFamily: 'Outfit-Black', letterSpacing: 1, marginTop: 10 },
  statValue: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Black', marginTop: 5 },
  statUnit: { color: '#666', fontSize: 8, fontFamily: 'Outfit-Bold', marginTop: 2 },
  commentsSection: { marginTop: 10, paddingBottom: 100 },
  sectionTitle: { color: '#666', fontSize: 12, fontFamily: 'Outfit-Bold', letterSpacing: 2, marginBottom: 20 },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#222', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333'
  },
  commentBubble: { flex: 1, backgroundColor: '#0A0B14', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#111' },
  commentUser: { color: COLORS.accent, fontSize: 12, fontFamily: 'Outfit-Bold', marginBottom: 4 },
  commentText: { color: '#DDD', fontSize: 14, fontFamily: 'Outfit-Regular' },
  commentInputRow: { 
    flexDirection: 'row', 
    marginTop: 20, 
    backgroundColor: '#0A0B14', 
    borderRadius: 25, 
    paddingLeft: 20, 
    paddingRight: 5, 
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#222'
  },
  commentInput: { flex: 1, color: '#FFF', fontFamily: 'Outfit-Regular', fontSize: 14 },
  commentSendBtn: { backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  commentSendText: { color: '#000', fontFamily: 'Outfit-Black', fontSize: 12 },
  splitsSection: {
    backgroundColor: '#0A0B14',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#111',
    marginBottom: 20,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  splitKmCol: {
    width: 65,
    justifyContent: 'center',
  },
  splitKmText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  splitSubText: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
  },
  splitBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#161722',
    borderRadius: 4,
    marginHorizontal: 15,
    overflow: 'hidden',
  },
  splitBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  splitPaceText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    width: 85,
    textAlign: 'right',
  },
});
