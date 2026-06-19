import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Text } from 'react-native-svg';

interface MedalIconProps {
  medalType: 'gold' | 'silver' | 'bronze';
  periodType: 'weekly' | 'monthly' | 'yearly';
  size?: number;
}

export const MedalIcon: React.FC<MedalIconProps> = ({
  medalType,
  periodType,
  size = 80
}) => {
  // Configuración de Colores y Gradiantes
  const gradients = {
    gold: {
      start: '#FFE259',
      end: '#FFA751',
      neon: '#FFD700',
      neonAlt: '#FFA500',
      text: 'Oro'
    },
    silver: {
      start: '#F1F2F6',
      end: '#A4B0BE',
      neon: '#00F3FF', // Cyan / Azul eléctrico igual al acento de la app
      neonAlt: '#00A8FF',
      text: 'Plata'
    },
    bronze: {
      start: '#E07A5F',
      end: '#8B4513',
      neon: '#FF007F', // Rosa / Neón caliente igual a récords
      neonAlt: '#D2691E',
      text: 'Bronce'
    }
  };

  const current = gradients[medalType] || gradients.gold;

  // Curvas de nivel topográficas (líneas decorativas estilo mapa de fondo)
  const renderTopoMapLines = () => (
    <G opacity="0.15">
      {/* Curva 1 */}
      <Path
        d="M25 35 C35 30, 45 42, 55 35 C65 28, 70 45, 80 40"
        fill="none"
        stroke={current.neon}
        strokeWidth="1"
      />
      {/* Curva 2 */}
      <Path
        d="M15 50 C30 45, 40 60, 60 55 C70 50, 75 68, 90 60"
        fill="none"
        stroke={current.neon}
        strokeWidth="1.2"
      />
      {/* Curva 3 */}
      <Path
        d="M20 70 C35 65, 45 80, 55 75 C65 70, 75 85, 85 80"
        fill="none"
        stroke={current.neon}
        strokeWidth="1"
      />
      {/* Curva concéntrica pequeña */}
      <Path
        d="M 40 50 A 10 10 0 1 0 60 50 A 10 10 0 1 0 40 50 Z"
        fill="none"
        stroke={current.neon}
        strokeWidth="0.8"
      />
    </G>
  );

  // Número de clasificación (1, 2, 3) con efecto de neón
  const renderRankNumber = () => {
    const num = medalType === 'gold' ? '1' : medalType === 'silver' ? '2' : '3';
    
    // Ajustar posición vertical dependiendo del tipo de escudo
    const yPos = periodType === 'yearly' ? 68 : periodType === 'monthly' ? 58 : 60;
    
    return (
      <G>
        {/* Glow trasero (difuminado simulado duplicando texto grueso con opacidad) */}
        <Text
          x="50"
          y={yPos}
          fontSize="30"
          fontWeight="bold"
          fontFamily="Outfit-Black"
          fill="none"
          stroke={current.neon}
          strokeWidth="6"
          opacity="0.4"
          textAnchor="middle"
        >
          {num}
        </Text>
        {/* Texto principal brillante */}
        <Text
          x="50"
          y={yPos}
          fontSize="30"
          fontWeight="bold"
          fontFamily="Outfit-Black"
          fill="#FFF"
          stroke={current.neonAlt}
          strokeWidth="1.5"
          textAnchor="middle"
        >
          {num}
        </Text>
      </G>
    );
  };

  // Etiqueta del periodo (SEM, MES, AÑO)
  const renderPeriodLabel = () => {
    const label = periodType === 'weekly' ? 'SEM' : periodType === 'monthly' ? 'MES' : 'AÑO';
    const yPos = periodType === 'yearly' ? 84 : periodType === 'monthly' ? 78 : 80;
    
    return (
      <Text
        x="50"
        y={yPos}
        fontSize="8"
        fontWeight="900"
        fontFamily="Outfit-Bold"
        fill={current.neon}
        letterSpacing="1"
        textAnchor="middle"
        opacity="0.9"
      >
        {label}
      </Text>
    );
  };

  // 1. DIBUJO DE MEDALLA SEMANAL (Escudo Clásico / Logo Runquer)
  const renderWeeklyMedal = () => {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`weeklyGrad-${medalType}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={current.start} />
            <Stop offset="100%" stopColor={current.end} />
          </LinearGradient>
        </Defs>

        {/* Glow trasero del escudo */}
        <Path
          d="M 50 12 L 82 22 L 82 55 C 82 76 50 91 50 91 C 50 91 18 76 18 55 L 18 22 Z"
          fill="none"
          stroke={current.neon}
          strokeWidth="6"
          opacity="0.3"
        />

        {/* Fondo oscuro del escudo */}
        <Path
          d="M 50 12 L 82 22 L 82 55 C 82 76 50 91 50 91 C 50 91 18 76 18 55 L 18 22 Z"
          fill="#06070D"
        />

        {/* Curvas de nivel topográficas */}
        {renderTopoMapLines()}

        {/* Borde metálico exterior (Gradiante) */}
        <Path
          d="M 50 12 L 82 22 L 82 55 C 82 76 50 91 50 91 C 50 91 18 76 18 55 L 18 22 Z"
          fill="none"
          stroke={`url(#weeklyGrad-${medalType})`}
          strokeWidth="4"
        />

        {/* Borde de neón interior fino */}
        <Path
          d="M 50 17 L 77 25 L 77 53 C 77 71 50 85 50 85 C 50 85 23 71 23 53 L 23 25 Z"
          fill="none"
          stroke={current.neon}
          strokeWidth="1.2"
          opacity="0.8"
        />

        {/* Contenido */}
        {renderRankNumber()}
        {renderPeriodLabel()}
      </Svg>
    );
  };

  // 2. DIBUJO DE MEDALLA MENSUAL (Buckler Circular / Estrellado)
  const renderMonthlyMedal = () => {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`monthlyGrad-${medalType}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={current.start} />
            <Stop offset="100%" stopColor={current.end} />
          </LinearGradient>
        </Defs>

        {/* Glow exterior de neón */}
        <Circle cx="50" cy="50" r="42" fill="none" stroke={current.neon} strokeWidth="6" opacity="0.25" />

        {/* Fondo oscuro del medallón */}
        <Circle cx="50" cy="50" r="42" fill="#06070D" />

        {/* Curvas de nivel topográficas */}
        {renderTopoMapLines()}

        {/* Corona de estrellas / Laureles de victoria grabados en los bordes */}
        <Circle cx="50" cy="50" r="39" fill="none" stroke={current.neon} strokeWidth="1" strokeDasharray="3, 5" opacity="0.6" />

        {/* Borde metálico circular */}
        <Circle cx="50" cy="50" r="42" fill="none" stroke={`url(#monthlyGrad-${medalType})`} strokeWidth="4.5" />
        
        {/* Anillo de neón interior */}
        <Circle cx="50" cy="50" r="35" fill="none" stroke={current.neon} strokeWidth="1.2" opacity="0.8" />

        {/* Estrellitas en el borde superior e inferior */}
        {/* Estrella Arriba */}
        <Path d="M 50 14 L 51.5 17 L 54.5 17 L 52 18.5 L 53 21.5 L 50 20 L 47 21.5 L 48 18.5 L 45.5 17 L 48.5 17 Z" fill={current.neon} />
        {/* Estrella Izquierda */}
        <Path d="M 14 50 L 15.5 53 L 18.5 53 L 16 54.5 L 17 57.5 L 14 56 L 11 57.5 L 12 54.5 L 9.5 53 L 12.5 53 Z" fill={current.neon} />
        {/* Estrella Derecha */}
        <Path d="M 86 50 L 87.5 53 L 90.5 53 L 88 54.5 L 89 57.5 L 86 56 L 83 57.5 L 84 54.5 L 81.5 53 L 84.5 53 Z" fill={current.neon} />

        {/* Contenido */}
        {renderRankNumber()}
        {renderPeriodLabel()}
      </Svg>
    );
  };

  // 3. DIBUJO DE MEDALLA ANUAL (Gran Escudo Coronado / Premium con Alas)
  const renderYearlyMedal = () => {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`yearlyGrad-${medalType}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={current.start} />
            <Stop offset="100%" stopColor={current.end} />
          </LinearGradient>
        </Defs>

        {/* Alas exteriores de gala */}
        <G opacity="0.8">
          {/* Ala Izquierda */}
          <Path
            d="M 22 45 C 10 40, 5 55, 12 70 C 15 60, 20 52, 22 48"
            fill="none"
            stroke={`url(#yearlyGrad-${medalType})`}
            strokeWidth="2.5"
          />
          <Path
            d="M 19 50 C 8 48, 5 62, 14 74 C 16 65, 18 57, 19 54"
            fill="none"
            stroke={current.neon}
            strokeWidth="1"
            opacity="0.8"
          />
          {/* Ala Derecha */}
          <Path
            d="M 78 45 C 90 40, 95 55, 88 70 C 85 60, 80 52, 78 48"
            fill="none"
            stroke={`url(#yearlyGrad-${medalType})`}
            strokeWidth="2.5"
          />
          <Path
            d="M 81 50 C 92 48, 95 62, 86 74 C 84 65, 82 57, 81 54"
            fill="none"
            stroke={current.neon}
            strokeWidth="1"
            opacity="0.8"
          />
        </G>

        {/* Glow trasero del escudo */}
        <Path
          d="M 50 28 L 78 37 L 78 65 C 78 82 50 94 50 94 C 50 94 22 82 22 65 L 22 37 Z"
          fill="none"
          stroke={current.neon}
          strokeWidth="6"
          opacity="0.25"
        />

        {/* Fondo oscuro */}
        <Path
          d="M 50 28 L 78 37 L 78 65 C 78 82 50 94 50 94 C 50 94 22 82 22 65 L 22 37 Z"
          fill="#06070D"
        />

        {/* Curvas de nivel topográficas */}
        {renderTopoMapLines()}

        {/* Borde metálico exterior */}
        <Path
          d="M 50 28 L 78 37 L 78 65 C 78 82 50 94 50 94 C 50 94 22 82 22 65 L 22 37 Z"
          fill="none"
          stroke={`url(#yearlyGrad-${medalType})`}
          strokeWidth="4"
        />

        {/* Borde de neón interior */}
        <Path
          d="M 50 33 L 73 40 L 73 63 C 73 77 50 88 50 88 C 50 88 27 77 27 63 L 27 40 Z"
          fill="none"
          stroke={current.neon}
          strokeWidth="1.2"
          opacity="0.8"
        />

        {/* CORONA IMPERIAL SUPERIOR */}
        <G>
          {/* Glow de la corona */}
          <Path
            d="M 32 26 L 36 12 L 44 20 L 50 8 L 56 20 L 64 12 L 68 26 Z"
            fill="none"
            stroke={current.neon}
            strokeWidth="4"
            opacity="0.3"
          />
          {/* Corona fondo oscuro */}
          <Path
            d="M 32 26 L 36 12 L 44 20 L 50 8 L 56 20 L 64 12 L 68 26 Z"
            fill="#06070D"
          />
          {/* Corona borde metálico */}
          <Path
            d="M 32 26 L 36 12 L 44 20 L 50 8 L 56 20 L 64 12 L 68 26 Z"
            fill="none"
            stroke={`url(#yearlyGrad-${medalType})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Base de la corona de neón */}
          <Path
            d="M 32 26 L 68 26"
            stroke={current.neon}
            strokeWidth="2.5"
          />
          {/* Gemas de la corona (círculos de neón en puntas) */}
          <Circle cx="36" cy="11" r="2" fill={current.neon} />
          <Circle cx="50" cy="7" r="2.2" fill={current.neon} />
          <Circle cx="64" cy="11" r="2" fill={current.neon} />
        </G>

        {/* Contenido */}
        {renderRankNumber()}
        {renderPeriodLabel()}
      </Svg>
    );
  };

  // Renderizar la forma correspondiente
  switch (periodType) {
    case 'weekly':
      return renderWeeklyMedal();
    case 'monthly':
      return renderMonthlyMedal();
    case 'yearly':
      return renderYearlyMedal();
    default:
      return renderWeeklyMedal();
  }
};
