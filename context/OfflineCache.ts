import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingQuizAnswer {
  question_id: number;
  is_correct: boolean;
  time_spent_seconds: number;
}

export interface PendingQuizAttempt {
  localId: string;
  userId: number;
  quizId: number;
  attemptId?: number | null;
  difficulty: string;
  score: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  answers: PendingQuizAnswer[];
  timestamp: number;
}

const KEYS = {
  LESSONS_PREFIX: '@brightpath_cache_lessons_',
  PROGRESS_PREFIX: '@brightpath_cache_progress_',
  HOME_PREFIX: '@brightpath_cache_home_',
  FLASHCARDS_PREFIX: '@brightpath_cache_flashcards_',
  QUIZ_SESSION_PREFIX: '@brightpath_cache_quiz_session_',
  TOPIC_QUIZZES_PREFIX: '@brightpath_cache_topic_quizzes_',
  PENDING_QUEUE: '@brightpath_pending_quiz_queue',
  KC_MASTERY_PREFIX: '@brightpath_kc_mastery_',
  KC_MASTERY_LIST_PREFIX: '@brightpath_cache_kc_mastery_list_',
  LOCAL_STARS_PREFIX: '@brightpath_user_stars_',
};

// Generic storage helpers
export const setCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.log('[OfflineCache] setCache error:', err);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.log('[OfflineCache] getCache error:', err);
    return null;
  }
};

// Specific content caching
export const cacheTopicLessons = async (topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.LESSONS_PREFIX}${topicId}`, data);
};

export const getCachedTopicLessons = async (topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.LESSONS_PREFIX}${topicId}`);
};

export const cacheStudentProgress = async (userId: number, topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.PROGRESS_PREFIX}${userId}_${topicId}`, data);
};

export const getCachedStudentProgress = async (userId: number, topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.PROGRESS_PREFIX}${userId}_${topicId}`);
};

export const cacheHomeSummary = async (userId: number, data: any): Promise<void> => {
  await setCache(`${KEYS.HOME_PREFIX}${userId}`, data);
};

export const getCachedHomeSummary = async (userId: number): Promise<any | null> => {
  return await getCache(`${KEYS.HOME_PREFIX}${userId}`);
};

export const cacheFlashcards = async (topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.FLASHCARDS_PREFIX}${topicId}`, data);
};

export const getCachedFlashcards = async (topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.FLASHCARDS_PREFIX}${topicId}`);
};

export const cacheQuizSession = async (quizId: number | string, data: any): Promise<void> => {
  await setCache(`${KEYS.QUIZ_SESSION_PREFIX}${quizId}`, data);
};

export const getCachedQuizSession = async (quizId: number | string): Promise<any | null> => {
  return await getCache(`${KEYS.QUIZ_SESSION_PREFIX}${quizId}`);
};

export const cacheTopicQuizzes = async (topicId: string, quizzes: any[]): Promise<void> => {
  await setCache(`${KEYS.TOPIC_QUIZZES_PREFIX}${topicId}`, quizzes);
};

export const getCachedTopicQuizzes = async (topicId: string): Promise<any[] | null> => {
  return await getCache(`${KEYS.TOPIC_QUIZZES_PREFIX}${topicId}`);
};

/**
 * Pre-caches all quizzes for a topic so they are ready for offline play.
 * Saves each quiz under its quizId AND its lessonId (`lesson_${lessonId}`).
 */
export const preCacheTopicQuizzes = async (apiBaseUrl: string, topicId: string): Promise<any[] | null> => {
  try {
    const res = await fetch(`${apiBaseUrl}/quizzes/${topicId}`);
    if (res.ok) {
      const quizzes = await res.json();
      if (Array.isArray(quizzes) && quizzes.length > 0) {
        await cacheTopicQuizzes(topicId, quizzes);
        for (const q of quizzes) {
          if (q.id) {
            await cacheQuizSession(q.id, q);
          }
          if (q.lesson_id) {
            await cacheQuizSession(`lesson_${q.lesson_id}`, q);
          }
        }
        return quizzes;
      }
    }
  } catch (err) {
    console.log('[OfflineCache] preCacheTopicQuizzes error:', err);
  }
  return null;
};

