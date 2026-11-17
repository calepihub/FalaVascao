import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaseVascoSpeculatedPlayers,
  createCustomSpeculatedPlayer,
  createSpeculatedPlayerFromDb,
  createSpeculatedSquad,
  removePlayerFromSpeculatedSquad,
  sanitizeSpeculatedSquadForStorage,
  upsertPlayerInSpeculatedSquad
} from './speculatedSquadHelpers';

test('creates speculated squad optionally seeded with official Vasco roster without mutating official players', () => {
  const official = [
    { id: 'v1', name: 'Léo Jardim', role: 'GOL', club: 'CR Vasco da Gama' },
    { id: 'v2', name: 'Vegetti', role: 'CA', club: 'CR Vasco da Gama' }
  ];

  const withBase = createSpeculatedSquad('Vasco Janela 2026', official, true);
  assert.equal(withBase.name, 'Vasco Janela 2026');
  assert.equal(withBase.players.length, 2);
  assert.equal(withBase.players[0].isSpeculated, false);

  const empty = createSpeculatedSquad('Time do Zero', official, false);
  assert.equal(empty.players.length, 0);
});

test('adds signings from bd.xlsx and custom rumors, prevents duplicate names, and allows removals', () => {
  let sq = createSpeculatedSquad('Reforços 2026', [], false);

  const dbSigning = createSpeculatedPlayerFromDb({
    id: 'ext_1',
    name: 'Matheus Pereira',
    clubId: '609',
    club: 'Cruzeiro EC',
    number: '10',
    role: 'MEI',
    rawPosition: 'Meia Ofensivo',
    birthDate: '05/05/1996',
    age: '29',
    nationality: 'Brasil',
    contract: '30/06/2026',
    marketValue: '€8.5mi',
    profileUrl: 'https://transfermarkt.com',
    photoUrl: 'https://img/mp.jpg',
    season: '2026',
    competition: 'Brasileirão Série A',
    active: true,
    comment: 'Armador decisivo.'
  });

  assert.equal(dbSigning.isSpeculated, true);
  assert.equal(dbSigning.originClub, 'Cruzeiro EC');

  const customSigning = createCustomSpeculatedPlayer({
    name: 'Coutinho',
    role: 'MEI',
    originClub: 'Al-Duhail',
    marketValue: '€4.5mi',
    comment: 'Negociação avançada'
  });
  assert.equal(customSigning.isSpeculated, true);
  assert.equal(customSigning.originClub, 'Al-Duhail');

  sq = upsertPlayerInSpeculatedSquad(sq, dbSigning);
  sq = upsertPlayerInSpeculatedSquad(sq, customSigning);
  assert.equal(sq.players.length, 2);

  // Re-adding same player updates in place without duplicating
  sq = upsertPlayerInSpeculatedSquad(sq, { ...customSigning, marketValue: '€5.0mi' });
  assert.equal(sq.players.length, 2);

  sq = removePlayerFromSpeculatedSquad(sq, dbSigning.id);
  assert.equal(sq.players.length, 1);
  assert.equal(sq.players[0].name, 'Coutinho');
});

test('sanitizes speculated squad payload cleanly for Firestore persistence without undefined fields', () => {
  const custom = createCustomSpeculatedPlayer({
    name: 'Reforço Teste',
    role: 'PD'
  });
  const sq = createSpeculatedSquad('   Meu Elenco   ', [], false);
  const updated = upsertPlayerInSpeculatedSquad(sq, custom);
  const sanitized = sanitizeSpeculatedSquadForStorage(updated);

  assert.equal(sanitized.name, 'Meu Elenco');
  assert.equal(sanitized.players.length, 1);
  assert.equal(JSON.stringify(sanitized).includes('undefined'), false);
  const baseCheck = buildBaseVascoSpeculatedPlayers([{ name: 'Piton', role: 'LE' }]);
  assert.equal(baseCheck[0].isSpeculated, false);
});
