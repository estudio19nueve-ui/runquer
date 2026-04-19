import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatService, ChatMessage } from '../api/chatService';
import { feedService, FeedEvent } from '../api/feedService';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { Send, MapPin, Globe, MessageSquare } from 'lucide-react-native';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'local' | 'global'>('local');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { currentLocation } = useLocationTracker();

  const fetchLocalMessages = async () => {
    if (!currentLocation) return;
    setLoading(true);
    try {
      const data = await chatService.getLocalMessages(
        currentLocation.coords.longitude,
        currentLocation.coords.latitude
      );
      setMessages(data);
    } catch (error) {
      console.error(error);
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
    if (activeTab === 'local') fetchLocalMessages();
    else fetchGlobalFeed();
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

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageBubble}>
      <Text style={styles.messageUser}>{item.username}</Text>
      <Text style={styles.messageContent}>{item.content}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const renderFeedItem = ({ item }: { item: FeedEvent }) => (
    <View style={styles.feedItem}>
      <View style={styles.feedBadge}>
        <Globe size={12} color="#FF0000" />
      </View>
      <View style={styles.feedContent}>
        <Text style={styles.feedText}>{item.content}</Text>
        <Text style={styles.feedTime}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

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
                <MapPin size={12} color="#FF0000" style={{ marginRight: 4 }} />
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
  messageUser: {
    color: '#FF0000',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    marginBottom: 4,
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
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  feedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#200',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  feedContent: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#111',
    paddingBottom: 15,
  },
  feedText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    lineHeight: 20,
  },
  feedTime: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
    marginTop: 5,
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
    backgroundColor: '#FF0000',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#444',
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'Outfit-Medium',
  }
});
