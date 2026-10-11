import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';
import Confetti from '../components/Confetti';

// --- Types -------------------------------------------------------------------

interface DailySlot {
  slot_difficulty: 'easy' | 'medium' | 'hard';
  quiz_id: number | null;
  quiz_title: string | null;
  topic_id: number | null;
  completed: boolean;
  stars_earned: number | null;
  can_refresh: boolean;
  refresh_used: boolean;
}

interface DailyQuizResponse {
  slots: DailySlot[];
  full_clear_achieved: boolean;
  completed_count: number;
}

interface StreakResponse {
  current_streak: number;
  can_repair: boolean;
  streak_broken: boolean;
}

// --- Config ------------------------------------------------------------------

const SLOT_CONFIG: Record<
  string,
  { label: string; reward: number; color: string; bg: string; borderColor: string }
> = {
  easy:   { label: 'Easy',   reward: 10, color: '#10B981', bg: '#ECFDF5', borderColor: '#6EE7B7' },
  medium: { label: 'Medium', reward: 20, color: '#F59E0B', bg: '#FFFBEB', borderColor: '#FCD34D' },
  hard:   { label: 'Hard',   reward: 30, color: '#EF4444', bg: '#FEF2F2', borderColor: '#FCA5A5' },
};

// --- Component ---------------------------------------------------------------

