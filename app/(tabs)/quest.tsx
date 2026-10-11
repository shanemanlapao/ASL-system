import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../context/config';
import { COLORS } from '../../context/theme';

// --- Interfaces ---------------------------------------------------------------

interface DailySlot {
  slot_difficulty: 'easy' | 'medium' | 'hard';
  quiz_id: number | null;
  quiz_title: string | null;
  completed: boolean;
  stars_earned: number | null;
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

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

// Fallback sample badges if network is offline
const DEFAULT_BADGES: Badge[] = [
  { id: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: 'ribbon', color: '#7C3AED', unlocked: true },
  { id: 'quiz_ace', title: 'Quiz Ace', description: 'Score 100% on any quiz', icon: 'trophy', color: '#2563EB', unlocked: true },
  { id: 'streak_3', title: '3-Day Fire', description: 'Maintain a 3-day learning streak', icon: 'flame', color: '#EA580C', unlocked: true },
  { id: 'asl_explorer', title: 'Sign Explorer', description: 'Review 10 sign flashcards', icon: 'hand-left', color: '#0D9488', unlocked: false },
];

export default function QuestTabScreen() {
  const { user } = useAuth() as any;
  const userId = user?.id || 1;

  const [totalStars, setTotalStars] = useState<number>(0);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [dailyQuiz, setDailyQuiz] = useState<DailyQuizResponse | null>(null);
  const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairingStreak, setRepairingStreak] = useState<boolean>(false);
  const [claimedMissions, setClaimedMissions] = useState<Record<string, boolean>>({});
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState<string>('');

  // 12 Midnight countdown timer
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