// ── Local Star Balance Storage ──────────────────────────────────────────────

export const saveLocalTotalStars = async (userId: number, stars: number): Promise<void> => {
  await setCache(`${KEYS.LOCAL_STARS_PREFIX}${userId}`, stars);
};

export const getLocalTotalStars = async (userId: number): Promise<number> => {
  const stars = await getCache<number>(`${KEYS.LOCAL_STARS_PREFIX}${userId}`);
  if (typeof stars === 'number') return stars;
  const home = await getCachedHomeSummary(userId);
  if (home && typeof home.total_stars === 'number') {
    await saveLocalTotalStars(userId, home.total_stars);
    return home.total_stars;
  }
  return 0;
};

export const addLocalStars = async (userId: number, deltaStars: number): Promise<number> => {
  const current = await getLocalTotalStars(userId);
  const updated = Math.max(0, current + deltaStars);
  await saveLocalTotalStars(userId, updated);

  // Keep home summary cache in sync
  try {
    const home = await getCachedHomeSummary(userId);
    if (home) {
      home.total_stars = updated;
      await cacheHomeSummary(userId, home);
    }
  } catch {}

  return updated;
};

// ── Pending Quiz Queue for Offline Submissions ──────────────────────────────

export const getPendingQuizzes = async (): Promise<PendingQuizAttempt[]> => {
  const queue = await getCache<PendingQuizAttempt[]>(KEYS.PENDING_QUEUE);
  return Array.isArray(queue) ? queue : [];
};

export const enqueuePendingQuiz = async (
  attempt: Omit<PendingQuizAttempt, 'localId' | 'timestamp'>
): Promise<PendingQuizAttempt> => {
  const currentQueue = await getPendingQuizzes();
  const localId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record: PendingQuizAttempt = {
    ...attempt,
    localId,
    timestamp: Date.now(),
  };

  const updatedQueue = [...currentQueue, record];
  await setCache(KEYS.PENDING_QUEUE, updatedQueue);
  return record;
};

export const removePendingQuiz = async (localId: string): Promise<void> => {
  const currentQueue = await getPendingQuizzes();
  const updatedQueue = currentQueue.filter(item => item.localId !== localId);
  await setCache(KEYS.PENDING_QUEUE, updatedQueue);
};

