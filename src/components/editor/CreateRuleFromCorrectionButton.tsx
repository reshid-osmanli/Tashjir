'use client';

// زر تحويل التصحيح إلى قاعدة - FR-ES-12
// يظهر بجانب كل تصحيح ويسمح بإنشاء قاعدة مرشحة

import { useState } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import { createCandidateFromCorrection } from '@/lib/tashjeer/learning-loop';
import type { Correction } from '@/lib/tashjeer/model/v8';

interface CreateRuleFromCorrectionButtonProps {
  correction: Correction;
  onCreated?: (candidateId: string) => void;
}

export function CreateRuleFromCorrectionButton({
  correction,
  onCreated,
}: CreateRuleFromCorrectionButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { createCandidateRule, activeProfile } = useEngineStudioStore();

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      // إنشاء قاعدة مرشحة من التصحيح.
      const candidate = createCandidateFromCorrection(correction, activeProfile.config);

      // حفظ القاعدة المرشحة.
      createCandidateRule(candidate);

      // إظهار رسالة النجاح.
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // استدعاء callback.
      onCreated?.(candidate.id);
    } catch (error) {
      console.error('Failed to create candidate rule:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleCreate}
        disabled={isCreating}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
      >
        {isCreating ? (
          <>
            <span className="animate-spin">⚙️</span>
            <span>جاري الإنشاء...</span>
          </>
        ) : (
          <>
            <span>💡</span>
            <span>إنشاء قاعدة من هذا التصحيح</span>
          </>
        )}
      </button>

      {/* Success Message */}
      {showSuccess && (
        <div className="absolute right-0 top-full z-10 mt-2 rounded-lg border border-green-200 bg-green-50 p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">✓</span>
            <div>
              <div className="text-sm font-medium text-green-900">
                تم إنشاء قاعدة مرشحة
              </div>
              <div className="text-xs text-green-700">
                يمكنك مراجعتها في Engine Studio
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
