import * as XLSX from 'xlsx';

export interface DbClub {
  id: string;
  name: string;
  country: string;
  competition: string;
  season: string;
  sourceUrl: string;
  collectedAt: string;
  colors: string[];
}

export interface DbPlayer {
  id: string; // jogador_id
  name: string; // jogador
  clubId: string; // clube_id
  club: string; // clube
  number: string; // camisa
  role: string; // GOL, ZAG, LD, LE, VOL, MC, MEI, MD, ME, PD, PE, ATA, CA, SA
  rawPosition: string; // posicao (Goleiro, Zagueiro, etc.)
  birthDate: string; // data_nascimento
  age: string; // idade
  nationality: string; // nacionalidade
  contract: string; // contrato
  marketValue: string; // valor_mercado
  profileUrl: string; // perfil_url (coluna O)
  photoUrl: string; // foto_url (coluna P)
  season: string; // temporada
  competition: string; // competicao
  active: boolean; // ativo === 'SIM'
  comment: string; // Breve comentário tático atualizado
}

// Club official palette mapping for tactical board rendering and opponent jerseys
export const CLUB_COLORS: Record<string, string[]> = {
  'CR Vasco da Gama': ['#111111', '#ffffff', '#e32636'],
  'SE Palmeiras': ['#198b45', '#ffffff'],
  'CR Flamengo': ['#e32636', '#111111'],
  'Cruzeiro EC': ['#1464d2', '#ffffff'],
  'SC Corinthians': ['#111111', '#ffffff'],
  'Botafogo FR': ['#111111', '#ffffff'],
  'EC Bahia': ['#1464d2', '#e32636', '#ffffff'],
  'Fluminense FC': ['#198b45', '#9d1c2d', '#ffffff'],
  'Santos FC': ['#111111', '#ffffff'],
  'Atlético Mineiro': ['#111111', '#ffffff'],
  'Athletico Paranaense': ['#e32636', '#111111'],
  'RB Bragantino': ['#e32636', '#ffffff'],
  'São Paulo FC': ['#e32636', '#111111', '#ffffff'],
  'Grêmio FBPA': ['#19a7e0', '#111111', '#ffffff'],
  'SC Internacional': ['#e32636', '#ffffff'],
  'EC Vitória': ['#e32636', '#111111'],
  'Coritiba FC': ['#198b45', '#ffffff'],
  'Mirassol FC': ['#ffd633', '#198b45'],
  'Clube do Remo': ['#1464d2', '#ffffff'],
  'Chapecoense': ['#198b45', '#ffffff']
};

export function getClubColors(clubName: string): string[] {
  if (!clubName) return ['#334155', '#ffffff'];
  if (CLUB_COLORS[clubName]) return CLUB_COLORS[clubName];

  // Try partial match
  const lower = clubName.toLowerCase();
  for (const [key, colors] of Object.entries(CLUB_COLORS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return colors;
    }
  }
  return ['#1e293b', '#94a3b8'];
}

export function mapPositionToRole(pos?: string): string {
  if (!pos) return 'MC';
  const p = pos.toLowerCase();
  if (p.includes('goleiro')) return 'GOL';
  if (p.includes('zagueiro')) return 'ZAG';
  if (p.includes('lateral dir')) return 'LD';
  if (p.includes('lateral esq')) return 'LE';
  if (p.includes('volante')) return 'VOL';
  if (p.includes('meia central')) return 'MC';
  if (p.includes('meia ofensivo')) return 'MEI';
  if (p.includes('meia dir')) return 'MD';
  if (p.includes('meia esq')) return 'ME';
  if (p.includes('ponta-dir') || p.includes('ponta dir')) return 'PD';
  if (p.includes('ponta-esq') || p.includes('ponta esq')) return 'PE';
  if (p.includes('centroavante')) return 'CA';
  if (p.includes('seg. atacante')) return 'SA';
  if (p.includes('atacante')) return 'ATA';
  return 'MC';
}

