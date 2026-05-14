import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatService, ChatMessage } from '../api/chatService';
import { feedService, FeedEvent } from '../api/feedService';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { Zap, Globe, MessageSquare, Trash2, Send, MapPin } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { socialService } from '../api/socialService';

export default function ChatScreen({ route: navRoute }: any) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const initialTab = navRoute?.params?.initialTab || 'local';
  const [activeTab, setActiveTab] = useState<'local' | 'global'>(initialTab);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const { currentLocation } = useLocationTracker();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Efecto para cambiar de pestaña si cambian los parámetros de navegación
  useEffect(() => {
    if (navRoute?.params?.initialTab) {
      setActiveTab(navRoute.params.initialTab);
    }
    loadBlockedUsers();
  }, [navRoute?.params?.initialTab]);

  const loadBlockedUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    const blocked = await socialService.getBlockedUsers();
    setBlockedUserIds(blocked);
  };

  const fetchLocalMessages = async () => {
    if (!currentLocation) {
      console.log('Esperando ubicación para cargar mensajes locales...');
      return;
    }
    setLoading(true);
    try {
      const data = await chatService.getLocalMessages(
        currentLocation.coords.longitude,
        currentLocation.coords.latitude
      );
      setMessages(data);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudieron cargar los mensajes locales.");
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalFeed = async () => {
    setLoading(true);
    try {
      const data = await feedService.getGlobalFeed();
      setFeed(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null));
  }, []);

  useEffect(() => {
    if (activeTab === 'local') {
      fetchLocalMessages();
    } else {
      fetchGlobalFeed();
    }
  }, [currentLocation, activeTab]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentLocation || sending) return;

    setSending(true);
    try {
      await chatService.sendMessage(
        inputText.trim(),
        currentLocation.coords.longitude,
        currentLocation.coords.latitude
      );
      setInputText('');
      await fetchLocalMessages();
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleViewProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const handleViewActivity = async (runId: string) => {
    if (!runId) return;

    // Obtenemos los datos de la carrera para pasar el objeto completo
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (!error && data) {
        navigation.navigate('ActivityDetail', { activity: data });
      } else {
        Alert.alert("Aviso", "No se pudieron cargar los detalles de esta actividad.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      "Borrar Mensaje",
      "¿Quieres eliminar este mensaje definitivamente?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.deleteMessage(messageId);
              setMessages(prev => prev.filter(m => m.id !== messageId));
            } catch (e) {
              Alert.alert("Error", "No se pudo borrar el mensaje.");
            }
          }
        }
      ]
    );
  };


  const handleModeration = (userId: string, contentId: string, contentType: 'CHAT' | 'COMMENT' | 'ACTIVITY') => {
    Alert.alert(
      "Opciones de usuario",
      "¿Qué deseas hacer con este contenido?",
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
          text: "Reportar Contenido",
          onPress: () => {
            Alert.alert(
              "Reportar",
              "Selecciona el motivo del reporte",
              [
                { text: "Spam", onPress: () => sendReport(userId, contentId, contentType, "Spam") },
                { text: "Acoso", onPress: () => sendReport(userId, contentId, contentType, "Acoso") },
                { text: "Contenido Inapropiado", onPress: () => sendReport(userId, contentId, contentType, "Inapropiado") },
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
      Alert.alert("Gracias", "Hemos recibido tu reporte y lo revisaremos en breve.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.user_id === currentUserId;
    if (blockedUserIds.includes(item.user_id)) return null;

    return (
      <TouchableOpacity
        style={[styles.messageBubble, isMe && styles.messageBubbleMe]}
        onLongPress={() => !isMe && handleModeration(item.user_id, item.id, 'CHAT')}
        activeOpacity={0.7}
      >
        <View style={styles.messageHeader}>
          <TouchableOpacity onPress={() => handleViewProfile(item.user_id)}>
            <Text style={styles.messageUser}>{item.username}</Text>
          </TouchableOpacity>
          {isMe && (
            <TouchableOpacity onPress={() => handleDeleteMessage(item.id)}>
              <Trash2 size={14} color="#FF0055" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleKeni = async (runId: string) => {
    if (!runId) return;
    Vibration.vibrate(50);
    try {
      await socialService.giveKeni(runId);
      await fetchGlobalFeed();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", "No se pudo dar Keni. Asegúrate de haber ejecutado el SQL en Supabase para crear la tabla 'run_kenis'.");
    }
  };

  const renderFeedItem = ({ item }: { item: FeedEvent }) => {
    const username = item.profiles?.username || 'Atleta';
    if (blockedUserIds.includes(item.user_id)) return null;

    // Si es un resumen de actividad, renderizamos la tarjeta especial
    if (item.event_type === 'RUN_SUMMARY' && item.content.startsWith('SUMMARY|')) {
      const [_, area, distance, pace, runId] = item.content.split('|');
      const routePath = (item as any).runPath;

      return (
        <TouchableOpacity
          style={styles.activityCard}
          onPress={() => handleViewActivity(runId)}
          onLongPress={() => item.user_id !== currentUserId && handleModeration(item.user_id, item.id, 'ACTIVITY')}
          activeOpacity={0.8}
        >
          <View style={styles.activityCardHeader}>
            <TouchableOpacity onPress={() => handleViewProfile(item.user_id)} style={styles.feedUserRow}>
              <View style={styles.activityAvatarGlow}>
                <Zap size={14} color="#FF00FF" />
              </View>
              <Text style={styles.feedUsername}>{username}</Text>
            </TouchableOpacity>
            <Text style={styles.feedTimeSmall}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.activityMainRow}>
            <View style={styles.activityTextContent}>
              <Text style={styles.activityTitle}>¡Nueva Conquista!</Text>

              <View style={styles.activityStatsColumn}>
                <View style={styles.activityStatMini}>
                  <Text style={styles.activityStatLabel}>KMS</Text>
                  <Text style={styles.activityStatValue}>{parseFloat(distance).toFixed(2)}</Text>
                </View>
                <View style={styles.activityStatMini}>
                  <Text style={styles.activityStatLabel}>RITMO</Text>
                  <Text style={styles.activityStatValue}>{pace}</Text>
                </View>
                <View style={styles.activityStatMini}>
                  <Text style={styles.activityStatLabel}>ÁREA</Text>
                  <Text style={styles.activityStatValue}>{Math.round(parseFloat(area)).toLocaleString()} m²</Text>
                </View>
              </View>
            </View>

            {routePath && routePath.length > 1 && (
              <View style={styles.miniMapContainer}>
                <Mapbox.MapView
                  style={styles.miniMap}
                  styleURL={Mapbox.StyleURL.Dark}
                  logoEnabled={false}
                  attributionEnabled={false}
                  scaleBarEnabled={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Mapbox.Camera
                    bounds={{
                      ne: [
                        routePath.reduce((max: number, c: any) => Math.max(max, c[0]), routePath[0][0]),
                        routePath.reduce((max: number, c: any) => Math.max(max, c[1]), routePath[0][1])
                      ],
                      sw: [
                        routePath.reduce((min: number, c: any) => Math.min(min, c[0]), routePath[0][0]),
                        routePath.reduce((min: number, c: any) => Math.min(min, c[1]), routePath[0][1])
                      ],
                      paddingTop: 5, paddingRight: 5, paddingBottom: 5, paddingLeft: 5
                    }}
                    animationDuration={0}
                  />
                  <Mapbox.ShapeSource id={`source-${item.id}`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routePath } }}>
                    <Mapbox.LineLayer
                      id={`layer-${item.id}`}
                      style={{ lineColor: '#00F3FF', lineWidth: 3, lineCap: 'round' }}
                    />
                  </Mapbox.ShapeSource>
                </Mapbox.MapView>
              </View>
            )}
          </View>

          <View style={styles.activityFooter}>
            <TouchableOpacity
              style={styles.keniButton}
              onPress={() => handleKeni(runId)}
            >
              <Zap size={16} color="#FFE600" />
              <Text style={styles.keniText}>DAR KENI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.commentInfo} onPress={() => handleViewActivity(runId)}>
              <MessageSquare size={14} color="#666" />
              <Text style={styles.commentInfoText}>Comentar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityGlowBar} />
        </TouchableOpacity>
      );
    }

    // Comportamiento por defecto para otros mensajes del feed
    const displayContent = item.content.startsWith(username)
      ? item.content.substring(username.length).trim()
      : item.content;

    return (
      <TouchableOpacity
        style={styles.feedCard}
        onLongPress={() => item.user_id !== currentUserId && handleModeration(item.user_id, item.id, 'ACTIVITY')}
        activeOpacity={0.8}
      >
        <View style={styles.feedCardTop}>
          <TouchableOpacity onPress={() => handleViewProfile(item.user_id)} style={styles.feedUserRow}>
            <View style={styles.feedAvatarGlow}>
              <Globe size={12} color="#00F3FF" />
            </View>
            <Text style={styles.feedUsername}>{username}</Text>
          </TouchableOpacity>
          <Text style={styles.feedTimeSmall}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.feedMainText}>{displayContent}</Text>
        <View style={styles.feedAccentLine} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>COMUNIDAD</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'local' && styles.tabActive]}
            onPress={() => setActiveTab('local')}
          >
            <MessageSquare size={16} color={activeTab === 'local' ? '#FFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'local' && styles.tabTextActive]}>CHAT LOCAL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'global' && styles.tabActive]}
            onPress={() => setActiveTab('global')}
          >
            <Globe size={16} color={activeTab === 'global' ? '#FFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>GLOBAL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'local' ? (
        <>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.locationInfo}>
                <MapPin size={12} color="#00F3FF" style={{ marginRight: 4 }} />
                <Text style={styles.locationText}>Mensajes en un radio de 5km</Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay mensajes en esta zona.</Text>
            }
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
            <View style={styles.inputArea}>
              <TextInput
                style={styles.input}
                placeholder="Escribe en la zona..."
                placeholderTextColor="#666"
                value={inputText}
                onChangeText={setInputText}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
                {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={20} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      ) : (
        <FlatList
          data={feed}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchGlobalFeed}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Buscando actividad en el mundo...</Text>
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
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#111',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 15,
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    marginLeft: 8,
  },
  tabTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  messageBubble: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  messageBubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#001A1F',
    borderColor: '#00F3FF',
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageUser: {
    color: '#00F3FF',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
  },
  messageContent: {
    color: '#DDD',
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
  },
  messageTime: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
    marginTop: 6,
    textAlign: 'right',
  },
  feedCard: {
    backgroundColor: '#0A0B14',
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1A1B24',
    shadowColor: '#00F3FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  feedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedAvatarGlow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 243, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 243, 255, 0.3)',
  },
  feedUsername: {
    color: '#00F3FF',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    textShadowColor: 'rgba(0, 243, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  feedTimeSmall: {
    color: '#444',
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
  },
  feedMainText: {
    color: '#EEE',
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    lineHeight: 20,
  },
  feedAccentLine: {
    height: 2,
    width: 30,
    backgroundColor: '#00F3FF',
    marginTop: 12,
    borderRadius: 1,
    opacity: 0.5,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 20,
    paddingHorizontal: 15,
    color: '#FFF',
    fontFamily: 'Outfit-Regular',
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: '#00F3FF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#444',
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'Outfit-Medium',
  },
  activityCard: {
    backgroundColor: '#0A0B14',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  activityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityAvatarGlow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  activityTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-Black',
    marginBottom: 10,
  },
  activityMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTextContent: {
    flex: 1,
    marginRight: 15,
  },
  activityStatsColumn: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1A1B24',
  },
  activityStatMini: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityStatLabel: {
    color: '#666',
    fontSize: 8,
    fontFamily: 'Outfit-Bold',
  },
  activityStatValue: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Outfit-Black',
    marginLeft: 8,
  },
  miniMapContainer: {
    width: 100,
    height: 100,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  miniMap: {
    flex: 1,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1B24',
  },
  keniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  keniText: {
    color: '#FFE600',
    fontSize: 10,
    fontFamily: 'Outfit-Black',
    marginLeft: 6,
  },
  commentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInfoText: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    marginLeft: 6,
  },
  activityGlowBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00F3FF',
    shadowColor: '#00F3FF',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  feedCard: {
    backgroundColor: '#0A0B14',
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#111'
  },
  feedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  feedUserRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  feedAvatarGlow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 243, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 243, 255, 0.3)'
  },
  feedUsername: {
    color: '#00F3FF',
    fontSize: 14,
    fontFamily: 'Outfit-Bold'
  },
  feedTimeSmall: {
    color: '#444',
    fontSize: 10,
    fontFamily: 'Outfit-Regular'
  },
  feedMainText: {
    color: '#DDD',
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    lineHeight: 20
  },
  feedAccentLine: {
    height: 1,
    backgroundColor: '#111',
    marginTop: 15
  }
});
