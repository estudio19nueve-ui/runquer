# Runquer - Registro de Desarrollo (DEV_LOG)

Este archivo sirve como diario de desarrollo y memoria compartida. Aquí anotaremos los hitos, decisiones técnicas y pasos pendientes para que nunca se pierda el progreso, incluso entre sesiones.

---

## 📅 Estado Actual - 7 de Junio, 2026 (Sesión de Conectividad iOS)

### 🚀 Hitos Alcanzados (Sesión Actual)
- **Corrección de Ruta de Xcode**: Se detectó que Xcode estaba en la carpeta `Downloads`, lo que causaba "App Translocation" por seguridad de macOS e impedía que Xcode viera los dispositivos USB. Se movió a `/Applications/Xcode.app` y se configuró como activo con `xcode-select`.
- **Diagnóstico de Cuenta de Apple**: Confirmamos que la cuenta de Apple `nimemires@hotmail.com` es gratuita (no de pago de $99/año). Por este motivo, el comando de `eas build` para iOS no puede completarse (requiere perfil de aprovisionamiento de pago).
- **Plan de Pruebas en Local**: Se resolvió que la mejor alternativa es compilar y probar la aplicación localmente en el iPhone usando Xcode con firma de cuenta personal (gratuita).
- **Corrección de Borrado Profundo (Android/iOS)**: Identificamos que el error *"No se pudo completar el borrado profundo"* al eliminar actividades cortas de prueba se debía a:
  1. La función de base de datos `handle_run_delete` decrementaba `layers` a `0`, lo que violaba la restricción `CHECK (layers >= 1)` antes de borrarlas, provocando que PostgreSQL abortara la transacción.
  2. Las rutas con menos de 2 puntos (pruebas) hacían fallar funciones espaciales de PostGIS como `ST_Buffer`.
  3. Faltaba la política RLS explícita de `DELETE` para los usuarios en la tabla `runs`.
  Creamos el script de solución [delete_run_trigger_fix.sql](file:///Users/keno/Documents/runquer/src/api/delete_run_trigger_fix.sql) para ser ejecutado en el SQL Editor de Supabase.
- **Mejora del Selector de Voces en Perfil**: Se rediseñó el selector de voces en español en [ProfileScreen.tsx](file:///Users/keno/Documents/runquer/src/screens/ProfileScreen.tsx). Se reemplazó la lista estática por un menú desplegable (Dropdown) colapsable y estilizado de acuerdo con la interfaz del juego, el cual muestra la voz activa y se expande para seleccionar entre las demás voces.

### 📋 Próximos Pasos (Pendientes)
1. **Aplicar Fix de Borrado**: El usuario debe ejecutar el script `delete_run_trigger_fix.sql` en el SQL Editor de Supabase.
2. **Detección del iPhone en Xcode**: El usuario debe revisar la ventana **Window > Devices and Simulators** de Xcode para ver el estado de depuración del iPhone 16 Pro y resolver el mensaje de bloqueo que muestra Xcode.
3. **Compilación Local**: Lanzar la compilación local con `npx expo run:ios` e instalarla en el iPhone 16 Pro.

---

## 📅 Estado Actual - 16 de Abril, 2026 (Sesión II)

### 🚀 Hitos Alcanzados (Sesión Actual)
- **Estadísticas en Tiempo Real**: Implementación de distancia, duración, ritmo actual y medio en `MapScreen`.
- **Experiencia de Usuario en Mapa**: Cámara optimizada con zoom (18.5), inclinación (80°) y animación `flyTo`.
- **Interfaz Adaptativa (Pixel 9 Pro)**: Ajuste de Safe Areas (superior e inferior) para evitar solapamientos con el sistema.
- **Persistencia de Sesión**: Instalación de `AsyncStorage` y configuración de Supabase para recordar el login.
- **Personalización de Perfil**: Opción de cambiar el nombre de usuario y selección de colores del imperio funcional.

### 📋 Próximos Pasos (Pendientes)
1. **Historial de Conquistas**: Crear una vista de resumen post-carrera más detallada.
2. **Sistema de Combate**: Probar en "entorno real" el robo de territorios con PostGIS.
3. **Setup de iOS**: Configurar permisos de localización para iPhone.

---

## 💡 Notas Técnicas Importantes
- **Mapbox Android**: El SDK de Mapbox en Android requiere un token con `DOWNLOADS:READ`.
- **PostGIS**: La lógica de conquista se basa en `ST_Difference` y `ST_Union` para manejar los solapamientos entre jugadores.
- **Supabase (Mayo 2026)**: Por la actualización de seguridad de Supabase, cualquier tabla nueva en el esquema `public` requiere un `GRANT` explícito (ej. `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nombre_tabla TO anon, authenticated, service_role;`) para ser visible por la API/`supabase-js`.

---

*Creado por Antigravity a petición del usuario para mantener la persistencia del proyecto.*
