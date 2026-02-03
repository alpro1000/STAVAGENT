/**
 * Resizable Modal Component
 * Модальное окно с возможностью изменения размера
 */

import { type ReactNode, useEffect, useState, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ResizableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export function ResizableModal({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = 1000,
  defaultHeight = 700,
  minWidth = 600,
  minHeight = 400,
}: ResizableModalProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragEdge = useRef<'right' | 'bottom' | 'corner' | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Resize handlers
  const handleResizeStart = (
    e: React.MouseEvent,
    edge: 'right' | 'bottom' | 'corner'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    isDragging.current = true;
    dragEdge.current = edge;
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = edge === 'right' ? 'ew-resize' : edge === 'bottom' ? 'ns-resize' : 'nwse-resize';
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isDragging.current || !dragEdge.current) return;

    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;

    if (dragEdge.current === 'right' || dragEdge.current === 'corner') {
      const newWidth = Math.max(minWidth, startPos.current.width + deltaX);
      setWidth(newWidth);
    }

    if (dragEdge.current === 'bottom' || dragEdge.current === 'corner') {
      const newHeight = Math.max(minHeight, startPos.current.height + deltaY);
      setHeight(newHeight);
    }
  };

  const handleResizeEnd = () => {
    isDragging.current = false;
    dragEdge.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  if (!isOpen) return null;

  const modalStyle = isMaximized
    ? { width: '95vw', height: '95vh' }
    : { width: `${width}px`, height: `${height}px` };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-bg-secondary border-2 border-border-accent rounded-lg shadow-2xl flex flex-col"
        style={modalStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-border-color flex-shrink-0">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <div className="flex items-center gap-2">
            {/* Maximize/Minimize button */}
            <button
              onClick={toggleMaximize}
              className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
              title={isMaximized ? 'Obnovit velikost' : 'Maximalizovat'}
            >
              {isMaximized ? (
                <Minimize2 size={18} className="text-text-secondary" />
              ) : (
                <Maximize2 size={18} className="text-text-secondary" />
              )}
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors"
              title="Zavřít"
            >
              <X size={18} className="text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto scrollbar-thin flex-1">
          {children}
        </div>

        {/* Resize handles (only when not maximized) */}
        {!isMaximized && (
          <>
            {/* Right edge resize handle */}
            <div
              className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent-orange/30 transition-colors"
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            />

            {/* Bottom edge resize handle */}
            <div
              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize hover:bg-accent-orange/30 transition-colors"
              onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            />

            {/* Corner resize handle */}
            <div
              className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize hover:bg-accent-orange transition-colors rounded-tl"
              onMouseDown={(e) => handleResizeStart(e, 'corner')}
              style={{
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
              }}
            />
          </>
        )}

        {/* Size indicator (bottom right corner) */}
        {!isMaximized && (
          <div className="absolute bottom-1 right-5 text-xs text-text-muted font-mono pointer-events-none">
            {Math.round(width)} × {Math.round(height)}
          </div>
        )}
      </div>
    </div>
  );
}
