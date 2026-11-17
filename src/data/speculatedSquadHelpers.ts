import { DbPlayer } from './databaseService';
import { SquadPlayer } from './squad';

export interface SpeculatedPlayer extends SquadPlayer {
  id: string;
  name: string;
  role: string;
  photo: string;
  photoUrl?: string;
  club?: string;
  originClub?: string;
  isSpeculated?: boolean;
  rawPosition?: string;
  birthDate?: string;
  age?: string;
  nationality?: string;
  contract?: string;
  marketValue?: string;
  profileUrl?: string;
  comment?: string;
}

export interface SpeculatedSquad {
  id: string;
  name: string;
  description?: string;
  players: SpeculatedPlayer[];
  createdAt: string;
  updatedAt: string;
}

export type CustomSpeculatedPlayerInput = {
  name: string;
  role: string;
  originClub?: string;
  photoUrl?: string;
  marketValue?: string;
  contract?: string;
  nationality?: string;
  age?: string;
  comment?: string;
};

export type OfficialSquadSeedPlayer = Pick<SquadPlayer, 'name' | 'role'> &
  Partial<Omit<DbPlayer, 'name' | 'role'>> & {
    photo?: string;
    photoUrl?: string;
  };

export function sanitizeSquadId(rawId?: string): string {
  const cleaned = (rawId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || `sq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function sanitizeSpeculatedSquadName(raw: string): string {
  return (raw || '').trim().slice(0, 60) || 'Elenco Especulado';
}

export function buildBaseVascoSpeculatedPlayers(
  officialSquad: OfficialSquadSeedPlayer[]
): SpeculatedPlayer[] {
  return officialSquad.map((p, idx) => ({
    id: String(p.id || `vasco_base_${idx}_${p.name.replace(/\s+/g, '_')}`),
    name: p.name,
    role: p.role,
    photo: p.photo || p.photoUrl || '',
    photoUrl: p.photoUrl || p.photo || '',
    club: 'CR Vasco da Gama',
    originClub: 'CR Vasco da Gama',
    isSpeculated: false,
    rawPosition: p.rawPosition,
    birthDate: p.birthDate,
    age: p.age,
    nationality: p.nationality,
    contract: p.contract,
    marketValue: p.marketValue,
    profileUrl: p.profileUrl,
    comment: p.comment
  }));
}

export function createSpeculatedPlayerFromDb(player: DbPlayer): SpeculatedPlayer {
  const isVasco = player.club.toLowerCase().includes('vasco');
  return {
    id: String(player.id || `db_${player.name.replace(/\s+/g, '_')}`),
    name: player.name,
    role: player.role,
    photo: player.photoUrl,
    photoUrl: player.photoUrl,
    club: isVasco ? 'CR Vasco da Gama' : `CR Vasco da Gama (Especulado • ex-${player.club})`,
    originClub: player.club,
    isSpeculated: !isVasco,
    rawPosition: player.rawPosition,
    birthDate: player.birthDate,
    age: player.age,
    nationality: player.nationality,
    contract: player.contract,
    marketValue: player.marketValue,
    profileUrl: player.profileUrl,
    comment: isVasco
      ? player.comment
      : `Possível contratação especulada (origem: ${player.club}). ${player.comment || ''}`.trim()
  };
}

export function createCustomSpeculatedPlayer(
  input: CustomSpeculatedPlayerInput
): SpeculatedPlayer {
  const cleanName = input.name.trim().slice(0, 80);
  const cleanRole = (input.role || 'ATA').trim().slice(0, 12);
  const cleanOrigin = (input.originClub || 'Mercado da Bola').trim().slice(0, 80);
  const cleanPhoto = (input.photoUrl || '').trim().slice(0, 180000);
  const cleanMarket = (input.marketValue || '').trim().slice(0, 40);
  const cleanContract = (input.contract || '').trim().slice(0, 40);
  const cleanNat = (input.nationality || 'Brasil').trim().slice(0, 50);
  const cleanAge = (input.age || '').trim().slice(0, 10);
  const cleanComment = (input.comment || '').trim().slice(0, 500);

  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    role: cleanRole,
    photo: cleanPhoto,
    photoUrl: cleanPhoto,
    club: `CR Vasco da Gama (Especulado • ${cleanOrigin})`,
    originClub: cleanOrigin,
    isSpeculated: true,
    rawPosition: cleanRole,
    age: cleanAge,
    nationality: cleanNat,
    marketValue: cleanMarket,
    contract: cleanContract,
    comment:
      cleanComment ||
      `Possível contratação especulada para o Vasco (procedência: ${cleanOrigin}).`
  };
}

export function createSpeculatedSquad(
  name: string,
  baseOfficialSquad: OfficialSquadSeedPlayer[] = [],
  includeBaseVasco = true,
  description = ''
): SpeculatedSquad {
  const now = new Date().toISOString();
  return {
    id: sanitizeSquadId(),
    name: sanitizeSpeculatedSquadName(name),
    description: (description || '').trim().slice(0, 160),
    players: includeBaseVasco ? buildBaseVascoSpeculatedPlayers(baseOfficialSquad) : [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizePlayerKey(p: Pick<SpeculatedPlayer, 'id' | 'name'>): string {
  return (p.id || p.name || '').trim().toLowerCase();
}

export function upsertPlayerInSpeculatedSquad(
  squad: SpeculatedSquad,
  player: SpeculatedPlayer
): SpeculatedSquad {
  const targetKey = normalizePlayerKey(player);
  const targetName = player.name.trim().toLowerCase();
  const existsIdx = squad.players.findIndex(
    (p) => normalizePlayerKey(p) === targetKey || p.name.trim().toLowerCase() === targetName
  );
  const nextPlayers = [...squad.players];
  if (existsIdx >= 0) {
    nextPlayers[existsIdx] = player;
  } else {
    nextPlayers.push(player);
  }
  return {
    ...squad,
    players: nextPlayers,
    updatedAt: new Date().toISOString()
  };
}

export function removePlayerFromSpeculatedSquad(
  squad: SpeculatedSquad,
  playerIdOrName: string
): SpeculatedSquad {
  const key = playerIdOrName.trim().toLowerCase();
  return {
    ...squad,
    players: squad.players.filter(
      (p) => normalizePlayerKey(p) !== key && p.name.trim().toLowerCase() !== key
    ),
    updatedAt: new Date().toISOString()
  };
}

export function sanitizeSpeculatedSquadForStorage(squad: SpeculatedSquad): SpeculatedSquad {
  const cleanPlayers: SpeculatedPlayer[] = (squad.players || []).slice(0, 60).map((p) => {
    const cleanPhoto = String(p.photo || p.photoUrl || '').slice(0, 180000);
    const clean: SpeculatedPlayer = {
      id: String(p.id || `p_${p.name}`).slice(0, 80),
      name: String(p.name || 'Atleta').slice(0, 80),
      role: String(p.role || 'MC').slice(0, 12),
      photo: cleanPhoto,
      isSpeculated: p.isSpeculated === true
    };
    if (p.photoUrl || cleanPhoto) clean.photoUrl = cleanPhoto;
    if (p.club) clean.club = String(p.club).slice(0, 100);
    if (p.originClub) clean.originClub = String(p.originClub).slice(0, 80);
    if (p.rawPosition) clean.rawPosition = String(p.rawPosition).slice(0, 60);
    if (p.birthDate) clean.birthDate = String(p.birthDate).slice(0, 30);
    if (p.age) clean.age = String(p.age).slice(0, 10);
    if (p.nationality) clean.nationality = String(p.nationality).slice(0, 50);
    if (p.contract) clean.contract = String(p.contract).slice(0, 40);
    if (p.marketValue) clean.marketValue = String(p.marketValue).slice(0, 40);
    if (p.profileUrl) clean.profileUrl = String(p.profileUrl).slice(0, 300);
    if (p.comment) clean.comment = String(p.comment).slice(0, 500);
    return clean;
  });

  return {
    id: sanitizeSquadId(squad.id),
    name: sanitizeSpeculatedSquadName(squad.name),
    description: String(squad.description || '').slice(0, 160),
    players: cleanPlayers,
    createdAt: squad.createdAt || new Date().toISOString(),
    updatedAt: squad.updatedAt || new Date().toISOString()
  };
}
