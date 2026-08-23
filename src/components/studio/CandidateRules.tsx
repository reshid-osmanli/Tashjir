'use client';

// القواعد المرشحة - Candidate Rules
// FR-ES-12: تحويل التصحيحات إلى قواعد مرشحة

import { useEngineStudioStore } from '@/stores/engine-studio-store';

export function CandidateRules() {
  const { candidateRules, createRuleFromCandidate, rejectCandidateRule } = useEngineStudioStore();

  const pendingCandidates = candidateRules.filter((c) => c.status === 'PENDING');
  const resolvedCandidates = candidateRules.filter((c) => c.status !== 'PENDING');

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">القواعد المرشحة</h2>
        <p className="text-sm text-gray-500">
          قواعد مقترحة من أنماط التصحيح المتكررة — بمراجعة المستخدم (FR-ES-12)
        </p>
      </div>

      <div className="p-6">
        {pendingCandidates.length === 0 && resolvedCandidates.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl">💡</div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">لا توجد قواعد مرشحة</h3>
            <p className="mt-2 text-sm text-gray-500">
              عند تكرار نمط تصحيح معين، سيقترح النظام قاعدة مرشحة هنا.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending */}
            {pendingCandidates.length > 0 && (
              <div>
                <h3 className="mb-3 font-medium text-gray-900">
                  بانتظار المراجعة ({pendingCandidates.length})
                </h3>
                <div className="space-y-2">
                  {pendingCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{candidate.pattern}</h4>
                          <p className="mt-1 text-sm text-gray-600">{candidate.reason}</p>
                          <div className="mt-2 text-xs text-gray-500">
                            تكرار: {candidate.count} مرة
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => createRuleFromCandidate(candidate.id)}
                            className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
                          >
                            إنشاء قاعدة
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectCandidateRule(candidate.id)}
                            className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved */}
            {resolvedCandidates.length > 0 && (
              <div>
                <h3 className="mb-3 font-medium text-gray-900">
                  تمت المعالجة ({resolvedCandidates.length})
                </h3>
                <div className="space-y-2">
                  {resolvedCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                    >
                      <div>
                        <span className="font-medium text-gray-700">{candidate.pattern}</span>
                        <span className="mr-2 text-xs text-gray-500">({candidate.count}×)</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          candidate.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {candidate.status === 'APPROVED' ? 'معتمد' : 'مرفوض'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
