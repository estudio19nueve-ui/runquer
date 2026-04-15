import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RUNQUER</Text>
      <Text style={styles.subtitle}>Conquista tu ciudad</Text>

      <View style={styles.inputContainer}>
        <TextInput
          label="Email"
          leftIcon={{ type: 'font-awesome', name: 'envelope' }}
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
          label="Password"
          leftIcon={{ type: 'font-awesome', name: 'lock' }}
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
    fontWeight: 'bold',
    color: '#FF0000',
    textAlign: 'center',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 40,
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
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonSecondaryText: {
    color: '#888',
    fontSize: 14,
  },
});
