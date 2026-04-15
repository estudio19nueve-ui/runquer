import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Check, Zap, Target, Ruler, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

/**
 * Pantalla de resumen post-conquista.
 */
export default function SummaryScreen({ route, navigation }: any) {
  const { area, distance, polygon } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.successIcon}>
          <Check size={40} color="#0F0" />
        </View>
        <Text style={styles.title}>¡REGIÓN CONQUISTADA!</Text>
        <Text style={styles.subtitle}>Has extendido las fronteras de tu imperio.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.mapContainer}>
          <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark} logoEnabled={false} scrollEnabled={false} zoomEnabled={false}>
            <Mapbox.Camera
              centerCoordinate={polygon.geometry.coordinates[0][0]}
              zoomLevel={14}
            />
            <Mapbox.ShapeSource id="summarySource" shape={polygon}>
              <Mapbox.FillLayer id="summaryFill" style={{ fillColor: '#FF0000', fillOpacity: 0.6 }} />
            </Mapbox.ShapeSource>
          </Mapbox.MapView>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Target size={20} color="#FF0000" />
            <Text style={styles.statLabel}>ÁREA</Text>
            <Text style={styles.statValue}>{Math.round(area).toLocaleString()} m²</Text>
          </View>
          <View style={styles.statItem}>
            <Ruler size={20} color="#FF0000" />
            <Text style={styles.statLabel}>DISTANCIA</Text>
            <Text style={styles.statValue}>{(distance / 1000).toFixed(2)} km</Text>
          </View>
          <View style={styles.statItem}>
            <Zap size={20} color="#FFD700" />
            <Text style={styles.statLabel}>EXP GANADA</Text>
            <Text style={styles.statValue}>+250 XP</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.continueButton}
        onPress={() => navigation.navigate('Mapa')}
      >
        <Text style={styles.continueText}>VOLVER AL MAPA</Text>
        <ArrowRight size={20} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#0F0',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  mapContainer: {
    height: 200,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 24,
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#FF0000',
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  continueText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 10,
    letterSpacing: 1,
  }
});
