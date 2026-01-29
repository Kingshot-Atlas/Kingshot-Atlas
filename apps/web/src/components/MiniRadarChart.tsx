import React, { memo } from 'react';

interface MiniRadarChartProps {
  data: {
    label: string;
    value: number; // 0-100 scale
  }[];
  size?: number;
  accentColor?: string;
}

const MiniRadarChart: React.FC<MiniRadarChartProps> = ({ 
  data, 
  size = 60,
  accentColor = '#22d3ee'
}) => {
  const center = size / 2;
  const radius = (size / 2) - 4; // Minimal padding
  
  const angleStep = (2 * Math.PI) / data.length;
  
  // Calculate point positions
  const getPoint = (index: number, value: number) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };
  
  // Generate polygon points for the data
  const dataPoints = data.map((d, i) => getPoint(i, d.value));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  
  // Generate outer boundary
  const outerPoints = data.map((_, i) => getPoint(i, 100));
  const outerPolygon = outerPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer boundary */}
      <polygon
        points={outerPolygon}
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="1"
        opacity={0.5}
      />
      
      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill={`${accentColor}30`}
        stroke={accentColor}
        strokeWidth="1.5"
      />
    </svg>
  );
};

export default memo(MiniRadarChart);
