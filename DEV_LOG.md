# Runquer - Registro de Desarrollo (DEV_LOG)

Este archivo sirve como diario de desarrollo y memoria compartida. Aquí anotaremos los hitos, decisiones técnicas y pasos pendientes para que nunca se pierda el progreso, incluso entre sesiones.

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

---

*Creado por Antigravity a petición del usuario para mantener la persistencia del proyecto.*
