// مكون رسم خطوط التشجير - Line Drawer
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useState } from 'react';
import { getLineColor } from '@/lib/tashjeer/color-system';
import { TashjeerLine, WordPosition } from '@/types';

interface LineDrawerProps {
  line: TashjeerLine;
  positions: Map<number, WordPosition>;
  isActive?: boolean;
  onUpdate?: (line: TashjeerLine) => void;
  onDelete?: () => void;
  onSelect?: () => void;
}

export function LineDrawer({
  line,
  positions,
  isActive = false,
  onUpdate,
  onDelete,
  onSelect,
}: LineDrawerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const lineColor = line.color ?? getLineColor(line.type);
  const nodes = line.nodes.map((node) => {
    const position = positions.get(node.wordId);
    return {
      ...node,
      x: Number.isFinite(node.x) && node.x > 0 ? node.x : position?.centerX ?? 0,
      y: Number.isFinite(node.y) && node.y > 0 ? node.y : line.yPosition,
    };
  });

  // حساب مسار الخط
  const linePath = calculateLinePath(nodes, positions);

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      {/* مسار الخط */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={isActive ? 3 : isHovered ? 2.5 : line.strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={line.dashStyle || 'none'}
        filter={isActive ? 'url(#glow)' : 'none'}
        opacity={isHovered || isActive ? 1 : 0.8}
      />

      {/* نقاط الارتباط */}
      {nodes.map((node, index) => (
        <g key={index}>
          {/* نقطة الارتباط */}
          <circle
            cx={node.x}
            cy={node.y}
            r={isHovered || isActive ? 5 : 4}
            fill={lineColor}
            stroke="white"
            strokeWidth={2}
          />

          {/* تسمية القارئ */}
          {(isHovered || isActive) && (
            <g>
              <rect
                x={node.x - 20}
                y={node.y - 20}
                width={40}
                height={16}
                fill={lineColor}
                rx={3}
              />
              <text
                x={node.x}
                y={node.y - 9}
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
              >
                {getQiraahShortName(node.qiraahId)}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* زر الحذف عند التحويم */}
      {isHovered && onDelete && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx={(nodes[0]?.x || 0) + 15}
            cy={(nodes[0]?.y || 0) - 15}
            r={8}
            fill="#ef4444"
          />
          <text
            x={(nodes[0]?.x || 0) + 15}
            y={(nodes[0]?.y || 0) - 11}
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="bold"
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
}

// حساب مسار الخط
function calculateLinePath(
  nodes: Array<{ wordId: number; x: number; y: number }>,
  positions: Map<number, WordPosition>
): string {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) {
    return `M ${nodes[0].x} ${nodes[0].y}`;
  }

  let path = `M ${nodes[0].x} ${nodes[0].y}`;

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];

    // استخدام منحنى بيزيه للخطوط الطويلة
    const dx = Math.abs(curr.x - prev.x);
    if (dx > 50) {
      const cp1x = prev.x + dx * 0.3;
      const cp1y = prev.y;
      const cp2x = curr.x - dx * 0.3;
      const cp2y = curr.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  return path;
}

// الحصول على اسم القارئ المختصر
function getQiraahShortName(qiraahId?: number): string {
  const names: Record<number, string> = {
    1: 'قالون',
    2: 'ورش',
    3: 'البزي',
    4: 'قنبل',
    5: 'الدوري',
    6: 'السوسي',
    7: 'هشام',
    8: 'ابن ذكوان',
    9: 'حفص',
    10: 'شعبة',
    11: 'خلف',
    12: 'خلاد',
    13: 'الليث',
    14: 'الدوري',
    15: 'ابن وردان',
    16: 'ابن جماز',
    17: 'رويس',
    18: 'روح',
    19: 'إدريس',
    20: 'إسحاق',
  };
  return qiraahId ? names[qiraahId] || `#${qiraahId}` : '';
}