// Generate contextual tactical analysis comment for each player
export function generatePlayerComment(p: {
  jogador: string;
  posicao: string;
  clube: string;
  idade: string;
  valor_mercado: string;
  contrato: string;
  competicao: string;
}): string {
  const role = mapPositionToRole(p.posicao);
  const idadeNum = parseInt(p.idade, 10) || 0;

  let roleAnalysis = '';
  switch (role) {
    case 'GOL':
      roleAnalysis = 'Goleiro de boa envergadura e tempo de reação refinado. Comando de área seguro e consistência em bolas aéreas.';
      break;
    case 'ZAG':
      roleAnalysis = 'Zagueiro de imposição física e tempo de combate apurado. Firme nos desarmes pelo chão e cobertura nas costas dos laterais.';
      break;
    case 'LD':
      roleAnalysis = 'Lateral dinâmico no corredor direito. Oferece amplitude no ataque com cruzamentos e recomposição rápida na fase defensiva.';
      break;
    case 'LE':
      roleAnalysis = 'Lateral equilibrado pela ala esquerda. Apoia a construção ofensiva com precisão de passe e mantém a linha de 4 compacta.';
      break;
    case 'VOL':
      roleAnalysis = 'Volante de sustentação no meio-campo. Forte na interceptação de linhas de passe e na transição rápida de bola da defesa ao ataque.';
      break;
    case 'MC':
      roleAnalysis = 'Meio-campista organizador que dita o ritmo da equipe. Visão de jogo periférica e distribuição vertical qualificada.';
      break;
    case 'MEI':
      roleAnalysis = 'Articulador criativo entre as linhas adversárias. Dribles curtos objetivos e presença perigosa nas imediações da grande área.';
      break;
    case 'PD':
    case 'PE':
      roleAnalysis = 'Ponta agudo de velocidade e drible vertical. Abre o campo para o um-contra-um e ataca espaços em diagonal para finalizar.';
      break;
    case 'CA':
      roleAnalysis = 'Centroavante de referência e faro de gol. Excelente proteção de pivô para aproximação dos meias e poder de finalização na área.';
      break;
    case 'SA':
    case 'ATA':
    default:
      roleAnalysis = 'Atacante de movimentação constante. Flutua na última linha para abrir defesas adversárias e buscar o gol com agressividade.';
      break;
  }

  let ageProfile = '';
  if (idadeNum > 0 && idadeNum <= 21) {
    ageProfile = `Com ${idadeNum} anos, é jovem talento com alta projeção de evolução técnica.`;
  } else if (idadeNum >= 30) {
    ageProfile = `Atleta experiente de ${idadeNum} anos, traz maturidade e leitura tática ao time.`;
  } else if (idadeNum > 21) {
    ageProfile = `Em plena maturidade aos ${idadeNum} anos, vivencia momento físico de pico.`;
  }

  const market = p.valor_mercado && p.valor_mercado !== '-' ? `Avaliação de mercado em ${p.valor_mercado}.` : '';
  const contract = p.contrato && p.contrato !== '-' ? `Contrato ativo até ${p.contrato}.` : '';

  return `${roleAnalysis} ${ageProfile} Integrado ao elenco do ${p.clube} na temporada 2026. ${market} ${contract}`.trim();
}

