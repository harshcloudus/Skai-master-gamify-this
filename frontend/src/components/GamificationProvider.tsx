import React from 'react';
import AchievementToast from './AchievementToast';
import { useAuth } from '../lib/auth-context';
import {
  useGamificationOverview,
  useMarkAchievementSeen,
  usePostGamificationEvent,
} from '../lib/gamification';

const LOGIN_EVENT_KEY = 'skai.gamification.loginEventSent';
const DISMISSED_KEY = 'skai.gamification.dismissedAchievementIds';

function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function setSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, 'true');
  } catch {
    // ignore
  }
}

function readDismissedIds(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>) {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export default function GamificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const enabled = Boolean(session);

  const { data: overview } = useGamificationOverview(enabled);
  const postEvent = usePostGamificationEvent();
  const markSeen = useMarkAchievementSeen();

  const [activeAchievementId, setActiveAchievementId] = React.useState<
    string | null
  >(null);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    () => readDismissedIds(),
  );

  // Fire login event once per browser tab session (sessionStorage).
  React.useEffect(() => {
    if (!enabled) return;
    if (readSessionFlag(LOGIN_EVENT_KEY)) return;
    setSessionFlag(LOGIN_EVENT_KEY);
    postEvent.mutate({ event_type: 'login' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const unseenUnlocked = React.useMemo(() => {
    const list = overview?.achievements ?? [];
    return list
      .filter((a) => a.unlocked && !a.seen && !dismissedIds.has(a.id))
      .sort((a, b) => {
        const at = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
        const bt = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
        return bt - at;
      });
  }, [overview, dismissedIds]);

  const activeAchievement = React.useMemo(() => {
    if (!activeAchievementId) return null;
    return unseenUnlocked.find((a) => a.id === activeAchievementId) ?? null;
  }, [activeAchievementId, unseenUnlocked]);

  // When we detect unseen unlocks, surface the newest one (and keep it stable
  // until dismissed).
  React.useEffect(() => {
    if (!enabled) return;
    if (activeAchievementId) return;
    const next = unseenUnlocked[0];
    if (!next) return;
    setActiveAchievementId(next.id);
  }, [enabled, unseenUnlocked, activeAchievementId]);

  React.useEffect(() => {
    if (!activeAchievement) return;
    const id = window.setTimeout(() => {
      handleDismiss(activeAchievement.id);
    }, 5_000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAchievement?.id]);

  function handleDismiss(achievementId: string) {
    setActiveAchievementId(null);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(achievementId);
      writeDismissedIds(next);
      return next;
    });
    // Optimistic: mark seen; if it fails we’ll refetch via retry elsewhere.
    markSeen.mutate(achievementId);
  }

  return (
    <>
      {children}
      {activeAchievement && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-9999">
          <AchievementToast
            achievement={activeAchievement}
            onDismiss={() => handleDismiss(activeAchievement.id)}
          />
        </div>
      )}
    </>
  );
}

