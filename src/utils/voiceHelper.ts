import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFERRED_VOICE_KEY = 'runquer_preferred_voice_id';
const AUDIO_CUES_ENABLED_KEY = 'runquer_audio_cues_enabled';

/**
 * Obtiene todas las voces en español disponibles en el dispositivo.
 */
export async function getSpanishVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getVoicesAsync();
    return voices.filter(v => v.language.toLowerCase().startsWith('es'));
  } catch (e) {
    console.error("[VoiceHelper] Error al obtener voces:", e);
    return [];
  }
}

/**
 * Busca y retorna el ID de la mejor voz masculina en español de España (es-ES),
 * o cualquier español si no está disponible.
 */
export async function getBestSpanishMaleVoice(): Promise<string | undefined> {
  try {
    const voices = await getSpanishVoices();
    if (voices.length === 0) return undefined;

    // 1. Filtrar voces de España (es-ES o es_ES)
    const esESVoices = voices.filter(v => 
      v.language.toLowerCase().replace('_', '-').startsWith('es-es')
    );

    // Palabras clave comunes para voces masculinas (Google TTS en Android y Apple TTS en iOS)
    const maleKeywords = ['jorge', 'sfs', 'esc', 'dcc', 'male', 'varón', 'varon'];

    // 2. Buscar voz masculina de España
    if (esESVoices.length > 0) {
      const maleES = esESVoices.find(v => 
        maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
      if (maleES) return maleES.identifier;
      return esESVoices[0].identifier; // Si no hay varón detectado, primera voz de España
    }

    // 3. Fallback: Buscar cualquier voz masculina en español (ej. México, EE.UU.)
    const maleAny = voices.find(v => 
      maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
    );
    if (maleAny) return maleAny.identifier;

    // 4. Último recurso: primera voz en español que encontremos
    return voices[0].identifier;
  } catch (e) {
    console.warn("[VoiceHelper] Error buscando mejor voz masculina:", e);
    return undefined;
  }
}

/**
 * Obtiene la configuración de voz preferida guardada.
 */
export async function getPreferredVoice(): Promise<string | undefined> {
  try {
    const saved = await AsyncStorage.getItem(PREFERRED_VOICE_KEY);
    const voices = await getSpanishVoices();

    const hasEsES = voices.some(v => v.language.toLowerCase().replace('_', '-').startsWith('es-es'));
    if (saved) {
      const savedVoice = voices.find(v => v.identifier === saved);
      if (savedVoice) {
        const savedIsEsES = savedVoice.language.toLowerCase().replace('_', '-').startsWith('es-es');
        // Si hay una voz de España disponible en el dispositivo, pero la guardada es de otra región (latina), actualizamos
        if (!savedIsEsES && hasEsES) {
          console.log("[VoiceHelper] Auto-actualizando voz guardada a español de España");
          const bestDefault = await getBestSpanishMaleVoice();
          if (bestDefault) {
            await setPreferredVoice(bestDefault);
            return bestDefault;
          }
        }
      }
      return saved;
    }

    // Si no hay voz configurada, buscar el mejor varón español
    const bestDefault = await getBestSpanishMaleVoice();
    if (bestDefault) {
      await setPreferredVoice(bestDefault);
      return bestDefault;
    }
  } catch (e) {
    console.error("[VoiceHelper] Error cargando voz preferida:", e);
  }
  return undefined;
}


/**
 * Guarda la voz preferida.
 */
export async function setPreferredVoice(voiceId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERRED_VOICE_KEY, voiceId);
  } catch (e) {
    console.error("[VoiceHelper] Error guardando voz preferida:", e);
  }
}

/**
 * Comprueba si las alertas de voz están activadas.
 */
export async function isAudioCuesEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUDIO_CUES_ENABLED_KEY);
    return val === null ? true : val === 'true'; // Activas por defecto
  } catch (e) {
    return true;
  }
}

/**
 * Activa o desactiva las alertas de voz.
 */
export async function setAudioCuesEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUDIO_CUES_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error("[VoiceHelper] Error guardando estado de audioguía:", e);
  }
}
