'use client';

// قائمة قابلة للتمرير باحترافية - ScrollableList
// FR-ED-01: قوائم طويلة قابلة للتمرير
//
// الميزات:
// 1. شريط تمرير مرئي دائمًا عند تجاوز المحتوى
// 2. تمرير بعجلة الماوس واللمس والأسهم
// 3. زرا صعود ونزول يظهران عند الحاجة
// 4. رأس ثابت (Sticky)
// 5. بحث/تصفية فوري
// 6. انتقال تلقائي للعنصر المحدد (Scroll Into View)
// 7. أداء محفوظ مع مئات العناصر

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';

interface ScrollableListProps<T> {
  /** العناصر المعروضة. */
  items: T[];
  /** معرّف فريد لكل عنصر. */
  keyExtractor: (item: T) => string;
  /** دالة رسم كل عنصر. */
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  /** معرّف العنصر المحدد حاليًا (للتمرير التلقائي). */
  selectedId?: string | null;
  /** معرّفات العناصر المحددة متعددة. */
  selectedIds?: Set<string>;
  /** عنوان القائمة (ثابت). */
  title?: string;
  /** عدد العناصر (يُعرض بجانب العنوان). */
  count?: number;
  /** تفعيل البحث النصي. */
  searchable?: boolean;
  /** نص البحث المبدئي. */
  initialSearch?: string;
  /** دالة التصفية: تُرجع true إن طابق العنصر البحث. */
  filterFn?: (item: T, query: string) => boolean;
  /** عناصر إضافية في الرأس (أدوات، أزرار). */
  headerActions?: React.ReactNode;
  /** نص عند الفراغ. */
  emptyMessage?: string;
  /** ارتفاع القائمة (افتراضيًا: ملء الحاوية). */
  height?: string;
  /** استدعاء عند النقر على عنصر. */
  onItemClick?: (item: T) => void;
  /** استدعاء عند الضغط على Delete. */
  onDeleteSelected?: (ids: string[]) => void;
}

export interface ScrollableListHandle {
  scrollToId: (id: string) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export const ScrollableList = forwardRef(function ScrollableList<T>(
  {
    items,
    keyExtractor,
    renderItem,
    selectedId,
    selectedIds,
    title,
    count,
    searchable = true,
    initialSearch = '',
    filterFn,
    headerActions,
    emptyMessage = 'لا توجد عناصر',
    height,
    onItemClick,
    onDeleteSelected,
  }: ScrollableListProps<T>,
  ref: React.ForwardedRef<ScrollableListHandle>
) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // تحديث حالة التمرير.
  const updateScrollState = useCallback(() => {
    const element = listRef.current;
    if (!element) return;
    setCanScrollUp(element.scrollTop > 2);
    setCanScrollDown(element.scrollTop + element.clientHeight < element.scrollHeight - 2);
    const maxScroll = element.scrollHeight - element.clientHeight;
    setScrollProgress(maxScroll > 0 ? element.scrollTop / maxScroll : 0);
  }, []);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [items.length, updateScrollState]);

  // تمرير تلقائي للعنصر المحدد.
  useEffect(() => {
    if (!selectedId) return;
    const element = itemRefs.current.get(selectedId);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  // واجهة الأمر من الخارج.
  useImperativeHandle(ref, () => ({
    scrollToId: (id: string) => {
      itemRefs.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    scrollToTop: () => {
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    scrollToBottom: () => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    },
  }));

  // تصفية العناصر.
  const filteredItems = searchQuery && filterFn
    ? items.filter((item) => filterFn(item, searchQuery))
    : items;

  // التنقل بلوحة المفاتيح.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const currentIndex = selectedId
          ? filteredItems.findIndex((item) => keyExtractor(item) === selectedId)
          : -1;
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, filteredItems.length - 1)
            : Math.max(currentIndex - 1, 0);
        const next = filteredItems[nextIndex];
        if (next && onItemClick) onItemClick(next);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        if (filteredItems.length > 0 && onItemClick) onItemClick(filteredItems[0]);
      }
      if (event.key === 'End') {
        event.preventDefault();
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        if (filteredItems.length > 0 && onItemClick) onItemClick(filteredItems[filteredItems.length - 1]);
      }
      if (event.key === 'Delete' && onDeleteSelected) {
        const ids = selectedIds
          ? [...selectedIds]
          : selectedId
            ? [selectedId]
            : [];
        if (ids.length > 0) onDeleteSelected(ids);
      }
    },
    [selectedId, filteredItems, keyExtractor, onItemClick, onDeleteSelected, selectedIds]
  );

  const registerItemRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(id, element);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      style={height ? { height } : undefined}
    >
      {/* Sticky Header */}
      {(title || searchable || headerActions) && (
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          {title && (
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">
                {title}
                {count !== undefined && (
                  <span className="mr-2 text-xs font-normal text-gray-500">
                    ({filteredItems.length} / {count})
                  </span>
                )}
              </h3>
              {headerActions}
            </div>
          )}
          {searchable && (
            <div className="px-4 pb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Scrollable Content */}
      <div className="relative min-h-0 flex-1">
        {/* Scroll Up Button */}
        {canScrollUp && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollBy({ top: -200, behavior: 'smooth' })}
            className="absolute start-1/2 top-1 z-20 -translate-x-1/2 rounded-full border border-gray-300 bg-white/95 px-3 py-0.5 text-xs shadow-md transition-opacity hover:bg-gray-50"
            aria-label="صعود"
          >
            ↑
          </button>
        )}

        {/* Main List */}
        <div
          ref={listRef}
          className="h-full overflow-y-auto scroll-smooth [scrollbar-gutter:stable]"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="listbox"
          aria-label={title ?? 'قائمة'}
        >
          {filteredItems.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-500">
              {searchQuery ? 'لا نتائج مطابقة' : emptyMessage}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredItems.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = id === selectedId || (selectedIds?.has(id) ?? false);
                return (
                  <div
                    key={id}
                    ref={(el) => registerItemRef(id, el)}
                    onClick={() => onItemClick?.(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onItemClick?.(item);
                      }
                    }}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    data-item-id={id}
                  >
                    {renderItem(item, index, isSelected)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scroll Down Button */}
        {canScrollDown && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollBy({ top: 200, behavior: 'smooth' })}
            className="absolute bottom-1 start-1/2 z-20 -translate-x-1/2 rounded-full border border-gray-300 bg-white/95 px-3 py-0.5 text-xs shadow-md transition-opacity hover:bg-gray-50"
            aria-label="نزول"
          >
            ↓
          </button>
        )}

        {/* Scroll Progress Indicator */}
        {(canScrollUp || canScrollDown) && (
          <div className="pointer-events-none absolute end-0 top-0 h-full w-1">
            <div
              className="absolute end-0 w-1 rounded-full bg-emerald-400 opacity-60 transition-all"
              style={{
                top: `${scrollProgress * 80}%`,
                height: `${Math.max(10, 100 / Math.max(1, items.length / 5))}%`,
              }}
            />
          </div>
        )}

        {/* Jump to Top Button */}
        {canScrollUp && scrollProgress > 0.3 && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="absolute bottom-8 end-2 z-20 rounded-full border border-gray-300 bg-white/95 p-1.5 text-xs shadow-md hover:bg-gray-50"
            aria-label="الانتقال إلى أعلى"
            title="الانتقال إلى أعلى"
          >
            ⬆
          </button>
        )}
      </div>
    </div>
  );
});
