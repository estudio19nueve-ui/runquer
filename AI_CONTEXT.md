# Contexto de Antigravity - Proyecto Runquer

**Fecha de último guardado:** 7 de Junio de 2026
**Objetivo de este archivo:** Proveer el contexto inmediato a una nueva sesión de Antigravity en otro ordenador para continuar el trabajo exactamente donde se dejó.

## Estado actual del Proyecto
El proyecto está en medio de varias actualizaciones importantes relacionadas con:
- Configuración y depuración de la conexión con el iPhone 16 Pro y firma local en Xcode con cuenta gratuita (`nimemires@hotmail.com`).
- Corrección de la base de datos (trigger y políticas RLS) para permitir el borrado profundo de actividades sin fallos por CHECK constraints.
- Estabilización del mapa y territorios (`MapScreen.tsx`, `territoryService.ts`, `h3_migration.sql`).
- Implementación de nuevas lógicas de servicios y gamificación (`gamificationService.ts`, `chatService.ts`, `socialService.ts`).
- Correcciones de Base de Datos y RLS (Row Level Security) en Supabase: Se han creado scripts nuevos que están pendientes de ejecución o revisión (`RLS_Final_Fixes.sql`, `runs_update_fix.sql`, `social_migration.sql`).
- Rastreo en segundo plano y geometría (`useLocationTracker.ts`, `backgroundTracker.ts`, `geometryService.ts`).
- Preparación para la Build de producción (`app.json`, `eas.json`, `package.json`, iconos nuevos).

## Archivos clave modificados/creados recientemente:
- **Base de datos / SQL:** `src/api/RLS_Final_Fixes.sql`, `src/api/runs_update_fix.sql`, `src/api/social_migration.sql`
- **Servicios nuevos/modificados:** `src/api/socialService.ts` (nuevo), `src/api/gamificationService.ts`, `src/api/territoryService.ts`
- **Pantallas:** `MapScreen.tsx`, `ProfileScreen.tsx`, `AchievementsScreen.tsx`

## Instrucciones para Antigravity (Nueva Sesión)
1. Revisa este documento para entender en qué punto estamos.
2. Pregunta al usuario (Keno) cuál de las tareas anteriores (arreglos SQL, builds de EAS, o testeo de mapa) quiere priorizar en esta sesión.
3. Continúa ayudando con la estabilización de Runquer V2.
