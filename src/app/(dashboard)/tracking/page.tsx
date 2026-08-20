'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listDocuments, loadDocument } from '@/lib/storage/document-store';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import type { TashjeerDocument } from '@/types/tashjeer';
import type { VariantCategory } from '@/types';

export default function TrackingPage() {
  const [documents, setDocuments] = useState<TashjeerDocument[]>([]);
  const [category, setCategory] = useState<VariantCategory | 'ALL'>('ALL');
  useEffect(() => setDocuments(listDocuments().map((entry) => loadDocument(entry.ayahKey)).filter((item): item is TashjeerDocument => item !== null)), []);
  const rows = useMemo(() => documents.flatMap((document) => document.variants.filter((variant) => category === 'ALL' || variant.category === category).map((variant) => ({ document, variant }))), [documents, category]);
  const changes = useMemo(() => documents.flatMap((document) => document.changeLog.map((change) => ({ document, change }))).filter(({ change }) => category === 'ALL' || rows.some(({ document, variant }) => document.ayahKey === document.ayahKey && (change.entityId === variant.id || change.entityType !== 'variant'))), [documents, rows, category]);
  return <div className="space-y-5">
    <header><h1 className="text-xl font-bold text-stone-900">تتبع المحرك والتصحيح اليدوي</h1><p className="mt-1 text-sm text-stone-600">قارن مواضع المحرك بالنتيجة المحررة، وانتقل مباشرة إلى موضع المراجعة.</p></header>
    <div className="flex flex-wrap gap-2">{(['ALL', 'USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'] as const).map((value) => <button key={value} onClick={() => setCategory(value)} className={`rounded border px-3 py-1 text-xs ${category === value ? 'border-emerald-700 bg-emerald-700 text-white' : 'bg-white text-stone-700'}`}>{value === 'ALL' ? 'كل الأنواع' : CATEGORY_LABELS[value]}</button>)}</div>
    <section className="rounded-xl border border-stone-200 bg-white"><div className="border-b p-3 text-sm font-bold">المواضع النهائية ({rows.length})</div><ul className="divide-y">{rows.map(({ document, variant }) => <li key={variant.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><b>{CATEGORY_LABELS[variant.category]}</b> — {variant.title}<span className="mr-2 text-xs text-stone-500">{variant.isGlobalDerived ? 'اقتراح المحرك' : 'نتيجة محررة'} · ك{variant.startPosition}–{variant.endPosition}</span></div><Link className="text-xs text-emerald-700 hover:underline" href={`/editor?ayah=${document.ayahKey}&variant=${variant.id}`}>مراجعة في المحرر</Link></li>)}</ul></section>
    <section className="rounded-xl border border-stone-200 bg-white"><div className="border-b p-3 text-sm font-bold">سجل التعديلات اليدوية ({changes.length})</div><ul className="divide-y">{changes.length ? changes.map(({ document, change }) => <li key={change.id} className="flex justify-between gap-3 p-3 text-xs"><span><b>{change.source === 'EDITOR' ? 'المحرر' : change.source}</b> — {change.action} <span className="text-stone-500">{new Date(change.at).toLocaleString('ar')}</span></span><Link href={`/editor?ayah=${document.ayahKey}`} className="text-emerald-700">فتح</Link></li>) : <li className="p-4 text-sm text-stone-500">لا توجد تعديلات مسجلة بعد؛ ستظهر علاقات الأوجه والأجزاء والتصحيحات الجديدة هنا.</li>}</ul></section>
  </div>;
}
