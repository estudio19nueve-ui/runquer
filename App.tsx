import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';

import { supabase } from './src/lib/supabase';
import MapScreen from './src/screens/MapScreen';
import AuthScreen from './src/screens/AuthScreen';
import RankingScreen from './src/screens/RankingScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import ActivitiesHistoryScreen from './src/screens/ActivitiesHistoryScreen';

import { Map as MapIcon, Trophy, MessageSquare, User } from 'lucide-react-native';
import { 
  useFonts, 
  Outfit_400Regular, 
  Outfit_500Medium, 
  Outfit_600SemiBold, 
  Outfit_700Bold, 
  Outfit_900Black 
} from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';

// Configuración global de Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MapMain" component={MapScreen} />
      <Stack.Screen 
        name="Summary" 
        component={SummaryScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="ActivitiesHistory" component={ActivitiesHistoryScreen} />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#111',
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 12,
        },
        tabBarActiveTintColor: '#00F3FF',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Outfit-Bold',
        }
      }}
    >
      <Tab.Screen 
        name="Mapa" 
        component={MapStack} 
        options={{
          tabBarIcon: ({ color, size }) => <MapIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Ranking" 
        component={RankingScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileStack} 
        options={{
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  
  const [fontsLoaded] = useFonts({
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-Black': Outfit_900Black,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FF0000" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {session && session.user ? (
          <TabNavigator />
        ) : (
          <AuthScreen />
        )}
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
