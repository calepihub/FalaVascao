import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normName,
  getInitials,
  clampCoordinates,
  easeInOutCubic,
  interpolateFrames,
  getClubGradient,
  generateInterbaseSQL,
  catmullRom,
  interpolateMultiFrames,
  calculateDragDelta
} from './tacticsLogic';

test('normName normalizes accented letters, spaces and uppercase', () => {
  assert.equal(normName('Léo Jardim'), 'leo jardim');
  assert.equal(normName('Puma Rodríguez'), 'puma rodriguez');
  assert.equal(normName('Tchê Tchê'), 'tche tche');
  assert.equal(normName('  Andrés Gómez  '), 'andres gomez');
});

test('getInitials extracts two letters for player tokens', () => {
  assert.equal(getInitials('Léo Jardim'), 'LJ');
  assert.equal(getInitials('Lucas Piton'), 'LP');
  assert.equal(getInitials('Adson'), 'A');
  assert.equal(getInitials(''), '');
});

test('clampCoordinates keeps tokens strictly inside field boundary', () => {
  // Inside bounds
  const inside = clampCoordinates(100, 100, 800, 500, 40, 40);
  assert.equal(inside.x, 100);
  assert.equal(inside.y, 100);

  // Negative bounds
  const negative = clampCoordinates(-50, -20, 800, 500, 40, 40);
  assert.equal(negative.x, 0);
  assert.equal(negative.y, 0);

  // Exceeding bounds
  const overflow = clampCoordinates(900, 600, 800, 500, 40, 40);
  assert.equal(overflow.x, 760); // 800 - 40
  assert.equal(overflow.y, 460); // 500 - 40
});

test('easeInOutCubic starts and ends smoothly at 0 and 1', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  // smooth curve checks
  assert.ok(easeInOutCubic(0.1) < 0.1);
  assert.ok(easeInOutCubic(0.9) > 0.9);
});

test('interpolateFrames calculates smooth transition between two frames', () => {
  const frameA = {
    positions: [{ id: 'p1', x: 0.1, y: 0.2 }]
  };
  const frameB = {
    positions: [{ id: 'p1', x: 0.5, y: 0.6 }]
  };

  const mid = interpolateFrames(frameA, frameB, 0.5);
  assert.equal(mid.length, 1);
  assert.equal(mid[0].id, 'p1');
  assert.ok(Math.abs(mid[0].x - 0.3) < 0.0001);
  assert.ok(Math.abs(mid[0].y - 0.4) < 0.0001);
});

test('getClubGradient generates CSS gradient from club colors', () => {
  const single = getClubGradient(['#e32636']);
  assert.equal(single, '#e32636');

  const dual = getClubGradient(['#e32636', '#111111']);
  assert.ok(dual.includes('linear-gradient'));
  assert.ok(dual.includes('#e32636'));
  assert.ok(dual.includes('#111111'));
});

test('generateInterbaseSQL generates valid DDL and inserts for InterBase', () => {
  const sql = generateInterbaseSQL({
    squad: [{ name: "Léo Jardim", role: "GOL" }],
    plays: [{ name: "Saída Rápida", scope: "both", frames: [] }]
  });

  assert.ok(sql.includes('CREATE TABLE TB_ELENCO'));
  assert.ok(sql.includes('CREATE TABLE TB_JOGADA'));
  assert.ok(sql.includes('CREATE TABLE TB_PRANCHETA'));
  assert.ok(sql.includes('CREATE GENERATOR GEN_TB_JOGADA_ID;'));
  assert.ok(sql.includes("INSERT INTO TB_ELENCO"));
  assert.ok(sql.includes("Léo Jardim"));
  assert.ok(sql.includes("Saída Rápida"));
  assert.ok(sql.includes('COMMIT WORK;'));
});

test('catmullRom correctly interpolates between points', () => {
  // At t=0, should be p1; at t=1, should be p2
  const atZero = catmullRom(0, 10, 20, 30, 0);
  assert.equal(atZero, 10);
  const atOne = catmullRom(0, 10, 20, 30, 1);
  assert.equal(atOne, 20);
  const atHalf = catmullRom(0, 10, 20, 30, 0.5);
  assert.equal(atHalf, 15);
});

test('interpolateMultiFrames glides continuously through multiple frames without stopping', () => {
  const frames = [
    { positions: [{ id: 'p1', x: 0.1, y: 0.1 }] },
    { positions: [{ id: 'p1', x: 0.5, y: 0.5 }] },
    { positions: [{ id: 'p1', x: 0.9, y: 0.1 }] }
  ];

  const start = interpolateMultiFrames(frames, 0);
  assert.equal(start[0].id, 'p1');
  assert.ok(Math.abs(start[0].x - 0.1) < 0.0001);
  assert.ok(Math.abs(start[0].y - 0.1) < 0.0001);

  const mid = interpolateMultiFrames(frames, 0.5);
  assert.equal(mid[0].id, 'p1');
  assert.ok(Math.abs(mid[0].x - 0.5) < 0.05);

  const end = interpolateMultiFrames(frames, 1);
  assert.equal(end[0].id, 'p1');
  assert.ok(Math.abs(end[0].x - 0.9) < 0.0001);
  assert.ok(Math.abs(end[0].y - 0.1) < 0.0001);
});

test('calculateDragDelta guarantees ZERO displacement on simple clicks and micro-jitter', () => {
  const initialX = 0.5;
  const initialY = 0.5;
  const pitchW = 1000;
  const pitchH = 600;

  // Exact click (0px movement)
  const exactClick = calculateDragDelta(200, 200, 200, 200, initialX, initialY, pitchW, pitchH);
  assert.equal(exactClick.isDragging, false);
  assert.equal(exactClick.x, initialX);
  assert.equal(exactClick.y, initialY);
  assert.equal(exactClick.distance, 0);

  // Micro-jitter: 1px movement during click
  const jitter1 = calculateDragDelta(200, 200, 201, 200, initialX, initialY, pitchW, pitchH);
  assert.equal(jitter1.isDragging, false);
  assert.equal(jitter1.x, initialX);
  assert.equal(jitter1.y, initialY);

  // Micro-jitter: 3px diagonal movement during click
  const jitter3 = calculateDragDelta(200, 200, 202, 202, initialX, initialY, pitchW, pitchH);
  assert.equal(jitter3.isDragging, false);
  assert.equal(jitter3.x, initialX);
  assert.equal(jitter3.y, initialY);

  // Intentional click, hold and drag (> 5px threshold)
  const intentionalDrag = calculateDragDelta(200, 200, 250, 230, initialX, initialY, pitchW, pitchH);
  assert.equal(intentionalDrag.isDragging, true);
  // dx = 50px -> 50 / 1000 = 0.05
  // dy = 30px -> 30 / 600 = 0.05
  assert.ok(Math.abs(intentionalDrag.x - 0.55) < 0.0001);
  assert.ok(Math.abs(intentionalDrag.y - 0.55) < 0.0001);
});
