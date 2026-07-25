// مكون نافذة الدليل المنبثقة - Evidence Popup
// مشروع التشجير - نظام القراءات العشر

'use client';

interface EvidencePopupProps {
  node: { wordText?: string };
  position: { x: number; y: number };
  evidence?: EvidenceItem[];
  onClose: () => void;
  onNavigate?: (target: string) => void;
}

interface EvidenceItem {
  source?: string;
  text?: string;
  reference?: string;
  manzumaLine?: string;
}

export function EvidencePopup({
  node,
  position,
  evidence = [],
  onClose,
  onNavigate,
}: EvidencePopupProps) {
  return (
    <div
      className="evidence-popup absolute z-50"
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translate(-50%, -100%)',
      }}
      onMouseLeave={onClose}
    >
      {/* رأس النافذة */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
        <h4 className="font-bold text-gray-900">
          كلمة: {node.wordText ?? 'غير محددة'}
        </h4>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
        >
          ×
        </button>
      </div>

      {/* محتوى النافذة */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {/* الدليل من الطيبة */}
        <EvidenceSection
          source="الطيبة"
          icon="📜"
          color="emerald"
          evidence={evidence.filter(e => e.source === 'TAYYIBAH')}
          onNavigate={onNavigate}
        />

        {/* الدليل من النشر */}
        <EvidenceSection
          source="النشر"
          icon="📖"
          color="blue"
          evidence={evidence.filter(e => e.source === 'NASHR')}
          onNavigate={onNavigate}
        />

        {/* الدليل من الجنة */}
        <EvidenceSection
          source="الجنة"
          icon="🌸"
          color="purple"
          evidence={evidence.filter(e => e.source === 'JANNAH')}
          onNavigate={onNavigate}
        />
      </div>

      {/* الروابط السريعة */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <QuickLink label="المنظومة" onClick={() => onNavigate?.('manzuma')} />
          <QuickLink label="النشر" onClick={() => onNavigate?.('nashr')} />
          <QuickLink label="الجنة" onClick={() => onNavigate?.('jannah')} />
          <QuickLink label="المقاطع" onClick={() => onNavigate?.('qati')} />
        </div>
      </div>

      {/* السهم */}
      <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
      </div>
    </div>
  );
}

// مكون قسم الدليل
function EvidenceSection({
  source,
  icon,
  color,
  evidence,
  onNavigate,
}: {
  source: string;
  icon: string;
  color: string;
  evidence: EvidenceItem[];
  onNavigate?: (target: string) => void;
}) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };

  if (evidence.length === 0) return null;

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="font-medium text-sm">{source}</span>
      </div>
      {evidence.map((item, index) => {
        const text = item.text ?? 'لا يوجد نص للدليل.';
        const reference = item.reference;
        const manzumaLine = item.manzumaLine;

        return (
          <div key={index} className="text-sm mb-2 last:mb-0">
            <p className="mb-1">{text}</p>
            {reference && (
              <button
                onClick={() => onNavigate?.(reference)}
                className="text-xs underline opacity-75 hover:opacity-100"
              >
                المرجع: {reference}
              </button>
            )}
            {manzumaLine && (
              <button
                onClick={() => onNavigate?.('manzuma')}
                className="block text-xs mt-1 font-amiri leading-relaxed"
              >
                {manzumaLine}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// مكون الرابط السريع
function QuickLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
    >
      {label}
    </button>
  );
}
