import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import {
  mapPositionToRole,
  generatePlayerComment,
  getClubColors,
  CLUB_COLORS
} from './databaseService';

describe('databaseService & bd.xlsx integrity tests', () => {
  it('reads public/bd.xlsx spreadsheet without errors', () => {
    assert.strictEqual(fs.existsSync('public/bd.xlsx'), true, 'public/bd.xlsx exists');
    const buf = fs.readFileSync('public/bd.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Clubes'), 'Contains Clubes sheet');
    assert.ok(wb.SheetNames.includes('Elencos'), 'Contains Elencos sheet');
    assert.ok(wb.SheetNames.includes('Jogadores'), 'Contains Jogadores sheet');
  });

  it('contains all 20 clubs in Clubes sheet', () => {
    const buf = fs.readFileSync('public/bd.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const clubs: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Clubes']);
    assert.strictEqual(clubs.length, 20, 'Has 20 clubs');

    const clubNames = clubs.map((c) => c.clube);
    assert.ok(clubNames.includes('CR Vasco da Gama'), 'Vasco is present');
    assert.ok(clubNames.includes('SE Palmeiras'), 'Palmeiras is present');
    assert.ok(clubNames.includes('CR Flamengo'), 'Flamengo is present');
    assert.ok(clubNames.includes('Botafogo FR'), 'Botafogo is present');
  });

  it('contains 37 Vasco players in Elencos sheet with valid photos and Transfermarkt profile links', () => {
    const buf = fs.readFileSync('public/bd.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const elencos: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Elencos']);

    const vascoPlayers = elencos.filter((r) => r.clube && r.clube.includes('Vasco'));
    assert.strictEqual(vascoPlayers.length, 37, 'Vasco has 37 players in database');

    const leoJardim = vascoPlayers.find((p) => p.jogador === 'Léo Jardim');
    assert.ok(leoJardim, 'Léo Jardim found');
    assert.ok(leoJardim.foto_url && leoJardim.foto_url.includes('transfermarkt'), 'Photo URL from Transfermarkt (coluna P)');
    assert.ok(leoJardim.perfil_url && leoJardim.perfil_url.includes('transfermarkt'), 'Profile URL from Transfermarkt (coluna O)');
  });

  it('maps positions correctly to tactical roles', () => {
    assert.strictEqual(mapPositionToRole('Goleiro'), 'GOL');
    assert.strictEqual(mapPositionToRole('Zagueiro'), 'ZAG');
    assert.strictEqual(mapPositionToRole('Lateral Dir.'), 'LD');
    assert.strictEqual(mapPositionToRole('Lateral Esq.'), 'LE');
    assert.strictEqual(mapPositionToRole('Volante'), 'VOL');
    assert.strictEqual(mapPositionToRole('Meia Central'), 'MC');
    assert.strictEqual(mapPositionToRole('Meia Ofensivo'), 'MEI');
    assert.strictEqual(mapPositionToRole('Ponta-Direita'), 'PD');
    assert.strictEqual(mapPositionToRole('Ponta-Esquerda'), 'PE');
    assert.strictEqual(mapPositionToRole('Centroavante'), 'CA');
  });

  it('generates rich, contextual scouting and tactical comments in Portuguese', () => {
    const comment = generatePlayerComment({
      jogador: 'Léo Jardim',
      posicao: 'Goleiro',
      clube: 'CR Vasco da Gama',
      idade: '31',
      valor_mercado: '€7.00mi',
      contrato: '31/12/2030',
      competicao: 'Brasileirão Série A'
    });

    assert.ok(comment.includes('Goleiro'), 'Mentions role analysis');
    assert.ok(comment.includes('31 anos'), 'Mentions age profile');
    assert.ok(comment.includes('CR Vasco da Gama'), 'Mentions club');
    assert.ok(comment.includes('€7.00mi'), 'Mentions market value');
    assert.ok(comment.includes('31/12/2030'), 'Mentions contract');
  });

  it('returns valid club colors for any team', () => {
    const vascoColors = getClubColors('CR Vasco da Gama');
    assert.ok(vascoColors.length >= 2, 'Vasco colors valid');

    const palmeirasColors = getClubColors('SE Palmeiras');
    assert.strictEqual(palmeirasColors[0], '#198b45', 'Palmeiras green');

    const flamengoColors = getClubColors('CR Flamengo');
    assert.strictEqual(flamengoColors[0], '#e32636', 'Flamengo red');
  });
});
