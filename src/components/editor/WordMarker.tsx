// مكون مؤشر الكلمة - Word Marker
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useState } from 'react';

type MarkerWord = {
  id: number;
  text: string;
  position: number;
};

interface WordMarkerProps {
  word: MarkerWord;
  position: {
    x: number;
    y: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  isSelected?: boolean;
  isHighlighted?: boolean;
  onSelect?: () => void;
  onHover?: (node: { wordText?: string }) => void;
}

export function WordMarker({
  word,
  position,
  isSelected = false,
  isHighlighted = false,
  onSelect,
  onHover,
}: WordMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.({ wordText: word.text });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    onSelect?.();
  };

  // تحديد لون المؤشر
  const getMarkerColor = () => {
    if (isSelected) return '#3b82f6';
    if (isHighlighted) return '#fbbf24';
    if (isHovered) return '#22c55e';
    return 'transparent';
  };

  const markerColor = getMarkerColor();
  const connectorColor = markerColor === 'transparent' ? '#64748b' : markerColor;

  return (
    <g
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* خلفية الكلمة */}
      <rect
        x={position.x - 2}
        y={position.y - 2}
        width={position.width + 4}
        height={position.height + 4}
        fill={isHovered ? 'rgba(34, 197, 94, 0.1)' : 'transparent'}
        stroke={markerColor}
        strokeWidth={isSelected ? 2 : 1}
        rx={4}
      />

      {/* نقاط ارتباط خطوط التشجير */}
      {/* نقطة أعلى الكلمة */}
      <circle
        cx={position.centerX}
        cy={position.y - 5}
        r={isHovered ? 4 : 3}
        fill={connectorColor}
        opacity={isHovered || isSelected ? 1 : 0.5}
      />

      {/* نقطة أسفل الكلمة */}
      <circle
        cx={position.centerX}
        cy={position.y + position.height + 5}
        r={isHovered ? 4 : 3}
        fill={connectorColor}
        opacity={isHovered || isSelected ? 1 : 0.5}
      />

      {/* نقطة وسط الكلمة */}
      <circle
        cx={position.centerX}
        cy={position.centerY}
        r={isHovered ? 4 : 3}
        fill={connectorColor}
        opacity={isHovered || isSelected ? 1 : 0.5}
      />

      {/* تسمية عند التحويم */}
      {isHovered && (
        <g>
          <rect
            x={position.centerX - 30}
            y={position.y - 30}
            width={60}
            height={20}
            fill="rgba(0, 0, 0, 0.8)"
            rx={4}
          />
          <text
            x={position.centerX}
            y={position.y - 16}
            textAnchor="middle"
            fill="white"
            fontSize="10"
          >
            كلمة {word.position}
          </text>
        </g>
      )}
    </g>
  );
}
