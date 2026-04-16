import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import MapScreen from './src/screens/MapScreen';
import AuthScreen from './src/screens/AuthScreen';
import RankingScreen from './src/screens/RankingScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import { Map as MapIcon, Trophy, MessageSquare, User } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * Stack para la pestaña de Mapa (Permite navegar al Resumen)
 */
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

/**
 * Navegador de pestañas principal.
 */
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
        tabBarActiveTintColor: '#FF0000',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
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
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
