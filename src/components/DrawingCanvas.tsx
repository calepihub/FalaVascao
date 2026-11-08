import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback
} from 'react';

export type DrawingTool = 'move' | 'free' | 'arrow' | 'line' | 'zone' | 'circle' | 'polygon';

export interface DrawingCanvasRef {
  undo: () => void;
  clear: () => void;
  toDataURL: () => string;
  loadFromDataURL: (dataUrl: string) => Promise<void>;
  closePolygon: () => void;
  cancelPolygon: () => void;
  isPolygonActive: () => boolean;
}

interface DrawingCanvasProps {
  tool: DrawingTool;
  color: string;
  lineWidth: number;
  onPolygonStateChange?: (active: boolean, pointsCount: number) => void;
  onDrawingChange?: () => void;
}

interface Point {
  x: number;
  y: number;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ tool, color, lineWidth, onPolygonStateChange, onDrawingChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const historyRef = useRef<string[]>([]);
    const drawingRef = useRef(false);
    const startPointRef = useRef<Point | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const polyPointsRef = useRef<Point[]>([]);

    const saveHistory = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const data = canvas.toDataURL();
      historyRef.current.push(data);
      if (historyRef.current.length > 30) historyRef.current.shift();
    }, []);

    const capturePreviewBase = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!previewCanvasRef.current) {
        previewCanvasRef.current = document.createElement('canvas');
      }
      const preview = previewCanvasRef.current;
      preview.width = canvas.width;
      preview.height = canvas.height;
      const ctx = preview.getContext('2d');
      if (ctx) ctx.drawImage(canvas, 0, 0);
    }, []);

    const restorePreviewBase = useCallback(() => {
      const canvas = canvasRef.current;
      const preview = previewCanvasRef.current;
      if (!canvas || !preview) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(preview, 0, 0);
      ctx.restore();
    }, []);

    const renderPolygon = useCallback(
      (cursor?: Point) => {
        restorePreviewBase();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const points = polyPointsRef.current;
        if (!points.length) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '33';
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        if (cursor) {
          ctx.lineTo(cursor.x, cursor.y);
        }
        ctx.stroke();

        for (const p of points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.restore();
      },
      [color, lineWidth, restorePreviewBase]
    );

    const closePolygon = useCallback(() => {
      const points = polyPointsRef.current;
      if (points.length < 3) return;
      restorePreviewBase();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '44';
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      polyPointsRef.current = [];
      previewCanvasRef.current = null;
      onPolygonStateChange?.(false, 0);
      onDrawingChange?.();
    }, [color, lineWidth, onDrawingChange, onPolygonStateChange, restorePreviewBase]);

    const cancelPolygon = useCallback(() => {
      if (polyPointsRef.current.length) {
        restorePreviewBase();
      }
      polyPointsRef.current = [];
      previewCanvasRef.current = null;
      onPolygonStateChange?.(false, 0);
    }, [onPolygonStateChange, restorePreviewBase]);

    const drawShapePreview = useCallback(
      (current: Point) => {
        const start = startPointRef.current;
        if (!start) return;
        restorePreviewBase();

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'line' || tool === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(current.x, current.y);
          ctx.stroke();

          if (tool === 'arrow') {
            const angle = Math.atan2(current.y - start.y, current.x - start.x);
            const headLength = Math.max(14, lineWidth * 3.5);
            ctx.beginPath();
            ctx.moveTo(current.x, current.y);
            ctx.lineTo(
              current.x - headLength * Math.cos(angle - Math.PI / 6),
              current.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              current.x - headLength * Math.cos(angle + Math.PI / 6),
              current.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
        } else if (tool === 'zone') {
          ctx.fillStyle = color + '40';
          const w = current.x - start.x;
          const h = current.y - start.y;
          ctx.fillRect(start.x, start.y, w, h);
          ctx.strokeRect(start.x, start.y, w, h);
        } else if (tool === 'circle') {
          const rx = Math.abs(current.x - start.x);
          const ry = Math.abs(current.y - start.y);
          ctx.fillStyle = color + '40';
          ctx.beginPath();
          ctx.ellipse(start.x, start.y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      },
      [color, lineWidth, restorePreviewBase, tool]
    );

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const last = historyRef.current.pop();
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (last) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              onDrawingChange?.();
            };
            img.src = last;
          } else {
            onDrawingChange?.();
          }
        },
        clear: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          saveHistory();
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          polyPointsRef.current = [];
          onPolygonStateChange?.(false, 0);
          onDrawingChange?.();
        },
        toDataURL: () => {
          return canvasRef.current?.toDataURL('image/png') || '';
        },
        loadFromDataURL: (dataUrl: string) => {
          return new Promise<void>((resolve) => {
            const canvas = canvasRef.current;
            if (!canvas || !dataUrl) {
              resolve();
              return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve();
              return;
            }
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = dataUrl;
          });
        },
        closePolygon,
        cancelPolygon,
        isPolygonActive: () => polyPointsRef.current.length > 0
      }),
      [closePolygon, cancelPolygon, onDrawingChange, onPolygonStateChange, saveHistory]
    );

    // Resize handling with DPR
    const handleResize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;

      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);

      // CRITICAL: Do NOT reassign canvas.width or canvas.height if unchanged.
      // In HTML5 Canvas, assigning width/height immediately clears all drawn content!
      if (canvas.width === targetW && canvas.height === targetH) {
        return;
      }

      // Snapshot current drawings
      const temp = document.createElement('canvas');
      if (canvas.width && canvas.height) {
        temp.width = canvas.width;
        temp.height = canvas.height;
        temp.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (temp.width && temp.height) {
          ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, rect.width, rect.height);
        }
      }
    }, []);

    useEffect(() => {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === 'move') return;
      e.preventDefault();
      const p = getPos(e);

      if (tool === 'polygon') {
        if (!polyPointsRef.current.length) {
          saveHistory();
          capturePreviewBase();
        } else {
          const first = polyPointsRef.current[0];
          const dist = Math.hypot(p.x - first.x, p.y - first.y);
          if (polyPointsRef.current.length >= 3 && dist < 16) {
            closePolygon();
            return;
          }
        }
        polyPointsRef.current.push(p);
        renderPolygon();
        onPolygonStateChange?.(true, polyPointsRef.current.length);
        return;
      }

      canvasRef.current?.setPointerCapture?.(e.pointerId);
      saveHistory();
      startPointRef.current = p;
      drawingRef.current = true;
      capturePreviewBase();

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && tool === 'free') {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 0.01, p.y + 0.01);
        ctx.stroke();
        ctx.restore();
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === 'polygon' && polyPointsRef.current.length) {
        renderPolygon(getPos(e));
        return;
      }
      if (!drawingRef.current) return;
      e.preventDefault();

      const p = getPos(e);
      if (tool === 'free') {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        drawShapePreview(p);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      try {
        canvasRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {}

      const p = getPos(e);
      if (tool !== 'free') {
        drawShapePreview(p);
      }
      drawingRef.current = false;
      previewCanvasRef.current = null;
      startPointRef.current = null;
      onDrawingChange?.();
    };

    const handlePointerCancel = () => {
      if (drawingRef.current) {
        restorePreviewBase();
        drawingRef.current = false;
        previewCanvasRef.current = null;
        startPointRef.current = null;
      }
    };

    return (
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full z-20 touch-none ${
          tool === 'move' ? 'pointer-events-none cursor-default' : 'pointer-events-auto cursor-crosshair'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
