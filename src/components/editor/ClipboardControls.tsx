'use client';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits as ar } from '@/lib/utils/arabic-numbers';

export function ClipboardControls() {
  const store = useEditorStore();
  const suspended = store.document?.suspendedLinks ?? [];
  return <div className="flex items-center gap-2"><details className="relative text-xs" dir="rtl">
    <summary className="cursor-pointer rounded border border-stone-300 px-2 py-1">الحافظة {suspended.length ? `· ${ar(suspended.length)} علاقات معلّقة` : ''}</summary>
    <div className="absolute start-0 top-full z-40 mt-1 w-80 space-y-2 rounded border bg-white p-3 shadow-xl">
      <div className="flex gap-2">
        <button type="button" onClick={store.copySelection} className="rounded border px-2 py-1">نسخ</button>
        <button type="button" onClick={store.cutSelection} className="rounded border px-2 py-1">قص</button>
        <button type="button" disabled={!store.clipboard} onClick={() => void store.requestPasteSelection()} className="rounded border px-2 py-1 disabled:opacity-40">لصق</button>
      </div>
      <p className="text-emerald-900">{store.clipboardNotice || 'حدد وجهًا أو اختلافًا أو جزءًا. Ctrl+C / X / V.'}</p>
      {suspended.length > 0 && <div className="max-h-48 overflow-auto rounded bg-amber-50 p-2">
        <p className="font-semibold">علاقات معلّقة للمراجعة — لم تُطبّق</p>
        {suspended.map((link) => <div key={link.id} className="my-2 break-all border-b border-amber-200 pb-2">
          <p>{link.reason}</p>
          <p>{link.original.from.type}: {link.mappedFrom ?? link.original.from.id}</p>
          <p>← {link.original.to.type}: {link.mappedTo ?? link.original.to.id}</p>
        </div>)}
      </div>}
    </div>
  </details><span role="status" className="max-w-64 text-[10px] text-emerald-900">{store.clipboardNotice}</span></div>;
}
