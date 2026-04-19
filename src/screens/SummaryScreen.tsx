import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Check, Zap, Target, Ruler, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

/**
 * Pantalla de resumen post-conquista.
 */
export default function SummaryScreen({ route, navigation }: any) {
  const { area, distance, polygon, routePath } = route.params;

  // Colores del tema Neon unificados
  const theme = {
    background: '#000000',
    card: '#0A0B14',
    text: '#FFFFFF',
    accent: '#00F3FF',
    roadPrimary: '#FF007F',
    roadSecondary: '#7B2FF7',
    territoryMe: '#0044FF'
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={[styles.successIcon, { borderColor: theme.accent, backgroundColor: theme.accent + '11' }]}>
          <Check size={40} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>¡REGIÓN CONQUISTADA!</Text>
        <Text style={styles.subtitle}>Has extendido las fronteras de tu imperio.</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: '#222' }]}>
        <View style={styles.mapContainer}>
          <Mapbox.MapView 
            style={styles.map} 
            styleURL={Mapbox.StyleURL.Dark} 
            logoEnabled={false} 
            scrollEnabled={false} 
            zoomEnabled={false}
            scaleBarEnabled={false}
            attributionEnabled={false}
          >
            <Mapbox.Camera
              centerCoordinate={routePath && routePath.length > 1 ? routePath[Math.floor(routePath.length / 2)] : [0, 0]}
              zoomLevel={15.5}
              animationDuration={0}
            />

            <Mapbox.VectorSource id="neonSummarySource" url="mapbox://mapbox.mapbox-streets-v8">
              <Mapbox.LineLayer
                id="roadsThemeSummary"
                sourceLayerID="road"
                filter={['match', ['get', 'class'], ['motorway', 'primary', 'trunk', 'street', 'secondary', 'tertiary'], true, false]}
                style={{
                  lineColor: ['match', ['get', 'class'], ['motorway', 'primary', 'trunk'], theme.roadPrimary, theme.roadSecondary],
                  lineWidth: 1.5,
                  lineOpacity: 0.4,
                }}
              />
            </Mapbox.VectorSource>

            {routePath && routePath.length > 1 && (
              <Mapbox.ShapeSource id="routeSourceSummary" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routePath } }}>
                <Mapbox.LineLayer 
                  id="routeLayerSummary" 
                  style={{ 
                    lineColor: theme.accent, 
                    lineWidth: 6, 
                    lineOpacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }} 
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Target size={20} color={theme.accent} />
            <Text style={styles.statLabel}>ÁREA</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{Math.round(area).toLocaleString()} m²</Text>
          </View>
          <View style={styles.statItem}>
            <Ruler size={20} color={theme.accent} />
            <Text style={styles.statLabel}>DISTANCIA</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{(distance / 1000).toFixed(2)} km</Text>
          </View>
          <View style={styles.statItem}>
            <Zap size={20} color="#FFD700" />
            <Text style={styles.statLabel}>EXP GANADA</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>+250 XP</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.continueButton, { borderColor: theme.accent, backgroundColor: '#111' }]}
        onPress={() => navigation.navigate('MapMain')}
      >
        <Text style={[styles.continueText, { color: '#FFF' }]}>VOLVER AL MAPA</Text>
        <ArrowRight size={20} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: 'Outfit-Black',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'Outfit-Medium',
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 10,
  },
  mapContainer: {
    height: 200,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
    fontFamily: 'Outfit-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Outfit-Black',
  },
  continueButton: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    borderWidth: 1,
  },
  continueText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 18,
    marginRight: 10,
    letterSpacing: 1,
  }
});
