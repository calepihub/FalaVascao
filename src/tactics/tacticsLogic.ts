/**
 * Pure tactical calculation logic, geometric math, and InterBase SQL generator
 */

export interface PositionPoint {
  id: string;
  x: number; // 0 to 1 relative
  y: number; // 0 to 1 relative
}

export interface PlayFrame {
  positions: PositionPoint[];
}

export interface TacticalPlay {
  id?: number | string | null;
  name: string;
  scope: 'both' | 'vasco' | 'opponent';
  speed?: number;
  frames: PlayFrame[];
  updated?: string;
  isDemo?: boolean;
}

export interface Player {
  name: string;
  role: string;
  photo?: string;
}

export interface BoardMeta {
  title: string;
  competition: string;
  date: string;
  notes: string;
}

/**
 * Normalizes string for key lookups (lowercase, no diacritics, alphanumeric)
 */
export function normName(v: string): string {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Extracts up to 2 uppercase initials for avatar fallback
 */
export function getInitials(v: string): string {
  return String(v || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0] || '')
    .join('')
    .toUpperCase();
}

/**
 * Clamps coordinates within field boundaries
 */
export function clampCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  tokenWidth = 44,
  tokenHeight = 44
): { x: number; y: number } {
  const safeW = Math.max(10, width);
  const safeH = Math.max(10, height);
  const clampedX = Math.max(0, Math.min(safeW - tokenWidth, x));
  const clampedY = Math.max(0, Math.min(safeH - tokenHeight, y));
  return { x: clampedX, y: clampedY };
}

/**
 * Calculates cubic easing for smooth player animations
 */
export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * 1D Catmull-Rom spline interpolation with 4 control points (retained for backward compatibility)
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

/**
 * 1D Monotone Cubic Hermite interpolation (Fritsch-Carlson algorithm)
 * - Strict waypoint fidelity: at t=0 returns values[segmentIndex], at t=1 returns values[segmentIndex+1]
 * - Guaranteed bounds: NO OVERSHOOT (value stays strictly within [min(p1, p2), max(p1, p2)])
 * - Rock-solid stationary stability: if p1 === p2, stays exactly at p1 for all t with zero drift
 * - C1 velocity continuity: glides smoothly across consecutive moving steps without robotic halts
 */
export function hermiteMonotone1D(
  values: number[],
  segmentIndex: number,
  t: number
): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];

  const p1 = values[segmentIndex];
  const p2 = values[segmentIndex + 1];

  // If piece did not move in this segment, lock coordinate completely (zero drift)
  if (p1 === p2) return p1;

  // Clamped local t [0, 1]
  const localT = Math.max(0, Math.min(1, t));

  // If only 2 points total, use standard smoothstep (cubic Hermite with 0 end velocities)
  if (n === 2) {
    const s = localT * localT * (3 - 2 * localT);
    return p1 + (p2 - p1) * s;
  }

  // Calculate tangents (velocities) at p1 and p2 using Fritsch-Carlson harmonic mean
  const dCur = p2 - p1;

  // Tangent at p1
  let v1 = 0;
  if (segmentIndex > 0) {
    const dPrev = p1 - values[segmentIndex - 1];
    if (dPrev * dCur > 0) {
      v1 = (2 * dPrev * dCur) / (dPrev + dCur);
    }
  }

  // Tangent at p2
  let v2 = 0;
  if (segmentIndex + 1 < n - 1) {
    const dNext = values[segmentIndex + 2] - p2;
    if (dCur * dNext > 0) {
      v2 = (2 * dCur * dNext) / (dCur + dNext);
    }
  }

  // Cubic Hermite basis functions
  const t2 = localT * localT;
  const t3 = localT * t2;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + localT;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const result = h00 * p1 + h10 * v1 + h01 * p2 + h11 * v2;

  // Strict bounding to eliminate numerical floating-point inaccuracies
  const minVal = Math.min(p1, p2);
  const maxVal = Math.max(p1, p2);
  return Math.max(minVal, Math.min(maxVal, result));
}

/**
 * Continuous Monotone Spline interpolation across all keyframes in a play.
 * 1. 100% faithful to recorded waypoints: each frame k is reached at the exact scheduled moment.
 * 2. Zero parasitic drift: stationary players stay rock-solid in place.
 * 3. Zero overshoot: trajectories strictly respect tactical lines and bounds.
 * 4. Fluid momentum: moving players glide continuously between steps.
 */
