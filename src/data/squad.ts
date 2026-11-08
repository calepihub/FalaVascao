export interface SquadPlayer {
  name: string;
  role: string;
  photo: string;
}

export const INITIAL_SQUAD: SquadPlayer[] = [
  {"name":"Léo Jardim","role":"GOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/leonardo-cesar-jardim-290926111836-squad-member-185.png"},
  {"name":"Daniel Fuzato","role":"GOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/daniel-cerantola-fuzato-290926111903-squad-member-186.png"},
  {"name":"Pablo","role":"GOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/pablo-de-paula-cardoso-290926112124-squad-member-188.png"},
  {"name":"Puma Rodríguez","role":"LD","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/jose-luis-rodriguez-bebanz-290926112209-squad-member-189.png"},
  {"name":"Paulo Henrique","role":"LD","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/paulo-henrique-de-oliveira-alves-290926112237-squad-member-191.png"},
  {"name":"João Vitor","role":"LD","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/joao-vitor-fonseca-da-silva-290926112536-squad-member-717.png"},
  {"name":"Gabriel","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/gabriel-pereira-magalhaes-dos-santos-061026144356-squad-member-753.png"},
  {"name":"Saldivia","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/alan-gabriel-saldivia-vazquez-290926112800-squad-member-192.png"},
  {"name":"Robert Renan","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/robert-renan-alves-barbosa-290926112843-squad-member-193.png"},
  {"name":"Carlos Cuesta","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/carlos-eccehomo-cuesta-figueroa-290926112919-squad-member-195.png"},
  {"name":"Lucas Freitas","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/lucas-de-freitas-molarinho-chagas-290926112955-squad-member-196.png"},
  {"name":"Walace Fernandes","role":"ZAG","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/walace-fernandes-alves-falcao-290926113026-squad-member-459.png"},
  {"name":"Lucas Piton","role":"LE","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/lucas-piton-crivellaro-290926113047-squad-member-197.png"},
  {"name":"Cuiabano","role":"LE","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/luis-eduardo-soares-da-silva-290926113156-squad-member-345.png"},
  {"name":"Paulinho","role":"LE","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/paulo-ricardo-alves-ibelli-290926113220-squad-member-576.png"},
  {"name":"Tchê Tchê","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/danilo-das-neves-pinheiro-290926113258-squad-member-199.png"},
  {"name":"Jair","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/jair-rodrigues-junior-290926113406-squad-member-200.png"},
  {"name":"Thiago Mendes","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/thiago-henrique-mendes-ribeiro-290926113434-squad-member-201.png"},
  {"name":"Mateus Carvalho","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/mateus-carvalho-dos-santos-290926113709-squad-member-203.png"},
  {"name":"Cauan Barros","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/cauan-lucas-barros-da-luz-290926113741-squad-member-204.png"},
  {"name":"Ramon Rique","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/ramon-rique-santos-de-souza-290926113853-squad-member-521.png"},
  {"name":"Sosa","role":"VOL","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/santiago-leonel-sosa-290926113949-squad-member-682.png"},
  {"name":"Rojas","role":"MEI","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/johan-rojas-echavarria-290926114028-squad-member-208.png"},
  {"name":"Lescano","role":"MEI","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/alan-hernan-lescano-290926115818-squad-member-713.png"},
  {"name":"David","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/david-correa-da-fonseca-290926115840-squad-member-210.png"},
  {"name":"Andrés Gómez","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/carlos-andres-gomez-hinestroza-290926115857-squad-member-212.png"},
  {"name":"Nuno Moreira","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/nuno-goncalo-rocha-moreira-290926120135-squad-member-214.png"},
  {"name":"Adson","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/adson-ferreira-soares-290926120200-squad-member-216.png"},
  {"name":"Marino","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/marino-hinestroza-angulo-290926120219-squad-member-284.png"},
  {"name":"Brenner","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/brenner-souza-da-silva-290926120234-squad-member-285.png"},
  {"name":"Claudio Spinelli","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/claudio-paul-spinelli-290926120250-squad-member-344.png"},
  {"name":"Colidio","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/facundo-colidio-290926120307-squad-member-683.png"},
  {"name":"Bruno Duarte","role":"ATA","photo":"https://cdn.fanbase.com.br/fancontent/297/squads/bruno-duarte-da-silva-290926120501-squad-member-690.png"}
];

