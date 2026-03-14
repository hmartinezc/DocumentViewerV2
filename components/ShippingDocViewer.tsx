import type { FunctionComponent } from 'preact';
import { useState, useMemo, useEffect, useCallback, useRef } from 'preact/hooks';
import { 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Table, 
  Download, 
  Layers, 
  LayoutList, 
  CheckSquare, 
  Square,
  Box,
  Plane,
  ShieldCheck,
  ExternalLink,
  Building2,
  ArrowRight,
  User,
  Factory,
  Tags,
  FileCog,
  Globe,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  XCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowUpDown,
  GripVertical,
  X,
  Check
} from 'lucide-preact';
import { ShipmentData, Document } from '../types';

// --- Utils & Icons ---

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'xls':
    case 'xlsx':
      return <Table className="w-5 h-5 text-green-600" />;
    case 'jpg':
    case 'png':
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    default:
      return <FileText className="w-5 h-5 text-gray-400" />;
  }
};

const getDocCategory = (doc: Document) => {
  if (doc.category) return doc.category;
  const n = doc.name.toLowerCase();
  if (n.includes('invoice')) return 'Commercial Invoices';
  if (n.includes('packing') && n.includes('list')) return 'Packing Lists';
  if (n.includes('manifest')) return 'Manifests';
  if (n.includes('certificate')) return 'Certificates';
  if (n.includes('mawb')) return 'Master AWB Copies';
  if (n.includes('hawb')) return 'House AWB Copies';
  if (n.includes('photo') || n.includes('jpg') || n.includes('png') || n.includes('image')) return 'Photos & Evidence';
  if (n.includes('report')) return 'Reports';
  if (n.includes('receipt')) return 'Receipts';
  return 'General Documents';
};

// Singular version for the card title
const getPrettyName = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('invoice')) return 'Commercial Invoice';
  if (n.includes('packing') && n.includes('list')) return 'Packing List';
  if (n.includes('manifest')) return 'Manifest';
  if (n.includes('certificate')) return 'Certificate';
  if (n.includes('mawb')) return 'Master AWB';
  if (n.includes('hawb')) return 'House AWB';
  if (n.includes('photo') || n.includes('jpg') || n.includes('png') || n.includes('image')) return 'Photo / Evidence';
  if (n.includes('report')) return 'Report';
  if (n.includes('receipt')) return 'Receipt';
  return 'Document';
};

const getDisplayTitle = (doc: Document) => doc.displayName || getPrettyName(doc.name);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'In Transit': return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'Delivered': return 'bg-green-100 text-green-700 border-green-200';
    case 'Exception': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// --- Sub-components ---

interface DocRowProps {
  doc: Document;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onDownload: (doc: Document) => void;
  contextLabel?: string;
  disabled?: boolean;
}

const DocRow: FunctionComponent<DocRowProps> = ({ doc, isSelected, onToggle, onDownload, contextLabel, disabled }) => {
  const prettyName = getDisplayTitle(doc);

  return (
    <div 
      className={`group flex items-center p-3 mb-2 bg-white rounded-lg border transition-all duration-200 active:scale-[0.99] touch-manipulation ${
        isSelected ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
      }`}
    >
      {/* Checkbox - Larger touch target for mobile */}
      <button 
        onClick={() => onToggle(doc.id)}
        className="mr-3 text-gray-400 hover:text-purple-600 transition-colors focus:outline-none p-1 -ml-1"
      >
        {isSelected ? (
          <CheckSquare className="w-5 h-5 text-purple-600" />
        ) : (
          <Square className="w-5 h-5" />
        )}
      </button>

      {/* Icon */}
      <div className="mr-3 p-2 bg-gray-50 rounded-md group-hover:bg-white transition-colors shrink-0">
        {getFileIcon(doc.type)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 mr-2 cursor-pointer" onClick={() => onToggle(doc.id)}>
        <div className="flex items-center flex-wrap gap-1">
           {/* Primary Title: Readable Category */}
           <h4 className="text-sm font-semibold text-gray-900 truncate max-w-full">
            {prettyName}
          </h4>
          {contextLabel && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
              {contextLabel}
            </span>
          )}
        </div>
        
        {/* Secondary Info: Filename (smaller) & Metadata */}
        <div className="flex flex-col mt-0.5">
            {/* Actual Filename - dim and small */}
            {!doc.displayName && (
              <span className="text-[11px] text-gray-400 truncate font-mono max-w-[200px] sm:max-w-xs" title={doc.name}>
                  {doc.name}
              </span>
            )}
            {/* Size and Date */}
            <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span className="font-medium">{doc.size}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span>{doc.date}</span>
            </p>
        </div>
      </div>

      {/* Actions - Always visible on mobile (opacity-100), hidden on desktop until hover */}
      {doc.url ? (
        <button
          className={`p-2 rounded-full transition-all shrink-0 ${
            disabled 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-400 hover:text-sky-600 hover:bg-sky-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 active:bg-sky-100'
          }`}
          title="Download"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDownload(doc);
          }}
        >
          <Download className="w-5 h-5" />
        </button>
      ) : (
        <span
          className="p-2 text-gray-300 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0"
          title="No download link"
        >
          <Download className="w-5 h-5" />
        </span>
      )}
    </div>
  );
};

