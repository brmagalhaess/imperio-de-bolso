// Conquistas simples (docs/README.md §3). Prêmio em diamantes (fonte gratuita — doc §6).

export interface AchievementStats {
  ownedCount: number;
  praiaComplete: boolean;
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
    description: "Construa os 4 negócios da praia",
    rewardGems: 3,
    progress: (s) => count(s.praiaComplete ? 1 : 0, 1),
  },
  ...(
    [
      ["cidade", "Prefeito da cidade", "Construa os 6 negócios da cidade", 5],
      ["porto", "Capitão do porto", "Construa os 6 negócios do porto", 8],
      ["centro", "Magnata do centro", "Construa os 6 negócios do centro financeiro", 12],
    ] as const
  ).map(([district, title, description, rewardGems]) => ({
    id: `${district}_complete`,
    title,
    description,
    rewardGems,
    progress: (s: AchievementStats) =>
      count(s.ownedByDistrict?.[district] ?? 0, s.totalByDistrict?.[district] ?? 6),
  })),
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
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
