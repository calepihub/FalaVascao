import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingCanvas, DrawingCanvasRef, DrawingTool } from './DrawingCanvas';
import { SoccerBall } from './SoccerBall';
import { FieldTokenData } from '../data/storage';
import { getInitials, calculateDragDelta } from '../tactics/tacticsLogic';

interface PitchProps {
  tokens: FieldTokenData[];
  onTokensChange: (tokens: FieldTokenData[], recordHistory?: boolean) => void;
  tool: DrawingTool;
  drawingColor: string;
  lineWidth: number;
  drawingCanvasRef: React.RefObject<DrawingCanvasRef | null>;
  onPolygonStateChange: (active: boolean, count: number) => void;
  onDrawingChange: () => void;
  showTrails: boolean;
  selectedTokenIds: Set<string>;
  onSelectToken: (id: string, multi: boolean) => void;
  onStatusMessage: (msg: string) => void;
  opponentClubStyle?: string;
  customBallSvg?: string;
  isAnimating?: boolean;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  initialTokenX: number;
  initialTokenY: number;
  isDragging: boolean;
  token: FieldTokenData;
  targetEl: HTMLElement;
}

export const Pitch: React.FC<PitchProps> = ({
  tokens,
  onTokensChange,
  tool,
  drawingColor,
  lineWidth,
  drawingCanvasRef,
  onPolygonStateChange,
  onDrawingChange,
  showTrails,
  selectedTokenIds,
  onSelectToken,
  onStatusMessage,
  opponentClubStyle = '#e32636',
  customBallSvg,
  isAnimating = false
}) => {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const [highlightedTokenId, setHighlightedTokenId] = useState<string | null>(null);

  // Method to highlight a token when user tries to duplicate it
  useEffect(() => {
    const handleHighlight = (e: CustomEvent<{ id: string }>) => {
      setHighlightedTokenId(e.detail.id);
      setTimeout(() => setHighlightedTokenId(null), 800);
    };
    window.addEventListener('highlight-token' as any, handleHighlight as any);
    return () => window.removeEventListener('highlight-token' as any, handleHighlight as any);
  }, []);

  const handlePointerDownToken = (
    e: React.PointerEvent<HTMLDivElement>,
    token: FieldTokenData
  ) => {
    if (isAnimating) return;
    if (token.locked) {
      onStatusMessage(`Peça bloqueada: ${token.name || token.num || 'Item'}`);
      return;
    }
    if (tool !== 'move' || e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {}

    dragStateRef.current = {
      id: token.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialTokenX: token.x,
      initialTokenY: token.y,
      isDragging: false,
      token,
      targetEl
    };
  };

  const handlePointerMoveToken = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const delta = calculateDragDelta(
      drag.startX,
      drag.startY,
      e.clientX,
      e.clientY,
      drag.initialTokenX,
      drag.initialTokenY,
      rect.width,
      rect.height,
      5 // 5px threshold to separate clicks from drags
    );

    if (!delta.isDragging) {
      // Within deadzone: STRICTLY NO DISPLACEMENT!
      return;
    }

    drag.isDragging = true;
    e.preventDefault();

    // Update tokens with recordHistory = false during drag to avoid polluting history stack
    onTokensChange(
      tokens.map((t) => (t.id === drag.id ? { ...t, x: delta.x, y: delta.y } : t)),
      false
    );
  };

  const handlePointerUpToken = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    try {
      drag.targetEl.releasePointerCapture(e.pointerId);
    } catch {}

    const token = drag.token;
    const wasDragging = drag.isDragging;
    dragStateRef.current = null;

    if (!wasDragging) {
      // PURE CLICK: Zero displacement guaranteed
      const multi = e.ctrlKey || e.metaKey || e.shiftKey;
      onSelectToken(token.id, multi);

      if (token.name) {
        onStatusMessage(`Selecionado: ${token.name} (${token.role || 'Vasco'})`);
      } else if (token.kind === 'opp') {
        onStatusMessage(`Selecionado: Adversário #${token.num}`);
      } else if (token.kind === 'ball') {
        onStatusMessage('Bola de futebol selecionada.');
      }
      return;
    }

    // REAL DRAG: finalize and commit
    e.preventDefault();
    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();

    // Check if dropped outside pitch boundary -> delete
    const isOutside =
      e.clientX < rect.left - 25 ||
      e.clientX > rect.right + 25 ||
      e.clientY < rect.top - 25 ||
      e.clientY > rect.bottom + 25;

    if (isOutside) {
      onTokensChange(tokens.filter((t) => t.id !== token.id), true);
      onStatusMessage(
        `${token.name || (token.kind === 'opp' ? 'Adversário #' + token.num : 'Bola')} removido(a) do campo.`
      );
      return;
    }

    const delta = calculateDragDelta(
      drag.startX,
      drag.startY,
      e.clientX,
      e.clientY,
      drag.initialTokenX,
      drag.initialTokenY,
      rect.width,
      rect.height,
      5
    );

    onTokensChange(
      tokens.map((t) => (t.id === token.id ? { ...t, x: delta.x, y: delta.y } : t)),
      true // Commit change to undo history and trigger auto-save
    );
  };

  const handlePointerCancelToken = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    try {
      drag.targetEl.releasePointerCapture(e.pointerId);
    } catch {}

    const wasDragging = drag.isDragging;
    const initialTokenX = drag.initialTokenX;
    const initialTokenY = drag.initialTokenY;
    const tokenId = drag.id;
    dragStateRef.current = null;

    if (wasDragging) {
      // Restore initial position
      onTokensChange(
        tokens.map((t) => (t.id === tokenId ? { ...t, x: initialTokenX, y: initialTokenY } : t)),
        false
      );
    }
  };

  const handleTokenDblClick = (token: FieldTokenData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (token.kind === 'ball') {
      onTokensChange(tokens.filter((t) => t.id !== token.id), true);
      onStatusMessage('Bola removida do campo.');
      return;
    }

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onSelectToken(token.id, true);
    } else {
      // Prompt removal on double click
      onTokensChange(tokens.filter((t) => t.id !== token.id), true);
      onStatusMessage(`${token.name || 'Adversário ' + token.num} removido.`);
    }
  };

  return (
    <div
      id="pitchwrap"
      className="pitchwrap relative w-full h-full flex-1 aspect-[1.42/1] select-none overflow-hidden rounded-lg border-2 border-[#29362d] bg-[#0b120d] shadow-2xl"
    >
      {/* Grass & Pitch Background with Fala Vascão Crest */}
      <div
        ref={pitchRef}
        id="pitch"
        className="pitch absolute inset-0 bg-[#356d48] bg-center bg-no-repeat overflow-hidden"
        style={{
          backgroundImage: "url('/assets/campo.png')",
          backgroundSize: '100% 100%'
        }}
        onPointerDown={(e) => {
          if (tool === 'move' && e.target === pitchRef.current) {
            onSelectToken('', false);
          }
        }}
      >
        {/* Movement Trails Overlay */}
        {showTrails && (
          <div className="trails-layer absolute inset-0 pointer-events-none z-10 opacity-60">
            <svg className="w-full h-full">
              {tokens.map((t) => (
                <circle
                  key={`trail-${t.id}`}
                  cx={`${t.x * 100}%`}
                  cy={`${t.y * 100}%`}
                  r="18"
                  fill="none"
                  stroke={t.kind === 'vasco' ? '#ffd633' : '#32a8ff'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              ))}
            </svg>
          </div>
        )}

        {/* Tokens Container */}
        <div id="tokens" className="absolute inset-0 pointer-events-none z-10">
          {tokens.map((token) => {
            const isSelected = selectedTokenIds.has(token.id);
            const isHighlighted = highlightedTokenId === token.id;

            if (token.kind === 'ball') {
              return (
                <div
                  key={token.id}
                  data-anim-id={token.id}
                  className={`token ball-token absolute pointer-events-auto cursor-grab active:cursor-grabbing z-30 touch-none select-none ${
                    isAnimating ? 'transition-all duration-300 ease-linear' : ''
                  } ${isHighlighted ? 'scale-110 ring-4 ring-yellow-400' : ''}`}
                  style={{
                    left: `calc(${token.x * 100}% - 16px)`,
                    top: `calc(${token.y * 100}% - 16px)`,
                    width: '32px',
                    height: '32px'
                  }}
                  onPointerDown={(e) => handlePointerDownToken(e, token)}
                  onPointerMove={handlePointerMoveToken}
                  onPointerUp={handlePointerUpToken}
                  onPointerCancel={handlePointerCancelToken}
                  onDoubleClick={(e) => handleTokenDblClick(token, e)}
                  title="Bola de Futebol (arraste ou clique duplo para remover)"
                >
                  <SoccerBall customSvgUrl={customBallSvg} size={32} />
                </div>
              );
            }

            if (token.kind === 'opp') {
              return (
                <div
                  key={token.id}
                  data-anim-id={token.id}
                  data-opponent={token.num}
                  className={`token opponent-token absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-full border-2 border-white flex items-center justify-center font-black text-white text-[11px] shadow-lg z-20 touch-none select-none ${
                    isAnimating ? 'transition-all duration-300 ease-linear' : ''
                  } ${token.locked ? 'ring-2 ring-yellow-400 opacity-90' : ''} ${
                    isSelected ? 'ring-3 ring-cyan-400 shadow-cyan-500/50' : ''
                  } ${isHighlighted ? 'ring-4 ring-yellow-300 scale-105' : ''}`}
                  style={{
                    background: opponentClubStyle,
                    left: `calc(${token.x * 100}% - 19px)`,
                    top: `calc(${token.y * 100}% - 19px)`,
                    width: '38px',
                    height: '38px',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)'
                  }}
                  onPointerDown={(e) => handlePointerDownToken(e, token)}
                  onPointerMove={handlePointerMoveToken}
                  onPointerUp={handlePointerUpToken}
                  onPointerCancel={handlePointerCancelToken}
                  onDoubleClick={(e) => handleTokenDblClick(token, e)}
                  title={`Adversário #${token.num}`}
                >
                  {token.num}
                  {token.locked && (
                    <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-500 text-black px-1 rounded-full">
                      🔒
                    </span>
                  )}
                </div>
              );
            }

            // Vasco player token
            const initials = getInitials(token.name || '');

            return (
              <div
                key={token.id}
                data-anim-id={token.id}
                data-player-name={token.name}
                className={`token absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-full border-2 border-white flex items-center justify-center font-bold text-white shadow-xl z-20 bg-[#0d100e] touch-none select-none ${
                  isAnimating ? 'transition-all duration-300 ease-linear' : ''
                } ${token.locked ? 'ring-2 ring-yellow-400' : ''} ${
                  isSelected ? 'ring-3 ring-cyan-400 shadow-cyan-500/50' : ''
                } ${isHighlighted ? 'ring-4 ring-yellow-400 scale-105' : ''}`}
                style={{
                  left: `calc(${token.x * 100}% - 20px)`,
                  top: `calc(${token.y * 100}% - 20px)`,
                  width: '40px',
                  height: '40px'
                }}
                onPointerDown={(e) => handlePointerDownToken(e, token)}
                onPointerMove={handlePointerMoveToken}
                onPointerUp={handlePointerUpToken}
                onPointerCancel={handlePointerCancelToken}
                onDoubleClick={(e) => handleTokenDblClick(token, e)}
                title={`${token.name} (${token.role})`}
              >
                {token.photo ? (
                  <img
                    src={token.photo}
                    alt={token.name}
                    className="w-full h-full object-cover object-top rounded-full pointer-events-none select-none"
                    onError={(e) => {
                      // Fallback to initials if photo fails to load
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-[13px] font-black tracking-wider">{initials}</span>
                )}

                {/* Player Name Pill */}
                <span className="player-name pointer-events-none absolute left-1/2 -bottom-4 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#101412e8] text-white border border-[#4a584f] whitespace-nowrap shadow-md max-w-[85px] truncate">
                  {token.name}
                </span>

                {token.locked && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-500 text-black px-1 rounded-full">
                    🔒
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tactical Drawing Canvas Overlay */}
        <DrawingCanvas
          ref={drawingCanvasRef}
          tool={tool}
          color={drawingColor}
          lineWidth={lineWidth}
          onPolygonStateChange={onPolygonStateChange}
          onDrawingChange={onDrawingChange}
        />
      </div>
    </div>
  );
};