export const POSITION_GROUPS: [string, string[]][] = [
  ['GOLEIROS', ['GOL']],
  ['ZAGUEIROS', ['ZAG', 'ZAG D', 'ZAG E']],
  ['LATERAIS / ALAS', ['LD', 'LE', 'ALA D', 'ALA E']],
  ['VOLANTES', ['VOL']],
  ['MEIAS / PONTAS', ['MC', 'MEI', 'MD', 'ME', 'PD', 'PE']],
  ['ATACANTES', ['ATA']]
];

export const OPPONENT_CLUBS: Record<string, string[]> = {
  'Athletico Paranaense': ['#e32636', '#111111'],
  'Atlético Mineiro': ['#111111', '#ffffff'],
  'Bahia': ['#1464d2', '#e32636', '#ffffff'],
  'Botafogo': ['#111111', '#ffffff'],
  'Chapecoense': ['#198b45', '#ffffff'],
  'Corinthians': ['#111111', '#ffffff'],
  'Coritiba': ['#198b45', '#ffffff'],
  'Cruzeiro': ['#1464d2', '#ffffff'],
  'Flamengo': ['#e32636', '#111111'],
  'Fluminense': ['#198b45', '#9d1c2d', '#ffffff'],
  'Grêmio': ['#19a7e0', '#111111', '#ffffff'],
  'Internacional': ['#e32636', '#ffffff'],
  'Mirassol': ['#ffd633', '#198b45'],
  'Palmeiras': ['#198b45', '#ffffff'],
  'Red Bull Bragantino': ['#e32636', '#ffffff'],
  'Remo': ['#1464d2', '#ffffff'],
  'Santos': ['#111111', '#ffffff'],
  'São Paulo': ['#e32636', '#111111', '#ffffff'],
  'Vitória': ['#e32636', '#111111']
};

export interface FormationPreset {
  name: string;
  positions: { x: number; y: number; role: string; label: string }[];
}

export const TACTICAL_FORMATIONS: Record<string, FormationPreset> = {
  '4-3-3': {
    name: '4-3-3 Ofensivo',
    positions: [
      { x: 8, y: 50, role: 'GOL', label: 'GOL' },
      { x: 22, y: 18, role: 'LD', label: 'LD' },
      { x: 19, y: 38, role: 'ZAG', label: 'ZAD' },
      { x: 19, y: 62, role: 'ZAG', label: 'ZAE' },
      { x: 22, y: 82, role: 'LE', label: 'LE' },
      { x: 33, y: 50, role: 'VOL', label: 'VOL' },
      { x: 42, y: 32, role: 'MEI', label: 'MD' },
      { x: 42, y: 68, role: 'MEI', label: 'ME' },
      { x: 58, y: 20, role: 'ATA', label: 'PD' },
      { x: 62, y: 50, role: 'ATA', label: 'CA' },
      { x: 58, y: 80, role: 'ATA', label: 'PE' }
    ]
  },
  '4-2-3-1': {
    name: '4-2-3-1 Equilibrado',
    positions: [
      { x: 8, y: 50, role: 'GOL', label: 'GOL' },
      { x: 22, y: 18, role: 'LD', label: 'LD' },
      { x: 19, y: 38, role: 'ZAG', label: 'ZAD' },
      { x: 19, y: 62, role: 'ZAG', label: 'ZAE' },
      { x: 22, y: 82, role: 'LE', label: 'LE' },
      { x: 32, y: 38, role: 'VOL', label: 'VOL1' },
      { x: 32, y: 62, role: 'VOL', label: 'VOL2' },
      { x: 45, y: 50, role: 'MEI', label: 'MEI' },
      { x: 48, y: 22, role: 'ATA', label: 'MD' },
      { x: 48, y: 78, role: 'ATA', label: 'ME' },
      { x: 63, y: 50, role: 'ATA', label: 'CA' }
    ]
  },
  '3-5-2': {
    name: '3-5-2 Espelhado',
    positions: [
      { x: 8, y: 50, role: 'GOL', label: 'GOL' },
      { x: 19, y: 28, role: 'ZAG', label: 'ZAD' },
      { x: 17, y: 50, role: 'ZAG', label: 'ZAC' },
      { x: 19, y: 72, role: 'ZAG', label: 'ZAE' },
      { x: 35, y: 15, role: 'LD', label: 'ALD' },
      { x: 31, y: 40, role: 'VOL', label: 'VOL1' },
      { x: 31, y: 60, role: 'VOL', label: 'VOL2' },
      { x: 44, y: 50, role: 'MEI', label: 'MEI' },
      { x: 35, y: 85, role: 'LE', label: 'ALE' },
      { x: 58, y: 38, role: 'ATA', label: 'AT1' },
      { x: 58, y: 62, role: 'ATA', label: 'AT2' }
    ]
  }
};
