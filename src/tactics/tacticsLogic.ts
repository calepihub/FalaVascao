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
 * 1D Catmull-Rom spline interpolation with 4 control points
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
 * Continuous Catmull-Rom spline interpolation across all keyframes in a play.
 * Provides C1 velocity continuity: pieces glide seamlessly through waypoints
 * with zero robotic stopping or stutter between steps.
 */
export function interpolateMultiFrames(
  frames: PlayFrame[],
  globalProgress: number
): PositionPoint[] {
  if (!frames || frames.length === 0) return [];
  if (frames.length === 1) return frames[0].positions;

  // Soft easing at global start and end only (preserves continuous motion in between)
  const clamped = Math.max(0, Math.min(1, globalProgress));
  const ease = 0.5 * (1 - Math.cos(Math.PI * clamped));

  const numSegments = frames.length - 1;
  const totalT = ease * numSegments;
  const segmentIndex = Math.min(Math.floor(totalT), numSegments - 1);
  const localT = Math.max(0, Math.min(1, totalT - segmentIndex));

  // Collect all unique token IDs across all frames
  const allIds = new Set<string>();
  frames.forEach((f) => f.positions.forEach((p) => allIds.add(p.id)));

  const result: PositionPoint[] = [];

  allIds.forEach((id) => {
    // Extract trajectory points for this piece across all frames
    const pts: { x: number; y: number }[] = [];
    for (let f = 0; f < frames.length; f++) {
      const found = frames[f].positions.find((p) => p.id === id);
      if (found) {
        pts.push({ x: found.x, y: found.y });
      } else if (pts.length > 0) {
        pts.push({ ...pts[pts.length - 1] });
      } else {
        let nextFound: { x: number; y: number } | null = null;
        for (let next = f + 1; next < frames.length; next++) {
          const nf = frames[next].positions.find((p) => p.id === id);
          if (nf) {
            nextFound = { x: nf.x, y: nf.y };
            break;
          }
        }
        pts.push(nextFound || { x: 0.5, y: 0.5 });
      }
    }

    const p1 = pts[segmentIndex];
    const p2 = pts[segmentIndex + 1];

    if (frames.length === 2) {
      result.push({
        id,
        x: p1.x + (p2.x - p1.x) * localT,
        y: p1.y + (p2.y - p1.y) * localT
      });
      return;
    }

    // Virtual boundary points for Catmull-Rom
    const p0 = segmentIndex > 0 ? pts[segmentIndex - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 =
      segmentIndex + 2 < pts.length
        ? pts[segmentIndex + 2]
        : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };

    const interpX = catmullRom(p0.x, p1.x, p2.x, p3.x, localT);
    const interpY = catmullRom(p0.y, p1.y, p2.y, p3.y, localT);

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
