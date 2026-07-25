// حالة المحرر - Editor Store
// مشروع التشجير - نظام القراءات العشر

import { create } from 'zustand';
import { LineType, NodePosition } from '@/types';

type EditorTool = 'select' | 'line-usul' | 'line-farsh' | 'line-madud' | 'delete';

interface EditorSnapshot {
  zoom: number;
  pan: { x: number; y: number };
  showProperties: boolean;
  showGrid: boolean;
  showRulers: boolean;
  selectedWordId: number | null;
  selectedLineId: number | null;
  selectedNodeId: number | null;
  currentTool: EditorTool;
  currentLineType: LineType;
  currentQiraahId: number;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
}

interface EditorState {
  // حالة العرض
  zoom: number;
  pan: { x: number; y: number };
  showProperties: boolean;
  showGrid: boolean;
  showRulers: boolean;

  // حالة التحديد
  selectedWordId: number | null;
  selectedLineId: number | null;
  selectedNodeId: number | null;

  // حالة الأداة الحالية
  currentTool: EditorTool;
  currentLineType: LineType;
  currentQiraahId: number;

  // حالة التحرير
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];

  // الإجراءات
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;

  toggleProperties: () => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
  setShowGrid: (showGrid: boolean) => void;
  setShowRulers: (showRulers: boolean) => void;

  selectWord: (wordId: number | null) => void;
  selectLine: (lineId: number | null) => void;
  selectNode: (nodeId: number | null) => void;
  clearSelection: () => void;

  setCurrentTool: (tool: EditorState['currentTool']) => void;
  setCurrentLineType: (type: LineType) => void;
  setCurrentQiraah: (qiraahId: number) => void;

  setEditing: (isEditing: boolean) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;

  undo: () => void;
  redo: () => void;
  saveState: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // الحالة الأولية
  zoom: 1,
  pan: { x: 0, y: 0 },
  showProperties: true,
  showGrid: false,
  showRulers: false,

  selectedWordId: null,
  selectedLineId: null,
  selectedNodeId: null,

  currentTool: 'select',
  currentLineType: 'FARSH',
  currentQiraahId: 1,

  isEditing: false,
  hasUnsavedChanges: false,
  undoStack: [],
  redoStack: [],

  // إجراءات العرض
  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.5), 3) }),
  setPan: (pan) => set({ pan }),
  zoomIn: () => set((state) => ({ zoom: Math.min(state.zoom * 1.2, 3) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(state.zoom / 1.2, 0.5) })),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  toggleProperties: () => set((state) => ({ showProperties: !state.showProperties })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowRulers: (showRulers) => set({ showRulers }),

  // إجراءات التحديد
  selectWord: (wordId) => set({ selectedWordId: wordId, selectedLineId: null, selectedNodeId: null }),
  selectLine: (lineId) => set({ selectedLineId: lineId, selectedWordId: null, selectedNodeId: null }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedWordId: null, selectedLineId: null }),
  clearSelection: () => set({ selectedWordId: null, selectedLineId: null, selectedNodeId: null }),

  // إجراءات الأدوات
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCurrentLineType: (type) => set({ currentLineType: type }),
  setCurrentQiraah: (qiraahId) => set({ currentQiraahId: qiraahId }),

  // إجراءات التحرير
  setEditing: (isEditing) => set({ isEditing }),
  setUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  // إجراءات التراجع
  undo: () => {
    const state = get();
    const { undoStack } = state;
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const current = createSnapshot(state);

    set({
      ...previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...state.redoStack, current],
    });
  },

  redo: () => {
    const state = get();
    const { redoStack } = state;
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    const current = createSnapshot(state);

    set({
      ...next,
      undoStack: [...state.undoStack, current],
      redoStack: redoStack.slice(0, -1),
    });
  },

  saveState: () => {
    const state = get();
    set({
      undoStack: [...state.undoStack, createSnapshot(state)].slice(-50),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },
}));

function createSnapshot(state: EditorState): EditorSnapshot {
  return {
    zoom: state.zoom,
    pan: state.pan,
    showProperties: state.showProperties,
    showGrid: state.showGrid,
    showRulers: state.showRulers,
    selectedWordId: state.selectedWordId,
    selectedLineId: state.selectedLineId,
    selectedNodeId: state.selectedNodeId,
    currentTool: state.currentTool,
    currentLineType: state.currentLineType,
    currentQiraahId: state.currentQiraahId,
    isEditing: state.isEditing,
    hasUnsavedChanges: state.hasUnsavedChanges,
  };
}