class DatabaseService {
  private clubs: DbClub[] = [];
  private playersByClub: Map<string, DbPlayer[]> = new Map();
  private allPlayers: DbPlayer[] = [];
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadData();
    return this.loadPromise;
  }

  private async loadData(): Promise<void> {
    try {
      let arrayBuffer: ArrayBuffer | null = null;

      // 1. Try to fetch /api/bd first (if server is running)
      try {
        const apiRes = await fetch('/api/bd', { cache: 'no-store' });
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json && json.clubs && json.players) {
            this.clubs = json.clubs;
            this.allPlayers = json.players;
            this.rebuildIndex();
            this.isLoaded = true;
            return;
          }
        }
      } catch {
        // Fall back to direct spreadsheet fetch (Netlify / static preview)
      }

      // 2. Fetch /bd.xlsx directly from public folder (works everywhere, including Netlify)
      const res = await fetch('/bd.xlsx', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Não foi possível carregar /bd.xlsx: status ${res.status}`);
      }
      arrayBuffer = await res.arrayBuffer();

      // 3. Parse spreadsheet using XLSX (SheetJS)
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Sheet 'Clubes'
      const wsClubes = workbook.Sheets['Clubes'];
      if (wsClubes) {
        const rawClubes: any[] = XLSX.utils.sheet_to_json(wsClubes);
        this.clubs = rawClubes.map((c) => ({
          id: String(c.clube_id || ''),
          name: String(c.clube || '').trim(),
          country: String(c.pais || 'Brasil'),
          competition: String(c.competicao || 'Brasileirao Serie A'),
          season: String(c.temporada || '2026'),
          sourceUrl: String(c.fonte_url || ''),
          collectedAt: String(c.coletado_em || ''),
          colors: getClubColors(String(c.clube || '').trim())
        }));
      }

      // Sheet 'Elencos'
      const wsElencos = workbook.Sheets['Elencos'];
      if (wsElencos) {
        const rawElencos: any[] = XLSX.utils.sheet_to_json(wsElencos);
        this.allPlayers = rawElencos.map((r, idx) => {
          const clubName = String(r.clube || '').trim();
          const playerName = String(r.jogador || '').trim();
          const rawPos = String(r.posicao || 'Meia Central');
          const role = mapPositionToRole(rawPos);
          const idade = String(r.idade || '');
          const contract = String(r.contrato || '');
          const marketVal = String(r.valor_mercado || '');
          const profileUrl = String(r.perfil_url || ''); // Coluna O
          const photoUrl = String(r.foto_url || ''); // Coluna P
          const comment = generatePlayerComment({
            jogador: playerName,
            posicao: rawPos,
            clube: clubName,
            idade,
            valor_mercado: marketVal,
            contrato: contract,
            competicao: String(r.competicao || 'Brasileirão Série A')
          });

          return {
            id: String(r.jogador_id || `p_${idx}`),
            name: playerName,
            clubId: String(r.clube_id || ''),
            club: clubName,
            number: String(r.camisa || ''),
            role,
            rawPosition: rawPos,
            birthDate: String(r.data_nascimento || ''),
            age: idade,
            nationality: String(r.nacionalidade || 'Brasil'),
            contract,
            marketValue: marketVal,
            profileUrl,
            photoUrl,
            season: String(r.temporada || '2026'),
            competition: String(r.competicao || 'Brasileirão Série A'),
            active: String(r.ativo || '').toUpperCase() === 'SIM',
            comment
          };
        });
      }

      this.rebuildIndex();
      this.isLoaded = true;
    } catch (err) {
      console.error('Erro ao processar bd.xlsx:', err);
      throw err;
    }
  }

  private rebuildIndex(): void {
    this.playersByClub.clear();
    for (const p of this.allPlayers) {
      const list = this.playersByClub.get(p.club) || [];
      list.push(p);
      this.playersByClub.set(p.club, list);
    }
  }

  public getClubs(): DbClub[] {
    return this.clubs;
  }

  public getOpponentClubs(): DbClub[] {
    return this.clubs.filter((c) => !c.name.toLowerCase().includes('vasco'));
  }

  public getVascoSquad(): DbPlayer[] {
    // Find Vasco club
    for (const [clubName, list] of this.playersByClub.entries()) {
      if (clubName.toLowerCase().includes('vasco')) {
        return list;
      }
    }
    // Fallback search in all players
    return this.allPlayers.filter((p) => p.club.toLowerCase().includes('vasco'));
  }

  public getSquadByClub(clubName: string): DbPlayer[] {
    if (!clubName) return [];
    if (this.playersByClub.has(clubName)) {
      return this.playersByClub.get(clubName)!;
    }

    // Partial search
    const lower = clubName.toLowerCase();
    for (const [key, list] of this.playersByClub.entries()) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return list;
      }
    }
    return [];
  }

  public getPlayerById(id: string): DbPlayer | undefined {
    return this.allPlayers.find((p) => p.id === id);
  }

  public getPlayerByNameAndClub(name: string, club?: string): DbPlayer | undefined {
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const target = norm(name);

    if (club) {
      const squad = this.getSquadByClub(club);
      const found = squad.find((p) => norm(p.name) === target || norm(p.name).includes(target));
      if (found) return found;
    }

    return this.allPlayers.find((p) => norm(p.name) === target || norm(p.name).includes(target));
  }
}

export const databaseService = new DatabaseService();
