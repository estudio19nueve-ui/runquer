import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Crypto from 'expo-crypto';
import Svg, { Path } from 'react-native-svg';

// Logo de Google SVG para un acabado profesional
const GoogleLogo = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </Svg>
);

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      webClientId: '796377992566-ddemv7cgtakk0s9020b3pcnkup0rlvgq.apps.googleusercontent.com', 
      iosClientId: '796377992566-gp8idrf367j30ajnj8vp6nf46nnl1kto.apps.googleusercontent.com',
    });
  }, []);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { 
      data: { session },
      error 
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    else if (!session) Alert.alert('¡Casi listo!', 'Por favor, revisa tu correo para confirmar la cuenta.');
    setLoading(false);
  }

  async function signInWithGoogle() {
    try {
      setLoading(true);
      
      // 1. Generar un nonce aleatorio "en crudo" (Raw)
      const rawNonce = Crypto.randomUUID();

      // 2. Generar el hash SHA-256 del nonce para enviárselo a Google
      // IMPORTANTE: iOS requiere que Google reciba el HASH, pero Supabase reciba el RAW.
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // 3. Iniciar sesión en Google pasando el nonce HASHEADO
      const response = await GoogleSignin.signIn({
        nonce: hashedNonce,
      });

      if (response.type === 'cancelled') {
        return;
      }

      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('No se recibió el ID Token de Google');
      }

      // 4. Enviar el token a Supabase pasando el nonce EN CRUDO (Raw)
      // Supabase se encargará de hashearlo internamente y compararlo con el del ID Token.
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce: rawNonce,
      });

      if (error) throw error;

    } catch (error: any) {
      if (error.code === 'DEVELOPER_ERROR') {
        Alert.alert('Error de Configuración', 'Revisa que los Client IDs sean correctos en el Dashboard de Google.');
      } else if (error.code === statusCodes?.SIGN_IN_CANCELLED) {
        // Usuario canceló el proceso
      } else {
        console.error('Detalle del error Google:', error);
        Alert.alert('Error de Google', error.message || 'Error desconocido');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RUNQUER</Text>
      <Text style={styles.subtitle}>Conquista tu ciudad</Text>

      <View style={styles.inputContainer}>
        <TextInput
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          placeholderTextColor="#888"
          autoCapitalize={'none'}
          style={styles.input}
        />
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          placeholderTextColor="#888"
          autoCapitalize={'none'}
          style={styles.input}
        />
      </View>

      <View style={[styles.verticallyCentered, { marginTop: 20 }]}>
        <TouchableOpacity 
          style={styles.buttonMain} 
          disabled={loading} 
          onPress={() => signInWithEmail()}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>INICIAR SESIÓN</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.verticallyCentered}>
        <TouchableOpacity 
          style={styles.buttonSecondary} 
          disabled={loading} 
          onPress={() => signUpWithEmail()}
        >
          <Text style={styles.buttonSecondaryText}>CREAR CUENTA</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.separatorContainer}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>O</Text>
        <View style={styles.separatorLine} />
      </View>

      <TouchableOpacity 
        style={styles.buttonGoogle} 
        disabled={loading} 
        onPress={() => signInWithGoogle()}
      >
        <GoogleLogo />
        <Text style={styles.buttonGoogleText}>Continuar con Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontFamily: 'Outfit-Black',
    color: '#FF0000',
    textAlign: 'center',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 2,
  },
  inputContainer: {
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  input: {
    height: 50,
    color: '#FFF',
    fontFamily: 'Outfit-Regular',
  },
  verticallyCentered: {
    alignSelf: 'stretch',
    marginVertical: 5,
  },
  buttonMain: {
    backgroundColor: '#FF0000',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSecondary: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
  },
  buttonSecondaryText: {
    color: '#888',
    fontFamily: 'Outfit-Medium',
    fontSize: 14,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#222',
  },
  separatorText: {
    color: '#444',
    marginHorizontal: 10,
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
  },
  buttonGoogle: {
    backgroundColor: '#FFF',
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonGoogleText: {
    color: '#000',
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
  },
});