  // Fetch all student gamification data
  const loadData = useCallback(async () => {
    try {
      const [streakRes, quizRes, badgesRes, summaryRes, missionsRes] = await Promise.all([
        fetch(`${API_URL}/student/${userId}/streak`).catch(() => null),
        fetch(`${API_URL}/daily-quizzes/${userId}`).catch(() => null),
        fetch(`${API_URL}/student/${userId}/badges`).catch(() => null),
        fetch(`${API_URL}/student/${userId}/home-summary`).catch(() => null),
        fetch(`${API_URL}/student/${userId}/daily-missions`).catch(() => null),
      ]);

      if (streakRes?.ok) {
        const sData = await streakRes.json();
        setStreak(sData);
      }
      if (quizRes?.ok) {
        const qData = await quizRes.json();
        setDailyQuiz(qData);
      }
      if (badgesRes?.ok) {
        const bData = await badgesRes.json();
        if (Array.isArray(bData) && bData.length > 0) {
          setBadges(bData);
        }
      }
      if (missionsRes?.ok) {
        const mData = await missionsRes.json();
        if (mData.claimed_missions) {
          setClaimedMissions(mData.claimed_missions);
        }
        if (mData.total_stars !== undefined && mData.total_stars > 0) {
          setTotalStars(mData.total_stars);
        }
      }
      if (summaryRes?.ok) {
        const sumData = await summaryRes.json();
        if (sumData.total_stars !== undefined) {
          setTotalStars(sumData.total_stars);
        }
      }
    } catch (err) {
      console.log('Error loading quest data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRepairStreak = async () => {
    if (repairingStreak) return;
    setRepairingStreak(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/repair-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.log('Error repairing streak:', err);
    } finally {
      setRepairingStreak(false);
    }
  };

  const handleClaimMission = async (missionId: string, starsReward: number) => {
    if (claimingMission || claimedMissions[missionId]) return;
    setClaimingMission(missionId);

    // Optimistic UI update
    setClaimedMissions(prev => ({ ...prev, [missionId]: true }));
    setTotalStars(prev => prev + starsReward);

    try {
      const res = await fetch(`${API_URL}/student/${userId}/daily-missions/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId, stars_reward: starsReward }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.total_stars !== undefined) {
          setTotalStars(data.total_stars);
        }
      }
    } catch (err) {
      console.log('Error claiming mission on server:', err);
    } finally {
      setClaimingMission(null);
    }
  };

  const completedQuizSlots = dailyQuiz?.completed_count ?? 0;
  const isQuizMissionDone = completedQuizSlots >= 1;
  const unlockedBadgesCount = badges.filter(b => b.unlocked).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Sleek Compact Header Matching Brand Theme */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Missions & Trophies</Text>
          <Text style={styles.headerSubtitle}>Complete daily quests to earn stars</Text>
        </View>

        {/* Quick Stats Top Right */}
        <View style={styles.headerStatsRow}>
          <View style={styles.statPillStars}>
            <Ionicons name="star" size={15} color={COLORS.star} />
            <Text style={styles.statPillStarsText}>{totalStars}</Text>
          </View>
          <View style={styles.statPillStreak}>
            <Ionicons name="flame" size={15} color={COLORS.streak} />
            <Text style={styles.statPillStreakText}>{streak?.current_streak ?? 0}d</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading quests & trophies...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Streak Status & Repair Shield */}
          {streak && (
            <View style={[
              styles.streakBanner,
              streak.streak_broken ? styles.streakBannerBroken : styles.streakBannerActive
            ]}>
              <View style={styles.streakIconBox}>
                <Ionicons
                  name={streak.streak_broken ? 'flame-outline' : 'flame'}
                  size={26}
                  color={streak.streak_broken ? COLORS.textSecondary : COLORS.streak}
                />
              </View>
              <View style={styles.streakInfo}>
                <Text style={styles.streakTitle}>
                  {streak.current_streak} Day Learning Streak
                </Text>
                <Text style={styles.streakDesc}>
                  {streak.streak_broken
                    ? 'Streak paused! Repair now with 30 stars.'
                    : 'Streak shield active! Complete 1 quest to extend.'}
                </Text>
              </View>

              {streak.streak_broken && streak.can_repair && (
                <TouchableOpacity
                  style={styles.repairButton}
                  onPress={handleRepairStreak}
                  disabled={repairingStreak}
                  activeOpacity={0.8}
                >
                  {repairingStreak ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="construct" size={13} color="#FFFFFF" />
                      <Text style={styles.repairButtonText}>Repair (30★)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 3. Daily Missions Checklist */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Daily Missions</Text>
            <View style={styles.resetHeaderGroup}>
              <View style={styles.resetTimerBadge}>
                <Ionicons name="time-outline" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.resetTimerText}>{timeUntilMidnight}</Text>
              </View>
              <Text style={styles.sectionBadge}>Resets Daily</Text>
            </View>
          </View>

          {/* Mission 1: Story Explorer */}
          <View style={styles.missionCard}>
            <View style={[styles.missionIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="book" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.missionContent}>
              <View style={styles.missionTitleRow}>
                <Text style={styles.missionTitle}>Story Explorer</Text>
                <View style={styles.rewardTag}>
                  <Ionicons name="star" size={12} color={COLORS.star} />
                  <Text style={styles.rewardTagText}>+10</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>Read any story module lesson</Text>
              <View style={styles.missionProgressRow}>
                <View style={styles.missionProgressBarBg}>
                  <View style={[styles.missionProgressBarFill, { width: '100%', backgroundColor: COLORS.primary }]} />
                </View>
                <Text style={styles.missionProgressText}>1/1</Text>
              </View>
            </View>
            {claimedMissions['story'] ? (
              <View style={styles.claimedPill}>
                <Ionicons name="checkmark" size={13} color={COLORS.success} />
                <Text style={styles.claimedPillText}>Claimed</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.claimButton}
                activeOpacity={0.8}
                disabled={claimingMission === 'story'}
                onPress={() => handleClaimMission('story', 10)}
              >
                {claimingMission === 'story' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.claimButtonText}>Claim</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Mission 2: Daily Quiz Master */}
          <View style={styles.missionCard}>
            <View style={[styles.missionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="trophy" size={22} color="#2563EB" />
            </View>
            <View style={styles.missionContent}>
              <View style={styles.missionTitleRow}>
                <Text style={styles.missionTitle}>Daily Quiz Ace</Text>
                <View style={styles.rewardTag}>
                  <Ionicons name="star" size={12} color={COLORS.star} />
                  <Text style={styles.rewardTagText}>+15</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>Pass at least 1 daily quiz slot</Text>
              <View style={styles.missionProgressRow}>
                <View style={styles.missionProgressBarBg}>
                  <View
                    style={[
                      styles.missionProgressBarFill,
                      {
                        width: `${Math.min((completedQuizSlots / 1) * 100, 100)}%`,
                        backgroundColor: '#2563EB',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.missionProgressText}>{completedQuizSlots}/1</Text>
              </View>
            </View>
            {claimedMissions['quiz'] ? (
              <View style={styles.claimedPill}>
                <Ionicons name="checkmark" size={13} color={COLORS.success} />
                <Text style={styles.claimedPillText}>Claimed</Text>
              </View>
            ) : isQuizMissionDone ? (
              <TouchableOpacity
                style={styles.claimButton}
                activeOpacity={0.8}
                disabled={claimingMission === 'quiz'}
                onPress={() => handleClaimMission('quiz', 15)}
              >
                {claimingMission === 'quiz' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.claimButtonText}>Claim</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.8}
                onPress={() => router.push('/daily-quiz' as any)}
              >
                <Text style={styles.actionButtonText}>Play</Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Mission 3: ASL Vocabulary Practice */}
          <View style={styles.missionCard}>
            <View style={[styles.missionIconBox, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="albums" size={22} color={COLORS.aslTeal} />
            </View>
            <View style={styles.missionContent}>
              <View style={styles.missionTitleRow}>
                <Text style={styles.missionTitle}>Sign Flashcards</Text>
                <View style={styles.rewardTag}>
                  <Ionicons name="star" size={12} color={COLORS.star} />
                  <Text style={styles.rewardTagText}>+10</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>Review vocabulary flashcards</Text>
              <View style={styles.missionProgressRow}>
                <View style={styles.missionProgressBarBg}>
                  <View style={[styles.missionProgressBarFill, { width: '40%', backgroundColor: COLORS.aslTeal }]} />
                </View>
                <Text style={styles.missionProgressText}>2/5</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={() => router.push('/flashcards' as any)}
            >
              <Text style={styles.actionButtonText}>Review</Text>
              <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* 4. Daily Quiz Challenge Hub Preview */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Daily Quiz Slots</Text>
            <TouchableOpacity onPress={() => router.push('/daily-quiz' as any)}>
              <Text style={styles.sectionLink}>Open All Quizzes →</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.quizPreviewCard}
            activeOpacity={0.85}
            onPress={() => router.push('/daily-quiz' as any)}
          >
            <View style={styles.quizPreviewHeader}>
              <View style={styles.quizPreviewTitleGroup}>
                <Ionicons name="trophy" size={20} color={COLORS.primary} />
                <Text style={styles.quizPreviewTitle}>Today’s 3 Challenges</Text>
              </View>
              <Text style={styles.quizPreviewScore}>
                {completedQuizSlots} / 3 Completed
              </Text>
            </View>

            {/* 3 Slot Mini Badges */}
            <View style={styles.slotsRow}>
              {/* Easy */}
              <View style={[
                styles.slotPill,
                dailyQuiz?.slots?.[0]?.completed ? styles.slotPillDone : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Easy</Text>
                <Text style={styles.slotPillReward}>+10★</Text>
                <Ionicons
                  name={dailyQuiz?.slots?.[0]?.completed ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={dailyQuiz?.slots?.[0]?.completed ? COLORS.success : COLORS.textSecondary}
                />
              </View>

              {/* Medium */}
              <View style={[
                styles.slotPill,
                dailyQuiz?.slots?.[1]?.completed ? styles.slotPillDone : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Medium</Text>
                <Text style={styles.slotPillReward}>+20★</Text>
                <Ionicons
                  name={dailyQuiz?.slots?.[1]?.completed ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={dailyQuiz?.slots?.[1]?.completed ? COLORS.success : COLORS.textSecondary}
                />
              </View>

              {/* Hard */}
              <View style={[
                styles.slotPill,
                dailyQuiz?.slots?.[2]?.completed ? styles.slotPillDone : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Hard</Text>
                <Text style={styles.slotPillReward}>+30★</Text>
                <Ionicons
                  name={dailyQuiz?.slots?.[2]?.completed ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={dailyQuiz?.slots?.[2]?.completed ? COLORS.success : COLORS.textSecondary}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* 5. Milestone Trophy Showcase */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Trophy Showcase</Text>
            <TouchableOpacity onPress={() => router.push('/badges' as any)}>
              <Text style={styles.sectionLink}>
                {unlockedBadgesCount} / {badges.length} Unlocked →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trophyGrid}>
            {badges.slice(0, 4).map(badge => (
              <View
                key={badge.id}
                style={[
                  styles.trophyCard,
                  badge.unlocked ? styles.trophyCardUnlocked : styles.trophyCardLocked
                ]}
              >
                <View style={[
                  styles.trophyIconSquircle,
                  badge.unlocked
                    ? { backgroundColor: `${badge.color}15`, borderColor: badge.color }
                    : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }
                ]}>
                  <Ionicons
                    name={badge.icon as any}
                    size={24}
                    color={badge.unlocked ? badge.color : '#94A3B8'}
                  />
                </View>
                <Text style={[styles.trophyTitle, !badge.unlocked && { color: '#94A3B8' }]} numberOfLines={1}>
                  {badge.title}
                </Text>
                <Text style={styles.trophyDesc} numberOfLines={2}>
                  {badge.description}
                </Text>
                {badge.unlocked ? (
                  <View style={styles.badgeUnlockedBadge}>
                    <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
                    <Text style={styles.badgeUnlockedText}>Earned</Text>
                  </View>
                ) : (
                  <View style={styles.badgeLockedBadge}>
                    <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                    <Text style={styles.badgeLockedText}>Locked</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // Anti-glare Slate-50 canvas
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statPillStars: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.starBg,
    borderColor: COLORS.starBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  statPillStarsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  statPillStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.streakBg,
    borderColor: COLORS.streakBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  statPillStreakText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.streak,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  // Streak Banner
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  streakBannerActive: {
    borderColor: COLORS.streakBorder,
    backgroundColor: '#FFF7ED',
  },
  streakBannerBroken: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  streakIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  streakDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  repairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.streak,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  repairButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    color: COLORS.primary,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Mission Card
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  missionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missionContent: {
    flex: 1,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.starBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  rewardTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  missionDesc: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  missionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  missionProgressBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  missionProgressBarFill: {
    height: 5,
    borderRadius: 3,
  },
  missionProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  claimButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginLeft: 8,
  },
  claimButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  claimedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 3,
    marginLeft: 8,
  },
  claimedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Quiz Preview Card
  quizPreviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  quizPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizPreviewTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quizPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  quizPreviewScore: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  slotPillDone: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  slotPillPending: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.border,
  },
  slotPillLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  slotPillReward: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  // Trophy Grid
  trophyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trophyCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  trophyCardUnlocked: {
    borderColor: COLORS.primaryBorder,
  },
  trophyCardLocked: {
    borderColor: COLORS.border,
    opacity: 0.75,
  },
  trophyIconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trophyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  trophyDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 8,
  },
  badgeUnlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  badgeUnlockedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.success,
  },
  badgeLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  badgeLockedText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
