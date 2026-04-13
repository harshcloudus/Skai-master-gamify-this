import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type AchievementCategory = 'calls' | 'revenue' | 'setup' | 'engagement';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  threshold: number;
  sort_order: number;
}

export interface RestaurantAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
  seen: boolean;
}

export interface AchievementWithStatus extends AchievementDefinition {
  unlocked: boolean;
  unlocked_at: string | null;
  seen: boolean;
}

export type StreakType = 'agent_active' | 'daily_login' | 'weekly_review';

export interface RestaurantStreak {
  id: string;
  streak_type: StreakType;
  current_count: number;
  longest_count: number;
  last_activity_date: string;
  updated_at: string;
}

export type WeeklyChallengeType = 'orders_target' | 'revenue_target' | 'review_calls';

export interface WeeklyChallenge {
  id: string;
  week_start: string;
  challenge_type: WeeklyChallengeType;
  title: string;
  target_value: number;
  current_value: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface GamificationOverview {
  xp: number;
  level: number;
  next_level_xp: number;
  level_title: string;
  setup_percent: number;
  streaks: RestaurantStreak[];
  active_challenges: WeeklyChallenge[];
  achievements: AchievementWithStatus[];
}

export type GamificationEventType =
  | 'login'
  | 'call_reviewed'
  | 'achievement_unlocked';

export interface GamificationEventRequest {
  event_type: GamificationEventType;
  metadata?: Record<string, unknown>;
}

export interface GamificationEventResponse {
  id: string;
  created_at: string;
}

export interface MarkAchievementSeenResponse {
  success: boolean;
}

const QUERY_KEYS = {
  overview: ['gamification-overview'] as const,
  achievements: ['gamification-achievements'] as const,
  challenges: ['gamification-challenges'] as const,
};

const MOCK_OVERVIEW: GamificationOverview = {
  xp: 420,
  level: 3,
  next_level_xp: 600,
  level_title: 'Regular',
  setup_percent: 45,
  streaks: [
    {
      id: 'mock-streak-agent',
      streak_type: 'agent_active',
      current_count: 4,
      longest_count: 9,
      last_activity_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-streak-login',
      streak_type: 'daily_login',
      current_count: 2,
      longest_count: 7,
      last_activity_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-streak-review',
      streak_type: 'weekly_review',
      current_count: 1,
      longest_count: 3,
      last_activity_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    },
  ],
  active_challenges: [
    {
      id: 'mock-challenge-1',
      week_start: new Date().toISOString().slice(0, 10),
      challenge_type: 'review_calls',
      title: 'Review 5 calls this week',
      target_value: 5,
      current_value: 2,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mock-challenge-2',
      week_start: new Date().toISOString().slice(0, 10),
      challenge_type: 'orders_target',
      title: 'Hit 10 orders this week',
      target_value: 10,
      current_value: 6,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mock-challenge-3',
      week_start: new Date().toISOString().slice(0, 10),
      challenge_type: 'revenue_target',
      title: 'Reach $1,000 in revenue',
      target_value: 1000,
      current_value: 420,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    },
  ],
  achievements: [
    // Calls
    {
      id: 'first_call',
      title: 'First Contact',
      description: 'Receive your first AI-handled call',
      icon: '📞',
      category: 'calls',
      tier: 'bronze',
      threshold: 1,
      sort_order: 1,
      unlocked: true,
      unlocked_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      seen: false,
    },
    {
      id: 'calls_50',
      title: 'Rising Star',
      description: 'Handle 50 calls with your AI agent',
      icon: '⭐',
      category: 'calls',
      tier: 'silver',
      threshold: 50,
      sort_order: 2,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'calls_100',
      title: 'Century Club',
      description: 'Reach the 100 call milestone',
      icon: '💯',
      category: 'calls',
      tier: 'gold',
      threshold: 100,
      sort_order: 3,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'calls_500',
      title: 'Call Commander',
      description: "500 calls handled — you're a pro",
      icon: '🎖️',
      category: 'calls',
      tier: 'gold',
      threshold: 500,
      sort_order: 4,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'calls_1000',
      title: 'Thousand Strong',
      description: '1,000 calls and counting',
      icon: '👑',
      category: 'calls',
      tier: 'platinum',
      threshold: 1000,
      sort_order: 5,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },

    // Revenue
    {
      id: 'revenue_1k',
      title: 'First Grand',
      description: 'Generate $1K in AI-powered orders',
      icon: '💵',
      category: 'revenue',
      tier: 'bronze',
      threshold: 1000,
      sort_order: 6,
      unlocked: true,
      unlocked_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      seen: true,
    },
    {
      id: 'revenue_5k',
      title: 'Revenue Rocket',
      description: 'Surpass $5K in total revenue',
      icon: '🚀',
      category: 'revenue',
      tier: 'silver',
      threshold: 5000,
      sort_order: 7,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'revenue_10k',
      title: 'Money Machine',
      description: '$10K earned through SKAI',
      icon: '💰',
      category: 'revenue',
      tier: 'gold',
      threshold: 10000,
      sort_order: 8,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'revenue_25k',
      title: 'Quarter Master',
      description: '$25K revenue milestone',
      icon: '🏆',
      category: 'revenue',
      tier: 'gold',
      threshold: 25000,
      sort_order: 9,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'revenue_50k',
      title: 'Revenue Titan',
      description: '$50K — SKAI is paying for itself',
      icon: '💎',
      category: 'revenue',
      tier: 'platinum',
      threshold: 50000,
      sort_order: 10,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },

    // Setup
    {
      id: 'setup_complete',
      title: 'Fully Loaded',
      description: 'Configure all settings (100% setup)',
      icon: '⚙️',
      category: 'setup',
      tier: 'silver',
      threshold: 100,
      sort_order: 11,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'menu_described',
      title: 'Menu Storyteller',
      description: 'Add descriptions to all menu items',
      icon: '📝',
      category: 'setup',
      tier: 'bronze',
      threshold: 100,
      sort_order: 12,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'hours_configured',
      title: 'Clockwork',
      description: 'Set up your business hours',
      icon: '🕐',
      category: 'setup',
      tier: 'bronze',
      threshold: 1,
      sort_order: 13,
      unlocked: true,
      unlocked_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      seen: true,
    },
    {
      id: 'agent_activated',
      title: 'Go Live',
      description: 'Enable your AI agent for the first time',
      icon: '🟢',
      category: 'setup',
      tier: 'bronze',
      threshold: 1,
      sort_order: 14,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },

    // Engagement (from plan)
    {
      id: 'reviews_10',
      title: 'Curious Owner',
      description: 'Review 10 call transcripts',
      icon: '🔍',
      category: 'engagement',
      tier: 'bronze',
      threshold: 10,
      sort_order: 15,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'reviews_50',
      title: 'Transcript Pro',
      description: 'Dive into 50 call transcripts',
      icon: '📋',
      category: 'engagement',
      tier: 'silver',
      threshold: 50,
      sort_order: 16,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'reviews_100',
      title: 'Detail Oriented',
      description: 'Review 100 calls — nothing slips by',
      icon: '🧐',
      category: 'engagement',
      tier: 'gold',
      threshold: 100,
      sort_order: 17,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'streak_7_agent',
      title: 'Week Warrior',
      description: 'Keep agent active 7 days straight',
      icon: '🔥',
      category: 'engagement',
      tier: 'silver',
      threshold: 7,
      sort_order: 18,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'streak_30_agent',
      title: 'Iron Will',
      description: 'Agent active for 30 consecutive days',
      icon: '⚡',
      category: 'engagement',
      tier: 'gold',
      threshold: 30,
      sort_order: 19,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'streak_7_login',
      title: 'Daily Driver',
      description: 'Log in 7 days in a row',
      icon: '📅',
      category: 'engagement',
      tier: 'silver',
      threshold: 7,
      sort_order: 20,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'weekly_challenge_3',
      title: 'Challenger',
      description: 'Complete 3 weekly challenges',
      icon: '🎯',
      category: 'engagement',
      tier: 'silver',
      threshold: 3,
      sort_order: 21,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
    {
      id: 'weekly_challenge_10',
      title: 'Goal Crusher',
      description: 'Complete 10 weekly challenges',
      icon: '🏅',
      category: 'engagement',
      tier: 'gold',
      threshold: 10,
      sort_order: 22,
      unlocked: false,
      unlocked_at: null,
      seen: true,
    },
  ],
};

const MOCK_ACHIEVEMENTS: AchievementWithStatus[] = MOCK_OVERVIEW.achievements;
const MOCK_CHALLENGES: WeeklyChallenge[] = MOCK_OVERVIEW.active_challenges;

function safeNumber(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export function normalizeOverview(raw: Partial<GamificationOverview>): GamificationOverview {
  return {
    xp: safeNumber(raw.xp, 0),
    level: safeNumber(raw.level, 1),
    next_level_xp: safeNumber(raw.next_level_xp, 100),
    level_title: raw.level_title || 'Newcomer',
    setup_percent: Math.max(0, Math.min(100, safeNumber(raw.setup_percent, 0))),
    streaks: Array.isArray(raw.streaks) ? raw.streaks : [],
    active_challenges: Array.isArray(raw.active_challenges) ? raw.active_challenges : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
  };
}

export function useGamificationOverview(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.overview,
    enabled,
    queryFn: async () => {
      try {
        return await api.get<GamificationOverview>('/api/v1/gamification/overview');
      } catch {
        // Backend may not be live yet — keep UI visible with safe placeholders.
        return { message: 'mock', data: MOCK_OVERVIEW };
      }
    },
    select: (res) => normalizeOverview(res.data),
    retry: false,
    staleTime: 30_000,
  });
}

export function useGamificationAchievements(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.achievements,
    enabled,
    queryFn: async () => {
      try {
        return await api.get<AchievementWithStatus[]>(
          '/api/v1/gamification/achievements',
        );
      } catch {
        return { message: 'mock', data: MOCK_ACHIEVEMENTS };
      }
    },
    select: (res) => (Array.isArray(res.data) ? res.data : []),
    retry: false,
    staleTime: 60_000,
  });
}

export function useGamificationChallenges(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.challenges,
    enabled,
    queryFn: async () => {
      try {
        return await api.get<WeeklyChallenge[]>('/api/v1/gamification/challenges');
      } catch {
        return { message: 'mock', data: MOCK_CHALLENGES };
      }
    },
    select: (res) => (Array.isArray(res.data) ? res.data : []),
    retry: false,
    staleTime: 30_000,
  });
}

export function usePostGamificationEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GamificationEventRequest) =>
      api.postRaw<GamificationEventResponse>('/api/v1/gamification/events', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.overview });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.challenges });
    },
  });
}

export async function markAchievementSeen(id: string): Promise<MarkAchievementSeenResponse> {
  try {
    const res = await api.put<MarkAchievementSeenResponse>(
      `/api/v1/gamification/achievements/${encodeURIComponent(id)}/seen`,
      {},
    );
    return res.data;
  } catch {
    return { success: true };
  }
}

export function useMarkAchievementSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markAchievementSeen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.overview });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
    },
  });
}