// --- Types for download event ---
export interface DownloadRequestFile {
  id: string;
  name: string;
  displayName?: string;
  type: string;
  url: string;
}

export interface DownloadRequestEvent {
  files: DownloadRequestFile[];
  allSameType: boolean;
  fileType: string | null; // e.g., 'pdf' if all are pdf, null if mixed
}

export type DownloadState = 'idle' | 'preparing' | 'downloading' | 'done' | 'error';

// --- Download feedback toast ---

const downloadStateConfig: Record<Exclude<DownloadState, 'idle'>, { bg: string; defaultMsg: string }> = {
  preparing: { bg: 'bg-purple-600', defaultMsg: 'Preparing download…' },
  downloading: { bg: 'bg-sky-600', defaultMsg: 'Downloading…' },
  done: { bg: 'bg-green-600', defaultMsg: 'Download ready' },
  error: { bg: 'bg-red-600', defaultMsg: 'Download failed' },
};

const DownloadToast: FunctionComponent<{ state?: DownloadState; message?: string }> = ({ state, message }) => {
  if (!state || state === 'idle') return null;
  const cfg = downloadStateConfig[state];
  const isSpinner = state === 'preparing' || state === 'downloading';
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ${cfg.bg} animate-toast-in`}>
      {isSpinner
        ? <Loader2 className="w-5 h-5 animate-spin" />
        : state === 'done'
          ? <CheckCircle className="w-5 h-5" />
          : <AlertCircle className="w-5 h-5" />
      }
      <span>{message || cfg.defaultMsg}</span>
    </div>
  );
};

// --- Reorder Panel ---

interface ReorderPanelProps {
  categories: string[];
  categoryDocCounts: Record<string, number>;
  hasCustomOrder: boolean;
  onSave: (newOrder: string[]) => void;
  onReset: () => void;
  onCancel: () => void;
}

const ReorderPanel: FunctionComponent<ReorderPanelProps> = ({ categories, categoryDocCounts, hasCustomOrder, onSave, onReset, onCancel }) => {
  const [items, setItems] = useState<string[]>(categories);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeTouchIndex, setActiveTouchIndex] = useState<number | null>(null);
  const [touchDropIndex, setTouchDropIndex] = useState<number | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const touchStartIndexRef = useRef<number | null>(null);
  const touchDropIndexRef = useRef<number | null>(null);

  const moveItem = useCallback((from: number, to: number) => {
    setItems((current) => {
      if (from === to || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const resetTouchDrag = useCallback(() => {
    touchStartIndexRef.current = null;
    touchDropIndexRef.current = null;
    setActiveTouchIndex(null);
    setTouchDropIndex(null);
  }, []);

  const getTouchDropTarget = useCallback((clientY: number) => {
    if (items.length === 0) return null;
    for (let index = 0; index < items.length; index += 1) {
      const rect = itemRefs.current[index]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return items.length - 1;
  }, [items.length]);

  const handleTouchHandleStart = (index: number, event: TouchEvent) => {
    if (event.touches.length === 0) return;
    touchStartIndexRef.current = index;
    touchDropIndexRef.current = index;
    setActiveTouchIndex(index);
    setTouchDropIndex(index);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (activeTouchIndex === null) return;

    const handleWindowTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      const nextIndex = getTouchDropTarget(touch.clientY);
      if (nextIndex === null) return;
      touchDropIndexRef.current = nextIndex;
      setTouchDropIndex(nextIndex);
    };

    const finishTouchDrag = () => {
      const from = touchStartIndexRef.current;
      const to = touchDropIndexRef.current;
      if (from !== null && to !== null && from !== to) {
        moveItem(from, to);
      }
      resetTouchDrag();
    };

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', finishTouchDrag);
    window.addEventListener('touchcancel', finishTouchDrag);

    return () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', finishTouchDrag);
      window.removeEventListener('touchcancel', finishTouchDrag);
    };
  }, [activeTouchIndex, getTouchDropTarget, moveItem, resetTouchDrag]);

  const activeIndex = activeTouchIndex ?? dragIndex;
  const targetIndex = activeTouchIndex !== null ? touchDropIndex : dragOverIndex;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] animate-fade-in sm:items-center sm:bg-black/40 sm:backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="animate-sheet-up flex max-h-[calc(100dvh-0.5rem)] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:animate-modal-pop sm:mx-4 sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reorder-categories-title"
        aria-describedby="reorder-categories-description"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-4 pt-3 sm:p-5">
          <div className="min-w-0">
            <h3 id="reorder-categories-title" className="text-lg font-bold text-gray-900">Reorder Categories</h3>
            <p id="reorder-categories-description" className="mt-1 text-sm leading-5 text-gray-500">
              Drag the handle or use the arrows to control how category groups appear across the viewer.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-[0.97] touch-manipulation"
            aria-label="Close reorder categories"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTouchIndex !== null && (
          <div className="mx-4 mt-3 rounded-2xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 sm:mx-5">
            Release to place {items[activeTouchIndex]}.
          </div>
        )}

        {/* Sortable List */}
        <div className="flex-1 overflow-y-auto overscroll-contain space-y-2 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
          {items.map((cat, index) => (
            <div
              key={cat}
              ref={(element) => { itemRefs.current[index] = element; }}
              draggable
              onDragStart={() => { setDragIndex(index); }}
              onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOverIndex(index); }}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) moveItem(dragIndex, index);
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              className={`flex items-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-200 select-none ${
                activeIndex === index
                  ? 'border-purple-300 bg-purple-50 shadow-sm scale-[0.985]'
                  : targetIndex === index
                    ? 'border-sky-300 bg-sky-50/80 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {/* Drag Handle */}
              <button
                type="button"
                onTouchStart={(event) => handleTouchHandleStart(index, event)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors touch-none sm:h-10 sm:w-10 ${
                  activeTouchIndex === index
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-100'
                }`}
                aria-label={`Drag ${cat}`}
              >
                <GripVertical className="w-5 h-5" />
              </button>

              {/* Position Badge */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                {index + 1}
              </span>

              {/* Category Name */}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-800">{cat}</span>
                <span className="mt-0.5 block text-[11px] text-gray-400 sm:hidden">
                  {categoryDocCounts[cat] || 0} document{(categoryDocCounts[cat] || 0) === 1 ? '' : 's'}
                </span>
              </div>

              {/* Doc Count */}
              <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500 sm:inline-flex">
                {categoryDocCounts[cat] || 0}
              </span>

              {/* Up / Down Buttons */}
              <div className="flex shrink-0 flex-row gap-1 sm:flex-col sm:gap-1.5">
                <button
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all touch-manipulation sm:h-9 sm:w-9 ${
                    index === 0
                      ? 'cursor-default border-gray-100 text-gray-200'
                      : 'border-gray-200 text-gray-500 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600 active:scale-[0.97]'
                  }`}
                  aria-label={`Move ${cat} up`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === items.length - 1}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all touch-manipulation sm:h-9 sm:w-9 ${
                    index === items.length - 1
                      ? 'cursor-default border-gray-100 text-gray-200'
                      : 'border-gray-200 text-gray-500 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600 active:scale-[0.97]'
                  }`}
                  aria-label={`Move ${cat} down`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="border-t border-gray-100 bg-white px-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-200 active:scale-[0.99] touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(items)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 active:scale-[0.99] touch-manipulation"
            >
              <Check className="w-4 h-4" />
              Apply
            </button>
          </div>
          {hasCustomOrder && (
            <button
              onClick={onReset}
              className="mt-2 w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-[0.99] touch-manipulation"
            >
              Reset to default order
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

interface ViewerProps {
  data: ShipmentData;
  onDownloadRequest?: (event: DownloadRequestEvent) => void;
  downloadState?: DownloadState;
  downloadMessage?: string;
}

const CATEGORY_ORDER_KEY = 'shipping-doc-category-order';

const ShippingDocViewer: FunctionComponent<ViewerProps> = ({ data, onDownloadRequest, downloadState, downloadMessage }) => {
  const isDownloading = downloadState === 'preparing' || downloadState === 'downloading';
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'hierarchy' | 'format' | 'category'>('hierarchy');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedHawbs, setExpandedHawbs] = useState<Set<string>>(new Set());
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(CATEGORY_ORDER_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // --- Category Order Logic ---

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    data.masterDocuments.forEach(d => cats.add(getDocCategory(d)));
    data.hawbs.forEach(h => h.documents.forEach(d => cats.add(getDocCategory(d))));
    return Array.from(cats).sort();
  }, [data]);

  const effectiveCategoryOrder = useMemo(() => {
    if (categoryOrder.length === 0) return allCategories;
    const ordered = categoryOrder.filter(c => allCategories.includes(c));
    const remaining = allCategories.filter(c => !categoryOrder.includes(c));
    return [...ordered, ...remaining];
  }, [categoryOrder, allCategories]);

  const categoryDocCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const addCount = (doc: Document) => {
      const cat = getDocCategory(doc);
      counts[cat] = (counts[cat] || 0) + 1;
    };
    data.masterDocuments.forEach(addCount);
    data.hawbs.forEach(h => h.documents.forEach(addCount));
    return counts;
  }, [data]);

  const sortDocsByCategoryOrder = useCallback((docs: Document[]): Document[] => {
    if (categoryOrder.length === 0) return docs;
    return [...docs].sort((a, b) => {
      const catA = effectiveCategoryOrder.indexOf(getDocCategory(a));
      const catB = effectiveCategoryOrder.indexOf(getDocCategory(b));
      if (catA !== catB) return catA - catB;
      return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
    });
  }, [categoryOrder, effectiveCategoryOrder]);

  // --- Filtering Logic ---

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const matchesSearchTerm = (value?: string) => {
    if (normalizedSearchTerm === '') return true;
    return value?.toLowerCase().includes(normalizedSearchTerm) ?? false;
  };

  const filterDoc = (doc: Document) => {
    return (
      matchesSearchTerm(doc.name) ||
      matchesSearchTerm(doc.displayName) ||
      matchesSearchTerm(doc.category)
    );
  };

  const filterHawbMeta = (hawb: ShipmentData['hawbs'][number]) => {
    return (
      matchesSearchTerm(hawb.number) ||
      matchesSearchTerm(hawb.shipper) ||
      matchesSearchTerm(hawb.consignee)
    );
  };

  const filteredData = useMemo(() => {
    const filteredMaster = data.masterDocuments.filter(filterDoc);
    
    const filteredHawbs = data.hawbs.map(hawb => {
      const hawbMatchesMeta = filterHawbMeta(hawb);
      return {
        ...hawb,
        documents: hawbMatchesMeta ? hawb.documents : hawb.documents.filter(filterDoc)
      };
    }).filter(h => h.documents.length > 0 || normalizedSearchTerm === ''); // Keep HAWB if empty only if no search, else filtered out

    return {
      masterDocuments: filteredMaster,
      hawbs: filteredHawbs
    };
  }, [data, normalizedSearchTerm]);

  // Flatten for "Type View" and "Select All" calculation
  const allVisibleDocs = useMemo(() => {
    return [
      ...filteredData.masterDocuments,
      ...filteredData.hawbs.flatMap(h => h.documents)
    ];
  }, [filteredData]);

  // Grouping for "Format View" (formerly ByType)
  const docsByFormat = useMemo(() => {
    const groups: Record<string, { doc: Document, context: string }[]> = {
      'PDF Documents': [],
      'Spreadsheets': [],
      'Images': [],
      'Others': []
    };

    const addToGroup = (doc: Document, context: string) => {
      if (['pdf'].includes(doc.type)) groups['PDF Documents'].push({ doc, context });
      else if (['xls', 'xlsx', 'csv'].includes(doc.type)) groups['Spreadsheets'].push({ doc, context });
      else if (['jpg', 'png', 'jpeg'].includes(doc.type)) groups['Images'].push({ doc, context });
      else groups['Others'].push({ doc, context });
    };

    filteredData.masterDocuments.forEach(d => addToGroup(d, 'Master'));
    filteredData.hawbs.forEach(h => {
      h.documents.forEach(d => addToGroup(d, h.number));
    });

    // Sort documents within each format group by category order, then sortOrder
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (categoryOrder.length > 0) {
          const catA = effectiveCategoryOrder.indexOf(getDocCategory(a.doc));
          const catB = effectiveCategoryOrder.indexOf(getDocCategory(b.doc));
          if (catA !== catB) return catA - catB;
        }
        return (a.doc.sortOrder ?? Infinity) - (b.doc.sortOrder ?? Infinity);
      });
    }

    return groups;
  }, [filteredData, categoryOrder, effectiveCategoryOrder]);

  // Grouping for "Category View" (New)
  const docsByCategory = useMemo(() => {
    const groups: Record<string, { doc: Document, context: string }[]> = {};

    const addToGroup = (doc: Document, context: string) => {
      const category = getDocCategory(doc);
      if (!groups[category]) groups[category] = [];
      groups[category].push({ doc, context });
    };

    filteredData.masterDocuments.forEach(d => addToGroup(d, 'Master'));
    filteredData.hawbs.forEach(h => {
      h.documents.forEach(d => addToGroup(d, h.number));
    });

    // Sort categories by custom order (if set) then alphabetically; sort docs within by sortOrder
    const orderedKeys = effectiveCategoryOrder.filter(cat => groups[cat]);
    const remainingKeys = Object.keys(groups).filter(cat => !orderedKeys.includes(cat)).sort();
    return [...orderedKeys, ...remainingKeys].reduce((acc, key) => {
      acc[key] = groups[key].sort((a, b) => (a.doc.sortOrder ?? Infinity) - (b.doc.sortOrder ?? Infinity));
      return acc;
    }, {} as Record<string, { doc: Document, context: string }[]>);
  }, [filteredData, effectiveCategoryOrder]);

  // --- Handlers ---

  const toggleHawb = (hawbId: string) => {
    setExpandedHawbs(prev => {
      const next = new Set(prev);
      if (next.has(hawbId)) next.delete(hawbId);
      else next.add(hawbId);
      return next;
    });
  };

  const toggleAllHawbs = () => {
    const allIds = filteredData.hawbs.map(h => h.id);
    const allExpanded = allIds.length > 0 && allIds.every(id => expandedHawbs.has(id));
    setExpandedHawbs(allExpanded ? new Set() : new Set(allIds));
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleGroupSelection = (docIds: string[]) => {
    const allSelected = docIds.length > 0 && docIds.every(id => selectedIds.has(id));
    const newSet = new Set(selectedIds);
    if (allSelected) {
      docIds.forEach(id => newSet.delete(id));
    } else {
      docIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allVisibleDocs.length && allVisibleDocs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleDocs.map(d => d.id)));
    }
  };

  const emitDownloadEvent = (docs: Document[]) => {
    if (docs.length === 0) return;

    const types = new Set(docs.map(d => d.type));
    const allSameType = types.size === 1;
    const fileType = allSameType ? docs[0].type : null;

    const downloadEvent: DownloadRequestEvent = {
      files: docs.map(doc => ({
        id: doc.id,
        name: doc.name,
        displayName: doc.displayName,
        type: doc.type,
        url: doc.url
      })),
      allSameType,
      fileType
    };

    if (onDownloadRequest) {
      onDownloadRequest(downloadEvent);
    } else {
      const customEvent = new CustomEvent('download-request', {
        detail: downloadEvent,
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(customEvent);
    }
  };

  const handleSingleDownload = (doc: Document) => {
    if (isDownloading) return;
    emitDownloadEvent([doc]);
  };

  const handleBulkDownload = () => {
    if (isDownloading) return;
    const filesToDownload = selectedIds.size > 0 
      ? allVisibleDocs.filter(doc => selectedIds.has(doc.id))
      : allVisibleDocs;
    
    emitDownloadEvent(filesToDownload);
  };

  const handleSaveCategoryOrder = (newOrder: string[]) => {
    setCategoryOrder(newOrder);
    setShowReorderPanel(false);
    try { localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(newOrder)); } catch {}
  };

  const handleResetCategoryOrder = () => {
    setCategoryOrder([]);
    setShowReorderPanel(false);
    try { localStorage.removeItem(CATEGORY_ORDER_KEY); } catch {}
  };

  const isAllSelected = allVisibleDocs.length > 0 && selectedIds.size === allVisibleDocs.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < allVisibleDocs.length;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-8 font-sans text-slate-800">
      {/* Container - responsive padding */}
      <div className="max-w-5xl mx-auto bg-white md:rounded-2xl shadow-xl overflow-hidden border-x-0 md:border md:border-gray-100 md:my-8">
        
        {/* --- Header --- */}
        <header className="bg-white border-b border-gray-100 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Plane className="w-5 h-5 text-purple-600" />
                <span className="text-xs font-semibold tracking-wider text-purple-600 uppercase">Tracking Documents</span>
                <a 
                  href="https://avatarfresh.com/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-gray-300 hover:text-purple-600 transition-colors"
                  title="View Master AWB details in Avatar Fresh system"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{data.mawb}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(data.status)}`}>
                  {data.status}
                </span>
              </div>
              
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                 {/* Main Client/Importer Name */}
                 <div className="flex items-center gap-1.5 text-gray-700 font-medium bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 w-fit">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="truncate max-w-[200px]">{data.clientName}</span>
                 </div>
                 <div className="hidden sm:block text-gray-300">|</div>
                 <div className="flex items-center gap-4 text-xs sm:text-sm">
                    <span className="flex items-center gap-1"><Box className="w-4 h-4"/> {data.hawbs.length} HAWBs</span>
                    <span className="flex items-center gap-1">{data.origin} <ArrowRight className="w-3 h-3"/> {data.destination}</span>
                 </div>
              </div>

            </div>

            <div className="flex items-center gap-3 mt-2 md:mt-0">
              {/* Bulk Action Button */}
              <button 
                onClick={handleBulkDownload}
                disabled={isDownloading}
                className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 touch-manipulation ${
                  isDownloading
                    ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
                    : selectedIds.size > 0 
                      ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloading ? 'Preparing…' : selectedIds.size > 0 ? `Download (${selectedIds.size})` : 'Download All'}
              </button>
            </div>
          </div>
        </header>

        {/* --- Controls Sticky Bar --- */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            
            {/* Search - Text-base on mobile to prevent iOS Zoom */}
            <div className="flex w-full md:w-96 group">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 md:py-2 border border-gray-200 leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-base md:text-sm ${
                    searchTerm ? 'rounded-l-lg rounded-r-none border-r-0' : 'rounded-lg'
                  }`}
                />
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="flex items-center px-3 bg-gray-100 hover:bg-red-50 border border-l-0 border-gray-200 rounded-r-lg text-gray-400 hover:text-red-500 transition-colors touch-manipulation"
                  aria-label="Clear search"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* View Toggles - Horizontal Scroll on Mobile */}
            <div className="w-full md:w-auto flex items-center bg-gray-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  viewMode === 'hierarchy' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                Hierarchy
              </button>
              <button
                onClick={() => setViewMode('format')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  viewMode === 'format' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileCog className="w-4 h-4" />
                Formats
              </button>
              <button
                onClick={() => setViewMode('category')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  viewMode === 'category' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Tags className="w-4 h-4" />
                Categories
              </button>
              <div className="w-px h-5 bg-gray-300/50 mx-1 shrink-0"></div>
              <button
                onClick={() => setShowReorderPanel(true)}
                className={`flex-none flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap touch-manipulation ${
                  categoryOrder.length > 0 ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-200' : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'
                }`}
                title="Reorder document types"
                aria-label="Open reorder categories"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="sm:hidden">Reorder</span>
              </button>
            </div>
          </div>
          
          {/* Select All Bar (Sub-header) */}
          <div className="flex items-center mt-3 text-xs md:text-sm text-gray-500 pb-1 border-b border-dashed border-gray-200 overflow-x-auto no-scrollbar whitespace-nowrap">
             <button onClick={toggleSelectAll} className="flex items-center gap-2 hover:text-purple-600 font-medium py-1">
                {isAllSelected ? <CheckSquare className="w-4 h-4 text-purple-600"/> : isIndeterminate ? <div className="w-4 h-4 flex items-center justify-center bg-purple-600 rounded text-white text-[10px]">-</div> : <Square className="w-4 h-4"/>}
                Select All ({allVisibleDocs.length})
             </button>
             <span className="mx-2 text-gray-300">|</span>
             <span>Showing {allVisibleDocs.length} documents</span>
          </div>
        </div>

        {/* --- Content --- */}
        <div className="p-4 md:p-6 bg-gray-50/30 min-h-[400px]">
          
          {allVisibleDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search className="w-12 h-12 mb-3 text-gray-300" />
              <p>No documents found matching "{searchTerm}"</p>
            </div>
          ) : viewMode === 'hierarchy' ? (
            /* Hierarchy View */
            <div className="space-y-6 md:space-y-8 animate-fade-in">
              {/* Master Level */}
              {filteredData.masterDocuments.length > 0 && (
                <section>
                  {(() => {
                    const masterIds = filteredData.masterDocuments.map(d => d.id);
                    const allMasterSelected = masterIds.length > 0 && masterIds.every(id => selectedIds.has(id));
                    return (
                      <button
                        onClick={() => toggleGroupSelection(masterIds)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 pl-1 hover:text-purple-600 transition-colors touch-manipulation group/master"
                      >
                        {allMasterSelected
                          ? <CheckSquare className="w-4 h-4 text-purple-600" />
                          : <Square className="w-4 h-4 text-gray-300 group-hover/master:text-purple-400" />
                        }
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Master Level (MAWB)
                      </button>
                    );
                  })()}
                  <div className="grid grid-cols-1 lg:grid-cols-1 gap-2">
                    {sortDocsByCategoryOrder(filteredData.masterDocuments).map(doc => (
                      <DocRow 
                        key={doc.id} 
                        doc={doc} 
                        isSelected={selectedIds.has(doc.id)} 
                        onToggle={toggleSelection} 
                        onDownload={handleSingleDownload}
                        disabled={isDownloading}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Daughter Level */}
              <section>
                {filteredData.hawbs.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-lg p-4">
                    <Box className="w-4 h-4" />
                    No HAWBs available for this shipment.
                  </div>
                ) : (
                  <>
                  {/* Expand / Collapse All toggle */}
                  <div className="flex justify-end mb-3">
                  <button
                    onClick={toggleAllHawbs}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    {filteredData.hawbs.length > 0 && filteredData.hawbs.every(h => expandedHawbs.has(h.id))
                      ? <><ChevronDown className="w-3.5 h-3.5" /> Collapse all HAWBs</>
                      : <><ChevronRight className="w-3.5 h-3.5" /> Expand all HAWBs</>
                    }
                  </button>
                  </div>
                  {filteredData.hawbs.map(hawb => {
                   const isOpen = expandedHawbs.has(hawb.id);
                   return (
                   <div key={hawb.id} className="mb-3 last:mb-0 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      
                      {/* HAWB Header — accordion toggle + group select */}
                      {(() => {
                        const hawbDocIds = hawb.documents.map(d => d.id);
                        const allHawbSelected = hawbDocIds.length > 0 && hawbDocIds.every(id => selectedIds.has(id));
                        const someHawbSelected = hawbDocIds.some(id => selectedIds.has(id));
                        return (
                          <div className="flex items-start px-4 py-3 hover:bg-gray-50/80 transition-colors">
                            {/* Left: accordion toggle (expands full area) */}
                            <button
                              onClick={() => toggleHawb(hawb.id)}
                              className="flex-1 min-w-0 text-left touch-manipulation"
                            >
                              <div className="flex items-center gap-2">
                                {isOpen
                                  ? <ChevronDown className="w-4 h-4 text-sky-500 shrink-0 transition-transform" />
                                  : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 transition-transform" />
                                }
                                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                                <span className="text-sm font-bold text-gray-700 truncate">{hawb.number}</span>
                                <span className="text-[11px] text-gray-400 font-normal ml-1 shrink-0">
                                  {hawb.documents.length} doc{hawb.documents.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              
                              {/* Exporter -> Importer Flow */}
                              <div className="ml-7 mt-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5" title="Exporter / Shipper">
                                    <Factory className="w-3 h-3 text-gray-400" />
                                    <span className="font-medium text-gray-600">{hawb.shipper}</span>
                                </div>
                                <ArrowRight className="hidden sm:block w-3 h-3 text-gray-300" />
                                <div className="flex items-center gap-1.5" title="Importer / Consignee">
                                    <User className="w-3 h-3 text-gray-400" />
                                    <span className="font-medium text-gray-600">{hawb.consignee}</span>
                                </div>
                              </div>
                            </button>

                            {/* Right: group select checkbox */}
                            {hawbDocIds.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleGroupSelection(hawbDocIds); }}
                                className="ml-3 mt-0.5 p-1.5 rounded-md hover:bg-purple-50 text-gray-300 hover:text-purple-600 transition-colors touch-manipulation shrink-0"
                                title={allHawbSelected ? 'Deselect all' : `Select all ${hawb.documents.length}`}
                              >
                                {allHawbSelected
                                  ? <CheckSquare className="w-5 h-5 text-purple-600" />
                                  : someHawbSelected
                                    ? <div className="w-5 h-5 flex items-center justify-center bg-purple-600 rounded text-white text-[10px] font-bold">-</div>
                                    : <Square className="w-5 h-5" />
                                }
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3">
                          <div className="grid grid-cols-1 gap-2">
                           {hawb.documents.length === 0 ? (
                             <span className="text-xs text-gray-400 italic pl-2">No documents available for this HAWB.</span>
                           ) : (
                             sortDocsByCategoryOrder(hawb.documents).map(doc => (
                              <DocRow 
                                key={doc.id} 
                                doc={doc} 
                                isSelected={selectedIds.has(doc.id)} 
                                onToggle={toggleSelection} 
                                onDownload={handleSingleDownload}
                                disabled={isDownloading}
                              />
                             ))
                           )}
                          </div>
                        </div>
                      )}
                   </div>
                   );
                  })}
                  </>
                )}
              </section>
            </div>
          ) : viewMode === 'format' ? (
            /* Format View (formerly ByType) */
            <div className="space-y-6 md:space-y-8 animate-fade-in">
              {Object.entries(docsByFormat).map(([type, items]) => {
                 const docItems = items as { doc: Document, context: string }[];
                 if (docItems.length === 0) return null;
                 const groupIds = docItems.map(i => i.doc.id);
                 const allGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.has(id));
                 return (
                   <section key={type}>
                      <button
                        onClick={() => toggleGroupSelection(groupIds)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 pl-1 border-b border-gray-100 pb-2 w-full hover:text-purple-600 transition-colors touch-manipulation group/fmt"
                      >
                        {allGroupSelected
                          ? <CheckSquare className="w-4 h-4 text-purple-600" />
                          : <Square className="w-4 h-4 text-gray-300 group-hover/fmt:text-purple-400" />
                        }
                        {type} ({docItems.length})
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {docItems.map(({ doc, context }) => (
                          <DocRow 
                            key={doc.id} 
                            doc={doc} 
                            contextLabel={context}
                            isSelected={selectedIds.has(doc.id)} 
                            onToggle={toggleSelection} 
                            onDownload={handleSingleDownload}
                            disabled={isDownloading}
                          />
                        ))}
                      </div>
                   </section>
                 );
              })}
            </div>
          ) : (
             /* Category View (New) */
            <div className="space-y-6 md:space-y-8 animate-fade-in">
              {Object.entries(docsByCategory).map(([category, items]) => {
                 const docItems = items as { doc: Document, context: string }[];
                 if (docItems.length === 0) return null;
                 return (
                   <section key={category}>
                      {(() => {
                        const catIds = docItems.map(i => i.doc.id);
                        const allCatSelected = catIds.length > 0 && catIds.every(id => selectedIds.has(id));
                        return (
                          <button
                            onClick={() => toggleGroupSelection(catIds)}
                            className="flex items-center gap-2 mb-3 pl-1 border-b border-gray-100 pb-2 w-full hover:text-purple-600 transition-colors touch-manipulation group/cat"
                          >
                            {allCatSelected
                              ? <CheckSquare className="w-4 h-4 text-purple-600" />
                              : <Square className="w-4 h-4 text-gray-300 group-hover/cat:text-purple-400" />
                            }
                            <Tags className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                              {category} ({docItems.length})
                            </span>
                          </button>
                        );
                      })()}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {docItems.map(({ doc, context }) => (
                          <DocRow 
                            key={doc.id} 
                            doc={doc} 
                            contextLabel={context}
                            isSelected={selectedIds.has(doc.id)} 
                            onToggle={toggleSelection} 
                            onDownload={handleSingleDownload}
                            disabled={isDownloading}
                          />
                        ))}
                      </div>
                   </section>
                 );
              })}
            </div>
          )}
        </div>

        {/* --- Footer --- */}
        <footer className="bg-gray-50 border-t border-gray-100 px-4 md:px-6 py-4">
           <div className="flex items-center justify-center gap-2 text-xs text-gray-400 text-center">
             <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
             <p>Security Notice: This link is temporary and will expire in <span className="font-semibold text-gray-500">{data.expirationDays ?? 15} days</span>.</p>
           </div>
        </footer>
      </div>
      
      {/* --- External Footer (Branding) --- */}
      <div className="flex flex-col items-center justify-center py-8 gap-3 px-4">
          
          {/* Agency Branding */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center justify-center opacity-90 hover:opacity-100 transition-all duration-500 cursor-default">
                {data.agencyLogo ? (
                  <img 
                    src={data.agencyLogo} 
                    alt={data.agencyName || 'Agency Logo'} 
                    className="h-16 w-auto object-contain max-w-[200px]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                {/* Fallback icon — shown when no logo or image fails */}
                <div 
                  className={`items-center justify-center bg-white p-3 rounded-xl shadow-sm border border-gray-200/60 ${
                    data.agencyLogo ? 'hidden' : 'flex'
                  }`}
                >
                  <Globe className="w-6 h-6 text-indigo-600" />
                </div>
            </div>
          </div>

          {/* System Credit */}
          <div className="flex items-center gap-2 text-[10px] text-gray-400/80">
              <span>Powered by Avatar Cargo System</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>{new Date().getFullYear()}</span>
          </div>

      </div>

      {/* Reorder Panel Modal */}
      {showReorderPanel && (
        <ReorderPanel
          categories={effectiveCategoryOrder}
          categoryDocCounts={categoryDocCounts}
          hasCustomOrder={categoryOrder.length > 0}
          onSave={handleSaveCategoryOrder}
          onReset={handleResetCategoryOrder}
          onCancel={() => setShowReorderPanel(false)}
        />
      )}

      {/* Download state toast */}
      <DownloadToast state={downloadState} message={downloadMessage} />
    </div>
  );
};

export default ShippingDocViewer;