export function interpolateMultiFrames(
  frames: PlayFrame[],
  globalProgress: number
): PositionPoint[] {
  if (!frames || frames.length === 0) return [];
  if (frames.length === 1) return frames[0].positions;

  const numSegments = frames.length - 1;
  const clampedProgress = Math.max(0, Math.min(1, globalProgress));

  // Linear scaling across segments: frame k is hit exactly at progress = k / numSegments
  const scaled = clampedProgress * numSegments;
  const segmentIndex = Math.min(Math.floor(scaled), numSegments - 1);
  const localT = Math.max(0, Math.min(1, scaled - segmentIndex));

  // Collect all unique token IDs across all frames
  const allIds = new Set<string>();
  frames.forEach((f) => f.positions.forEach((p) => allIds.add(p.id)));

  const result: PositionPoint[] = [];

  allIds.forEach((id) => {
    // Extract trajectory points for this piece across all frames
    const xVals: number[] = [];
    const yVals: number[] = [];

    // Find first known position as fallback if piece was added midway
    let fallbackPos: { x: number; y: number } | null = null;
    for (const f of frames) {
      const p = f.positions.find((pos) => pos.id === id);
      if (p) {
        fallbackPos = { x: p.x, y: p.y };
        break;
      }
    }

    let lastKnownPos = fallbackPos || { x: 0.5, y: 0.5 };

    for (let f = 0; f < frames.length; f++) {
      const found = frames[f].positions.find((p) => p.id === id);
      if (found) {
        lastKnownPos = { x: found.x, y: found.y };
      }
      xVals.push(lastKnownPos.x);
      yVals.push(lastKnownPos.y);
    }

    const interpX = hermiteMonotone1D(xVals, segmentIndex, localT);
    const interpY = hermiteMonotone1D(yVals, segmentIndex, localT);

    result.push({
      id,
      x: Math.max(0, Math.min(1, interpX)),
      y: Math.max(0, Math.min(1, interpY))
    });
  });

  return result;
}

/**
 * Interpolates between two coordinate frames
 */
export function interpolateFrames(
  frameA: PlayFrame,
  frameB: PlayFrame,
  progress: number
): PositionPoint[] {
  const ease = easeInOutCubic(progress);
  const mapA = new Map<string, PositionPoint>(frameA.positions.map((p) => [p.id, p]));

  return frameB.positions.map((pB) => {
    const pA = mapA.get(pB.id) || pB;
    const interpolatedX = pA.x + (pB.x - pA.x) * ease;
    const interpolatedY = pA.y + (pB.y - pA.y) * ease;
    return {
      id: pB.id,
      x: interpolatedX,
      y: interpolatedY
    };
  });
}

/**
 * Generates standard CSS gradient for an opponent club
 */
