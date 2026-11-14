// Conquistas simples (docs/README.md §3). Prêmio em diamantes (fonte gratuita — doc §6).

export interface AchievementStats {
  ownedCount: number;
  praiaComplete: boolean;
  /** Vezes que vendeu o império (prestígio). */
  prestigeCount?: number;
  /** Negócios comprados por mapa (para "complete o mapa"). */
  ownedByDistrict?: Record<string, number>;
  totalByDistrict?: Record<string, number>;
  helpers: number;
  maxLevel: number;
  /** Total faturado com produção na vida (coleta manual + ajudantes). */
  lifetimeEarned: bigint;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardGems: number;
  /** Progresso atual e alvo, para a barra na tela. */
  progress: (s: AchievementStats) => { value: bigint; target: bigint };
}

const count = (value: number, target: number) => ({ value: BigInt(value), target: BigInt(target) });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "first_business",
    title: "Primeiro negócio",
    description: "Construa seu primeiro negócio",
    rewardGems: 1,
    progress: (s) => count(s.ownedCount, 1),
  },
  {
    id: "praia_complete",
    title: "Rei da praia",
    description: "Construa os 6 negócios da praia",
    rewardGems: 3,
    progress: (s) => count(s.praiaComplete ? 1 : 0, 1),
  },
  ...(
    [
      ["cidade", "Prefeito da cidade", "Construa os 12 negócios da cidade", 5],
      ["porto", "Capitão do porto", "Construa os 12 negócios do porto", 8],
      ["centro", "Magnata do centro", "Construa os 12 negócios do centro financeiro", 12],
      ["industrial", "Barão da indústria", "Construa os 12 negócios do polo industrial", 15],
      ["serra", "Rei da montanha", "Construa os 12 negócios da serra", 18],
      ["ilha", "Dono do paraíso", "Construa os 12 negócios da ilha", 22],
      ["espaco", "Magnata das estrelas", "Construa os 12 negócios do centro espacial", 30],
      ["piratas", "Capitão pirata", "Construa os 12 negócios da Ilha dos Piratas", 34],
      ["atlantida", "Rei dos mares", "Construa os 12 negócios de Atlântida", 38],
      ["dinos", "Domador de dinossauros", "Construa os 12 negócios do Vale dos Dinossauros", 42],
      ["pinguins", "Amigo dos pinguins", "Construa os 12 negócios do Reino dos Pinguins", 46],
      ["doces", "Barão do açúcar", "Construa os 12 negócios da Cidade dos Doces", 50],
      [
        "brinquedos",
        "Mestre dos brinquedos",
        "Construa os 12 negócios da Cidade dos Brinquedos",
        54,
      ],
      ["lua", "Magnata da Lua", "Construa os 12 negócios da Base Lunar", 58],
      ["marte", "Pioneiro de Marte", "Construa os 12 negócios da Colônia em Marte", 62],
      ["gatos", "Melhor amigo dos gatos", "Construa os 12 negócios do Planeta dos Gatos", 66],
      ["saturno", "Senhor dos anéis", "Construa os 12 negócios dos Anéis de Saturno", 70],
      ["gelatina", "Rei da gelatina", "Construa os 12 negócios do Planeta Gelatina", 75],
      ["galaxia", "Imperador galáctico", "Construa os 12 negócios do Império Galáctico", 100],
    ] as const
  ).map(([district, title, description, rewardGems]) => ({
    id: `${district}_complete`,
    title,
    description,
    rewardGems,
    progress: (s: AchievementStats) =>
      count(s.ownedByDistrict?.[district] ?? 0, s.totalByDistrict?.[district] ?? 12),
  })),
  {
    id: "first_prestige",
    title: "Investidor",
    description: "Venda o império pela primeira vez",
    rewardGems: 10,
    progress: (s) => count(s.prestigeCount ?? 0, 1),
  },
  {
    id: "helpers_1",
    title: "Primeiro ajudante",
    description: "Contrate 1 ajudante",
    rewardGems: 1,
    progress: (s) => count(s.helpers, 1),
  },
  {
    id: "helpers_5",
    title: "Equipe montada",
    description: "Contrate 5 ajudantes",
    rewardGems: 3,
    progress: (s) => count(s.helpers, 5),
  },
  {
    id: "helpers_20",
    title: "Empresa de verdade",
    description: "Contrate 20 ajudantes",
    rewardGems: 10,
    progress: (s) => count(s.helpers, 20),
  },
  {
    id: "helpers_10",
    title: "Time completo",
    description: "Contrate 10 ajudantes",
    rewardGems: 5,
    progress: (s) => count(s.helpers, 10),
  },
  {
    id: "level_10",
    title: "Em crescimento",
    description: "Leve um negócio ao nível 10",
    rewardGems: 1,
    progress: (s) => count(s.maxLevel, 10),
  },
  {
    id: "level_25",
    title: "Referência",
    description: "Leve um negócio ao nível 25",
    rewardGems: 3,
    progress: (s) => count(s.maxLevel, 25),
  },
  {
    id: "level_50",
    title: "Lenda local",
    description: "Leve um negócio ao nível 50",
    rewardGems: 5,
    progress: (s) => count(s.maxLevel, 50),
  },
  {
    id: "level_100",
    title: "Lenda nacional",
    description: "Leve um negócio ao nível 100",
    rewardGems: 15,
    progress: (s) => count(s.maxLevel, 100),
  },
  {
    id: "prestige_5",
    title: "Investidor experiente",
    description: "Venda o império 5 vezes",
    rewardGems: 20,
    progress: (s) => count(s.prestigeCount ?? 0, 5),
  },
  {
    id: "earned_10k",
    title: "Primeiros 10 mil",
    description: "Fature 10.000 moedas",
    rewardGems: 1,
    progress: (s) => ({ value: s.lifetimeEarned, target: 10_000n }),
  },
  {
    id: "earned_1m",
    title: "Milionário",
    description: "Fature 1.000.000 de moedas",
    rewardGems: 3,
    progress: (s) => ({ value: s.lifetimeEarned, target: 1_000_000n }),
  },
  {
    id: "earned_1b",
    title: "Magnata",
    description: "Fature 1.000.000.000 de moedas",
    rewardGems: 10,
    progress: (s) => ({ value: s.lifetimeEarned, target: 1_000_000_000n }),
  },
  {
    id: "earned_1t",
    title: "Trilionário",
    description: "Fature 1.000.000.000.000 de moedas",
    rewardGems: 25,
    progress: (s) => ({ value: s.lifetimeEarned, target: 1_000_000_000_000n }),
  },
  ...(
    [
      ["earned_1qa", "Quatrilionário", "Fature 1 quatrilhão de moedas", 35, 10n ** 15n],
      ["earned_1qi", "Quintilionário", "Fature 1 quintilhão de moedas", 50, 10n ** 18n],
      ["earned_1sx", "Sextilionário", "Fature 1 sextilhão de moedas", 75, 10n ** 21n],
      ["earned_1sp", "Dono do universo", "Fature 1 septilhão de moedas", 100, 10n ** 24n],
    ] as const
  ).map(([id, title, description, rewardGems, target]) => ({
    id,
    title,
    description,
    rewardGems,
    progress: (s: AchievementStats) => ({ value: s.lifetimeEarned, target }),
  })),
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