export default function DailyQuizScreen() {
  const { user } = useAuth() as any;
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const userId = user?.id || 1;

  const [slots, setSlots] = useState<DailySlot[]>([]);
  const [fullClear, setFullClear] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairingStreak, setRepairingStreak] = useState(false);
  const [refreshingSlot, setRefreshingSlot] = useState<string | null>(null);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTimeUntilMidnight('00:00:00');
        return;
      }
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimeUntilMidnight(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subtle Flame Flicker / Pulse for active study streak
  const flameAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const flameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1.16,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flameAnim, {
          toValue: 0.96,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flameAnim, {
          toValue: 1.10,
          duration: 650,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flameAnim, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    flameLoop.start();
    return () => flameLoop.stop();
  }, [flameAnim]);

  // -- Fetch helpers ----------------------------------------------------------

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/daily-quizzes/${userId}`);
      if (res.ok) {
        const data: DailyQuizResponse = await res.json();
        setSlots(data.slots ?? []);
        setFullClear(data.full_clear_achieved ?? false);
        setCompletedCount(data.completed_count ?? 0);
      }
    } catch { /* silent */ }
  }, [userId]);

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/streak`);
      if (res.ok) {
        setStreak(await res.json());
      }
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSlots(), fetchStreak()]);
      setLoading(false);
    };
    load();
  }, [fetchSlots, fetchStreak]);

  // -- Actions ----------------------------------------------------------------

  const handleRepairStreak = async () => {
    if (repairingStreak) return;
    setRepairingStreak(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/repair-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchStreak();
      }
    } catch { /* silent */ }
    finally { setRepairingStreak(false); }
  };

  const handleRefreshSlot = async (slot: DailySlot) => {
    if (refreshingSlot) return;
    setRefreshingSlot(slot.slot_difficulty);
    try {
      const res = await fetch(`${API_URL}/daily-quizzes/${userId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_difficulty: slot.slot_difficulty, topic_id: null }),
      });
      if (res.ok) {
        await fetchSlots();
      }
    } catch { /* silent */ }
    finally { setRefreshingSlot(null); }
  };

  const handleStartQuiz = (slot: DailySlot) => {
    if (!slot.quiz_id) return;
    router.push({
      pathname: '/quiz/[id]',
      params: {
        id: String(slot.quiz_id),
        subjectId: subjectId ?? '',
        deafEnglish: 'false',
        mode: 'daily',
        slot_difficulty: slot.slot_difficulty,
      },
    });
  };

  // -- Render -----------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {fullClear && <Confetti count={50} />}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daily Quizzes</Text>
          <Text style={styles.headerSub}>Complete today's challenges to earn stars</Text>
        </View>
        <TouchableOpacity
          style={styles.headerRefreshBtn}
          onPress={() => { fetchSlots(); fetchStreak(); }}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading daily quizzes...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Streak Widget */}
          {streak && (
            <View style={styles.streakCard}>
              <View style={styles.streakLeft}>
                <Animated.View style={!streak.streak_broken ? { transform: [{ scale: flameAnim }] } : null}>
                  <Ionicons name="flame" size={32} color={streak.streak_broken ? "#9CA3AF" : "#F97316"} />
                </Animated.View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.streakCount}>{streak.current_streak} day streak</Text>
                  <Text style={styles.streakSub}>
                    {streak.streak_broken ? 'Streak broken' : 'Keep it going!'}
                  </Text>
                </View>
              </View>
              {streak.streak_broken && streak.can_repair && (
                <TouchableOpacity
                  style={styles.repairBtn}
                  onPress={handleRepairStreak}
                  disabled={repairingStreak}
                  activeOpacity={0.8}
                >
                  {repairingStreak ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="construct-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.repairBtnText}>Repair (30</Text>
                      <Ionicons name="star" size={13} color="#FCD34D" style={{ marginLeft: 3, marginRight: 2 }} />
                      <Text style={styles.repairBtnText}>)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Full Clear Banner */}
          {fullClear && (
            <View style={styles.fullClearBanner}>
              <Ionicons name="trophy" size={22} color="#F59E0B" style={{ marginRight: 10 }} />
              <Text style={styles.fullClearText}>
                All daily quizzes complete! +25 bonus stars earned!
              </Text>
            </View>
          )}

          {/* Slot Cards */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Challenges</Text>
            <View style={styles.resetHeaderGroup}>
              <View style={styles.resetTimerBadge}>
                <Ionicons name="time-outline" size={12} color="#7C3AED" style={{ marginRight: 4 }} />
                <Text style={styles.resetTimerText}>{timeUntilMidnight}</Text>
              </View>
              <Text style={styles.sectionBadge}>Resets 12 AM</Text>
            </View>
          </View>

          {slots.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#C4B5FD" />
              <Text style={styles.emptyText}>No daily quizzes available today.</Text>
            </View>
          ) : (
            slots.map((slot) => {
              const cfg = SLOT_CONFIG[slot.slot_difficulty] ?? SLOT_CONFIG.easy;
              return (
                <View
                  key={slot.slot_difficulty}
                  style={[styles.slotCard, { borderTopColor: cfg.borderColor }]}
                >
                  {/* Top row: difficulty badge + reward */}
                  <View style={styles.slotTopRow}>
                    <View style={[styles.diffBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.diffLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={styles.rewardRow}>
                      <Ionicons name="star" size={15} color="#F59E0B" style={{ marginRight: 3 }} />
                      <Text style={styles.rewardText}>+{cfg.reward} Stars</Text>
                    </View>
                  </View>

                  {/* Quiz title */}
                  <Text style={styles.quizTitle} numberOfLines={2}>
                    {slot.quiz_title ?? (slot.quiz_id === null ? 'No quiz assigned' : `Quiz #${slot.quiz_id}`)}
                  </Text>

                  {/* State section */}
                  {slot.completed ? (
                    <View style={styles.completedRow}>
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      <Text style={styles.completedText}>Completed</Text>
                      {slot.stars_earned !== null && (
                        <View style={styles.starsEarnedPill}>
                          <Ionicons name="star" size={13} color="#F59E0B" style={{ marginRight: 3 }} />
                          <Text style={styles.starsEarnedText}>+{slot.stars_earned}</Text>
                        </View>
                      )}
                    </View>
                  ) : slot.quiz_id === null ? (
                    <View style={styles.lockedRow}>
                      <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
                      <Text style={styles.lockedText}>No lessons unlocked yet</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleStartQuiz(slot)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="play" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.startBtnText}>Start Quiz</Text>
                    </TouchableOpacity>
                  )}

                  {/* Refresh area */}
                  <View style={styles.refreshRow}>
                    {slot.refresh_used ? (
                      <View style={styles.refreshedPill}>
                        <Ionicons name="refresh-outline" size={13} color="#9CA3AF" style={{ marginRight: 4 }} />
                        <Text style={styles.refreshedLabel}>Refreshed</Text>
                      </View>
                    ) : slot.can_refresh ? (
                      <TouchableOpacity
                        style={styles.refreshSlotBtn}
                        onPress={() => handleRefreshSlot(slot)}
                        disabled={refreshingSlot === slot.slot_difficulty}
                        activeOpacity={0.8}
                      >
                        {refreshingSlot === slot.slot_difficulty ? (
                          <ActivityIndicator size="small" color="#7C3AED" />
                        ) : (
                          <>
                            <Ionicons name="refresh-outline" size={14} color="#7C3AED" style={{ marginRight: 5 }} />
                            <Text style={styles.refreshSlotBtnText}>Refresh (5</Text>
                            <Ionicons name="star" size={12} color="#F59E0B" style={{ marginLeft: 3, marginRight: 2 }} />
                            <Text style={styles.refreshSlotBtnText}>)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {/* Progress Bar */}
          <View style={styles.progressCard}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Daily Progress</Text>
              <Text style={styles.progressCount}>{completedCount}/3 Complete</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((completedCount / 3) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressHint}>
              {completedCount === 3
                ? 'All daily quizzes complete!'
                : `${3 - completedCount} quiz${3 - completedCount === 1 ? '' : 'zes'} remaining today`}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDE9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    paddingBottom: 18,
    backgroundColor: '#7C3AED',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerRefreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 48,
  },
  streakCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  streakCount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  streakSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  repairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  repairBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  fullClearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  fullClearText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4C1D95',
    letterSpacing: 0.2,
  },
  resetHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  resetTimerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderTopWidth: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  slotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diffBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 21,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    flex: 1,
  },
  starsEarnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  starsEarnedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  refreshRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  refreshSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
  },
  refreshSlotBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  refreshedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  refreshedLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4C1D95',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#7C3AED',
  },
  progressHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
});
