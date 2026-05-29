import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform, AppState } from 'react-native';
import { supabase } from '../lib/supabase';

// Indica a WebBrowser que termine la sesión una vez completada la redirección
WebBrowser.maybeCompleteAuthSession();

// Configuración de la API de Strava (Reemplazar con tus credenciales en el .env)
const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || 'TU_STRAVA_CLIENT_ID';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || 'TU_STRAVA_CLIENT_SECRET';

export const stravaAuthService = {
  /**
   * Verifica si el usuario actual ya está vinculado con Strava.
   */
  async isLinked(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  /**
   * Inicia el flujo de autenticación OAuth de Strava en la app móvil.
   */
  async linkStrava(userId: string): Promise<boolean> {
    if (STRAVA_CLIENT_ID === 'TU_STRAVA_CLIENT_ID' || STRAVA_CLIENT_SECRET === 'TU_STRAVA_CLIENT_SECRET') {
      throw new Error("Credenciales de Strava no configuradas en las variables de entorno (.env)");
    }

    // Generar la URL de redirección nativa de la app con localhost
    const redirectUrl = 'runquer://localhost/strava-callback';
    
    // En Android, usamos el endpoint estándar de web para evitar el error "Error en la solicitud" 
    // causado por restricciones de validación del paquete de la aplicación móvil en Strava
    const authorizeEndpoint = Platform.OS === 'ios'
      ? 'https://www.strava.com/oauth/mobile/authorize'
      : 'https://www.strava.com/oauth/authorize';

    // URL de autorización de Strava para leer actividades completas. Usamos approval_prompt=force para forzar la pantalla de permisos.
    const authUrl = `${authorizeEndpoint}?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUrl
    )}&response_type=code&approval_prompt=force&scope=activity:read_all`;

    console.log(`[Strava OAuth] Abriendo navegador vía Linking. Redirección esperada: ${redirectUrl}`);

    let completed = false;

    return new Promise<boolean>(async (resolve, reject) => {
      // Registrar el listener de deep linking para capturar la redirección en Android/iOS de forma robusta
      const subscription = Linking.addEventListener('url', async (event) => {
        console.log("[Strava OAuth] Deep link recibido en listener:", event.url);
        if (event.url && event.url.includes('strava-callback')) {
          const parsed = Linking.parse(event.url);
          const rawCode = parsed.queryParams?.code;
          const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
          
          if (code && !completed) {
            completed = true;
            subscription.remove();
            appStateSubscription.remove();
            try {
              console.log("[Strava OAuth] Código obtenido vía deep link. Intercambiando...");
              const success = await this.exchangeCodeForTokens(userId, code);
              resolve(success);
            } catch (err) {
              reject(err);
            }
          }
        }
      });

      // Listener de estado de la aplicación para detectar si el usuario regresa sin completar la vinculación
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          // Si el usuario regresa a la app, damos 2.5 segundos por si el deep link está procesándose.
          // De lo contrario, consideramos el flujo cerrado para no bloquear la UI.
          setTimeout(() => {
            if (!completed) {
              completed = true;
              subscription.remove();
              appStateSubscription.remove();
              console.log("[Strava OAuth] El usuario volvió a la app sin completar la vinculación.");
              resolve(false);
            }
          }, 2500);
        }
      });

      try {
        // Abrir el navegador del sistema completo. Así las pestañas de inicio de sesión y verificación de
        // identidad de 2FA por correo no cierran ni destruyen la ventana/flujo en segundo plano.
        await Linking.openURL(authUrl);
      } catch (e) {
        if (!completed) {
          completed = true;
          subscription.remove();
          appStateSubscription.remove();
          reject(e);
        }
      }
    });
  },

  /**
   * Intercambia el código de autorización temporal por tokens de acceso/refresco y los guarda en Supabase.
   */
  async exchangeCodeForTokens(userId: string, code: string): Promise<boolean> {
    const tokenUrl = 'https://www.strava.com/oauth/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Error en el intercambio de tokens de Strava: ${errBody}`);
    }

    const tokenData = await response.json();
    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    // Calcular la fecha de expiración en formato ISO UTC para la base de datos
    const expiresAtDate = new Date(expires_at * 1000).toISOString();

    // Guardar o actualizar en la tabla user_integrations de Supabase
    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'strava',
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expiresAtDate,
        provider_user_id: athlete?.id?.toString() || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (error) {
      throw error;
    }

    console.log("[Strava OAuth] Vinculación completada con éxito.");
    return true;
  },

  /**
   * Desvincula y elimina la integración de Strava de la base de datos.
   */
  async unlinkStrava(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'strava');

    if (error) throw error;
    console.log("[Strava OAuth] Integración de Strava eliminada.");
  }
};