export function getClubGradient(colors: string[]): string {
  if (!colors || colors.length === 0) return '#39433d';
  if (colors.length === 1) return colors[0];
  const parts: string[] = [];
  const n = colors.length;
  colors.forEach((c, i) => {
    parts.push(`${c} ${(i * 100) / n}%`, `${c} ${((i + 1) * 100) / n}%`);
  });
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/**
 * Generates InterBase / Firebird compatible SQL DDL & DML script
 */
export function generateInterbaseSQL(options: {
  plays?: TacticalPlay[];
  boards?: Array<{ meta: BoardMeta; state: any; savedAt: string }>;
  squad?: Player[];
}): string {
  const lines: string[] = [
    '/* ========================================================= */',
    '/* BANCO DE DADOS INTERBASE / FIREBIRD - PRANCHETA VASCAÍNA */',
    `/* Gerado em: ${new Date().toISOString()} */`,
    '/* ========================================================= */',
    '',
    '/* 1. CRIAÇÃO DE GENERATORS (SEQUENCES) */',
    'CREATE GENERATOR GEN_TB_JOGADA_ID;',
    'CREATE GENERATOR GEN_TB_PRANCHETA_ID;',
    'SET GENERATOR GEN_TB_JOGADA_ID TO 100;',
    'SET GENERATOR GEN_TB_PRANCHETA_ID TO 100;',
    '',
    '/* 2. TABELA DE ELENCO */',
    'CREATE TABLE TB_ELENCO (',
    '    ID INTEGER NOT NULL PRIMARY KEY,',
    '    NOME VARCHAR(100) NOT NULL,',
    '    POSICAO VARCHAR(10) NOT NULL,',
    '    FOTO_URL VARCHAR(500)',
    ');',
    '',
    '/* 3. TABELA DE JOGADAS ANIMADAS */',
    'CREATE TABLE TB_JOGADA (',
    '    ID INTEGER NOT NULL PRIMARY KEY,',
    '    NOME VARCHAR(150) NOT NULL,',
    '    ESCOPO VARCHAR(20) DEFAULT \'both\',',
    '    VELOCIDADE INTEGER DEFAULT 1200,',
    '    ETAPAS_COUNT INTEGER DEFAULT 0,',
    '    FRAMES_BLOB BLOB SUB_TYPE TEXT,',
    '    ATUALIZADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ');',
    '',
    '/* 4. TABELA DE PRANCHETAS TÁTICAS */',
    'CREATE TABLE TB_PRANCHETA (',
    '    ID INTEGER NOT NULL PRIMARY KEY,',
    '    TITULO VARCHAR(150) NOT NULL,',
    '    COMPETICAO VARCHAR(100),',
    '    DATA_PARTIDA DATE,',
    '    OBSERVACOES BLOB SUB_TYPE TEXT,',
    '    ESTADO_JSON BLOB SUB_TYPE TEXT,',
    '    CRIADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ');',
    '',
    '/* 5. TABELA DE ÚLTIMA ESCALAÇÃO */',
    'CREATE TABLE TB_ESCALACAO_ATUAL (',
    '    ID INTEGER NOT NULL PRIMARY KEY,',
    '    CLUBE_ADVERSARIO VARCHAR(80),',
    '    SALVO_EM TIMESTAMP,',
    '    SNAPSHOT_JSON BLOB SUB_TYPE TEXT',
    ');',
    ''
  ];

  if (options.squad && options.squad.length > 0) {
    lines.push('/* DADOS DO ELENCO VASCO DA GAMA */');
    options.squad.forEach((p, idx) => {
      const safeName = p.name.replace(/'/g, "''");
      const safeRole = p.role.replace(/'/g, "''");
      const safePhoto = (p.photo || '').replace(/'/g, "''");
      lines.push(
        `INSERT INTO TB_ELENCO (ID, NOME, POSICAO, FOTO_URL) VALUES (${idx + 1}, '${safeName}', '${safeRole}', '${safePhoto}');`
      );
    });
    lines.push('');
  }

  if (options.plays && options.plays.length > 0) {
    lines.push('/* JOGADAS CADASTRADAS */');
    options.plays.forEach((play, idx) => {
      const safeName = play.name.replace(/'/g, "''");
      const framesJson = JSON.stringify(play.frames).replace(/'/g, "''");
      lines.push(
        `INSERT INTO TB_JOGADA (ID, NOME, ESCOPO, VELOCIDADE, ETAPAS_COUNT, FRAMES_BLOB) VALUES (${idx + 1}, '${safeName}', '${play.scope}', ${play.speed || 1200}, ${play.frames.length}, '${framesJson}');`
      );
    });
    lines.push('');
  }

  lines.push('COMMIT WORK;');
  return lines.join('\n');
}

export interface DragDeltaResult {
  isDragging: boolean;
  x: number;
  y: number;
  distance: number;
}

/**
 * Calculates pointer drag displacement with strict deadzone threshold
 * Prevents micro-movements, eccentricity, and accidental displacement on simple clicks
 */
export function calculateDragDelta(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  initialTokenX: number,
  initialTokenY: number,
  pitchWidth: number,
  pitchHeight: number,
  threshold = 5
): DragDeltaResult {
  const dx = currentX - startX;
  const dy = currentY - startY;
  const distance = Math.hypot(dx, dy);

  if (distance < threshold) {
    return {
      isDragging: false,
      x: initialTokenX,
      y: initialTokenY,
      distance
    };
  }

  const safeW = Math.max(1, pitchWidth);
  const safeH = Math.max(1, pitchHeight);

  const deltaNormX = dx / safeW;
  const deltaNormY = dy / safeH;

  const x = Math.max(0.015, Math.min(0.985, initialTokenX + deltaNormX));
  const y = Math.max(0.02, Math.min(0.98, initialTokenY + deltaNormY));

  return {
    isDragging: true,
    x,
    y,
    distance
  };
}
