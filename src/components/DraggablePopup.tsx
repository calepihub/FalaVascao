import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DraggablePopupProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: string;
  badgeColor?: string;
  width?: string;
  defaultPosition?: { x: number; y: number };
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const DraggablePopup: React.FC<DraggablePopupProps> = ({
  id,
  isOpen,
  onClose,
  title,
  subtitle,
  icon = '🎬',
  badge,
  badgeColor = 'bg-red-600',
  width = 'w-[min(660px,94vw)]',
  defaultPosition,
  children,
  headerActions
}) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize position once rendered
  useEffect(() => {
    if (!isOpen) return;

    if (defaultPosition) {
      setPosition(defaultPosition);
      return;
    }

    // Default: centered horizontally, docked near bottom of field
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const popW = Math.min(660, winW * 0.94);
    const popH = isMinimized ? 50 : 380;

    const initialX = Math.max(10, (winW - popW) / 2);
    const initialY = Math.max(50, winH - popH - 50);

    setPosition({ x: initialX, y: initialY });
  }, [isOpen, defaultPosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag from the header bar, not interactive buttons/inputs inside header
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const currentX = position?.x ?? 50;
    const currentY = position?.y ?? 100;
    const startX = e.clientX;
    const startY = e.clientY;

    setIsDragging(true);

    const handleWindowMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaY = moveEv.clientY - startY;

      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const elemW = containerRef.current?.offsetWidth || 300;
      const elemH = containerRef.current?.offsetHeight || 100;

      const newX = Math.max(5, Math.min(winW - elemW - 5, currentX + deltaX));
      const newY = Math.max(5, Math.min(winH - elemH - 5, currentY + deltaY));

      setPosition({ x: newX, y: newY });
    };

    const handleWindowUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: position ? `${position.x}px` : '50%',
        top: position ? `${position.y}px` : 'auto',
        bottom: position ? 'auto' : '20px',
        transform: position ? 'none' : 'translateX(-50%)',
        zIndex: 65
      }}
      className={`${width} bg-[#0e1611fa] border border-[#3b5443] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-md select-none flex flex-col overflow-hidden transition-shadow ${
        isDragging ? 'ring-2 ring-emerald-400/60 shadow-[0_25px_70px_rgba(0,0,0,1)]' : ''
      }`}
    >
      {/* Draggable Header Bar */}
      <div
        onPointerDown={handlePointerDown}
        style={{ touchAction: 'none' }}
        className={`px-3 py-2 bg-[#121e16] border-b border-[#293d30] flex items-center justify-between cursor-grab active:cursor-grabbing ${
          isDragging ? 'cursor-grabbing bg-[#16271c]' : ''
        }`}
        title="Clique e arraste para mover este painel para qualquer lugar da tela"
      >
        {/* Left: Drag Handle Icon & Title */}
        <div className="flex items-center gap-2">
          <span className="text-[#647c6d] text-xs font-mono tracking-tighter" title="Alça de movimento">
            ⠿
          </span>
          <span className="text-sm">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-white uppercase tracking-wider leading-none">
                {title}
              </h3>
              {badge && (
                <span
                  className={`text-[8.5px] px-1.5 py-0.2 rounded font-black text-white ${badgeColor} uppercase tracking-wider`}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[8px] text-[#8ea394] leading-tight mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Right: Actions, Minimize & Close */}
        <div className="flex items-center gap-1.5">
          {headerActions}

          {/* Quick reposition button to center/bottom */}
          <button
            type="button"
            onClick={() => {
              const winW = window.innerWidth;
              const winH = window.innerHeight;
              const popW = Math.min(660, winW * 0.94);
              setPosition({ x: Math.max(10, (winW - popW) / 2), y: Math.max(50, winH - 420) });
            }}
            title="Redefinir para o centro inferior"
            className="w-6 h-6 rounded bg-[#18261d] hover:bg-[#253c2e] border border-[#2d4736] text-[#86a692] hover:text-white flex items-center justify-center text-[10px] cursor-pointer"
          >
            ⚓
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expandir painel' : 'Minimizar painel'}
            className="w-6 h-6 rounded bg-[#18261d] hover:bg-[#253c2e] border border-[#2d4736] text-[#86a692] hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
          >
            {isMinimized ? '⌃' : '⌄'}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            title="Fechar painel"
            className="w-6 h-6 rounded bg-[#2b171a] hover:bg-[#451f24] border border-[#632931] text-[#ff8e99] hover:text-white flex items-center justify-center text-xs font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body Content */}
      {!isMinimized && (
        <div className="p-3 max-h-[75vh] overflow-y-auto scrollbar-thin space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};