// Background flush worker: sends all pending attempts to server
export const syncPendingQuizzes = async (
  apiBaseUrl: string
): Promise<{ synced: number; failed: number }> => {
  const queue = await getPendingQuizzes();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`${apiBaseUrl}/quiz/offline-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: item.userId,
          quiz_id: item.quizId,
          attempt_id: item.attemptId || null,
          difficulty: item.difficulty,
          score: item.score,
          total_questions: item.totalQuestions,
          time_spent_seconds: item.timeSpentSeconds,
          answers: item.answers,
        }),
      });

      if (res.ok) {
        await removePendingQuiz(item.localId);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      // Stop loop if network is still disconnected
      break;
    }
  }

  return { synced, failed };
};

// Check connectivity with a quick timeout
export const checkOnlineStatus = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${apiBaseUrl}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
};

// ── Client-Side Bayesian Knowledge Tracing (BKT) Engine ───────────────────────

export interface BKTParameters {
  prior: number;   // P(L_0) initial probability of mastery (default: 0.10)
  learns: number;  // P(T) transition probability not_learned -> learned (default: 0.20)
  guesses: number; // P(G) probability of correct answer despite not knowing (default: 0.25)
  slips: number;   // P(S) probability of wrong answer despite knowing (default: 0.10)
}

export interface StudentKCMastery {
  kc_name: string;
  display_name?: string;
  p_mastery: number;
  p_mastery_pct: number;
  status: 'mastered' | 'learning' | 'struggling' | 'not_started';
  correct_count: number;
  wrong_count: number;
  total_opportunities: number;
  last_updated: number;
}

export const DEFAULT_BKT_PARAMS: BKTParameters = {
  prior: 0.10,
  learns: 0.20,
  guesses: 0.25,
  slips: 0.10,
};

/**
 * Standard Bayesian Knowledge Tracing (BKT) update formula.
 * Mathematically identical to pyBKT and server.py.
 */
export function bktUpdate(
  pKnow: number,
  isCorrect: boolean,
  params: BKTParameters = DEFAULT_BKT_PARAMS
): number {
  const { learns, guesses, slips } = params;
  let numerator: number;
  let denominator: number;

  if (isCorrect) {
    numerator = pKnow * (1.0 - slips);
    denominator = numerator + (1.0 - pKnow) * guesses;
  } else {
    numerator = pKnow * slips;
    denominator = numerator + (1.0 - pKnow) * (1.0 - guesses);
  }

  const pKnowGivenObs = numerator / Math.max(denominator, 1e-9);
  const pKnowNext = pKnowGivenObs + (1.0 - pKnowGivenObs) * learns;
  return Math.round(Math.min(0.99, Math.max(0.01, pKnowNext)) * 10000) / 10000;
}

export function getBKTStatus(
  pMastery: number,
  totalOpportunities: number
): 'mastered' | 'learning' | 'struggling' | 'not_started' {
  if (totalOpportunities === 0) return 'not_started';
  if (pMastery >= 0.70) return 'mastered';
  if (pMastery >= 0.30) return 'learning';
  return 'struggling';
}

export const getLocalKCMastery = async (
  userId: number,
  kcName: string
): Promise<StudentKCMastery> => {
  const key = `${KEYS.KC_MASTERY_PREFIX}${userId}_${kcName}`;
  const cached = await getCache<StudentKCMastery>(key);
  if (cached) return cached;
  return {
    kc_name: kcName,
    display_name: kcName.replace(/_/g, ' '),
    p_mastery: DEFAULT_BKT_PARAMS.prior,
    p_mastery_pct: Math.round(DEFAULT_BKT_PARAMS.prior * 100),
    status: 'not_started',
    correct_count: 0,
    wrong_count: 0,
    total_opportunities: 0,
    last_updated: Date.now(),
  };
};

export const getAllLocalKCMastery = async (
  userId: number
): Promise<Record<string, StudentKCMastery>> => {
  const key = `${KEYS.KC_MASTERY_PREFIX}all_${userId}`;
  return (await getCache<Record<string, StudentKCMastery>>(key)) || {};
};

export const updateLocalKCMastery = async (
  userId: number,
  kcName: string,
  isCorrect: boolean,
  customParams?: BKTParameters
): Promise<StudentKCMastery> => {
  const cleanKc = kcName || 'general_comprehension';
  const current = await getLocalKCMastery(userId, cleanKc);
  const newMastery = bktUpdate(current.p_mastery, isCorrect, customParams || DEFAULT_BKT_PARAMS);
  const totalOpp = current.total_opportunities + 1;
  const newStatus = getBKTStatus(newMastery, totalOpp);

  const updated: StudentKCMastery = {
    kc_name: cleanKc,
    display_name: cleanKc.replace(/_/g, ' '),
    p_mastery: newMastery,
    p_mastery_pct: Math.round(newMastery * 1000) / 10,
    status: newStatus,
    correct_count: current.correct_count + (isCorrect ? 1 : 0),
    wrong_count: current.wrong_count + (isCorrect ? 0 : 1),
    total_opportunities: totalOpp,
    last_updated: Date.now(),
  };

  await setCache(`${KEYS.KC_MASTERY_PREFIX}${userId}_${cleanKc}`, updated);

  const allKey = `${KEYS.KC_MASTERY_PREFIX}all_${userId}`;
  const all = (await getCache<Record<string, StudentKCMastery>>(allKey)) || {};
  all[cleanKc] = updated;
  await setCache(allKey, all);

  return updated;
};

export const cacheKCMasteryList = async (userId: number, data: any): Promise<void> => {
  await setCache(`${KEYS.KC_MASTERY_LIST_PREFIX}${userId}`, data);
};

export const getCachedKCMasteryList = async (userId: number): Promise<any | null> => {
  return await getCache(`${KEYS.KC_MASTERY_LIST_PREFIX}${userId}`);
};

