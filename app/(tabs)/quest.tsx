import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../context/config';
import { COLORS } from '../../context/theme';
import { useAccessibility } from '../../context/AccessibilityContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLocalTotalStars,
  saveLocalTotalStars,
  addLocalStars,
  getCachedHomeSummary,
} from '../../context/OfflineCache';
import Confetti from '../../components/Confetti';

// --- Interfaces ---------------------------------------------------------------

interface DailySlot {
  slot_difficulty: 'easy' | 'medium' | 'hard';
  quiz_id: number | null;
  quiz_title: string | null;
  completed: boolean;
  stars_earned: number | null;
  is_locked?: boolean;
  lock_reason?: string;
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

export default function QuestTabScreen() {
  const { user } = useAuth() as any;
  const { highContrast } = useAccessibility();
  const userId = user?.id || 1;

  const [totalStars, setTotalStars] = useState<number>(0);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [dailyQuiz, setDailyQuiz] = useState<DailyQuizResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairingStreak, setRepairingStreak] = useState<boolean>(false);
  const [claimedMissions, setClaimedMissions] = useState<Record<string, boolean>>({});
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState<string>('');
  const [storyReadDone, setStoryReadDone] = useState<boolean>(false);
  const [flashcardsDoneCount, setFlashcardsDoneCount] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [topicProgress, setTopicProgress] = useState<Record<string, { progress: number; stars: number; attempts: number }>>({});
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  const getLocalDateString = useCallback(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Fetch all student gamification data
  const loadData = useCallback(async () => {
    try {
      const todayStr = getLocalDateString();

      // 1. Read local offline activity & cached stats immediately (instant non-zero UI)
      const [localFlashcardRaw, localStoryRaw, localClaimedRaw, cachedStars, cachedHome] = await Promise.all([
        AsyncStorage.getItem(`@dhh_flashcards_count_${todayStr}`).catch(() => '0'),
        AsyncStorage.getItem(`@dhh_story_read_${todayStr}`).catch(() => null),
        AsyncStorage.getItem(`@brightpath_claimed_missions_${userId}_${todayStr}`).catch(() => null),
        getLocalTotalStars(userId),
        getCachedHomeSummary(userId),
      ]);

      const localFc = parseInt(localFlashcardRaw || '0', 10) || 0;
      setFlashcardsDoneCount(localFc);
      let isStoryDone = localStoryRaw === 'true';

      const localClaimed: Record<string, boolean> = localClaimedRaw ? JSON.parse(localClaimedRaw) : {};
      setClaimedMissions(localClaimed);

      if (cachedStars > 0) {
        setTotalStars(cachedStars);
      } else if (cachedHome?.total_stars !== undefined) {
        setTotalStars(cachedHome.total_stars);
      }

      if (cachedHome?.topics) {
        const map: Record<string, { progress: number; stars: number; attempts: number }> = {};
        if (Array.isArray(cachedHome.topics)) {
          cachedHome.topics.forEach((t: any) => {
            map[t.topic_id] = {
              progress: t.progress_pct ?? t.progress ?? 0,
              stars: t.stars_earned ?? t.stars ?? 0,
              attempts: t.attempts ?? 0,
            };
          });
        } else if (typeof cachedHome.topics === 'object') {
          Object.entries(cachedHome.topics).forEach(([tid, t]: [string, any]) => {
            map[tid] = {
              progress: t.progress_pct ?? t.progress ?? 0,
              stars: t.stars_earned ?? t.stars ?? 0,
              attempts: t.attempts ?? 0,
            };
          });
        }
        setTopicProgress(map);
      }

      if (cachedHome?.current_streak !== undefined) {
        setStreak(prev => prev || {
          current_streak: cachedHome.current_streak,
          can_repair: false,
          streak_broken: false,
        });
      }

      // 2. Fetch server gamification data
      const [streakRes, quizRes, summaryRes, missionsRes] = await Promise.all([
        fetch(`${API_URL}/student/${userId}/streak?client_date=${todayStr}`).catch(() => null),
        fetch(`${API_URL}/daily-quizzes/${userId}?client_date=${todayStr}`).catch(() => null),
        fetch(`${API_URL}/student/${userId}/home-summary`).catch(() => null),
        fetch(`${API_URL}/student/${userId}/daily-missions?client_date=${todayStr}`).catch(() => null),
      ]);

      if (streakRes?.ok) {
        const sData = await streakRes.json();
        setStreak(sData);
      }
      if (quizRes?.ok) {
        const qData = await quizRes.json();
        setDailyQuiz(qData);
      }
      if (missionsRes?.ok) {
        const mData = await missionsRes.json();
        const serverClaimed = mData.claimed_missions || {};
        // Merge local and server claimed missions so claimed status is permanently preserved
        const mergedClaimed = { ...localClaimed, ...serverClaimed };
        setClaimedMissions(mergedClaimed);
        AsyncStorage.setItem(`@brightpath_claimed_missions_${userId}_${todayStr}`, JSON.stringify(mergedClaimed)).catch(() => {});

        if (mData.progress?.story >= 1) {
          isStoryDone = true;
        }
        if (mData.total_stars !== undefined && mData.total_stars > 0) {
          setTotalStars(mData.total_stars);
          saveLocalTotalStars(userId, mData.total_stars).catch(() => {});
        }
      }
      setStoryReadDone(isStoryDone);
      if (summaryRes?.ok) {
        const sumData = await summaryRes.json();
        if (sumData.total_stars !== undefined) {
          setTotalStars(sumData.total_stars);
          saveLocalTotalStars(userId, sumData.total_stars).catch(() => {});
        }
        if (sumData.topics) {
          const map: Record<string, { progress: number; stars: number; attempts: number }> = {};
          if (Array.isArray(sumData.topics)) {
            sumData.topics.forEach((t: any) => {
              map[t.topic_id] = {
                progress: t.progress_pct ?? t.progress ?? 0,
                stars: t.stars_earned ?? t.stars ?? 0,
                attempts: t.attempts ?? 0,
              };
            });
          } else if (typeof sumData.topics === 'object') {
            Object.entries(sumData.topics).forEach(([tid, t]: [string, any]) => {
              map[tid] = {
                progress: t.progress_pct ?? t.progress ?? 0,
                stars: t.stars_earned ?? t.stars ?? 0,
                attempts: t.attempts ?? 0,
              };
            });
          }
          setTopicProgress(map);
        }
      }
    } catch (err) {
      console.log('Error loading quest data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, getLocalDateString]);

  // 12 Midnight countdown timer with dynamic day rollover refresh
  useEffect(() => {
    let lastDate = getLocalDateString();
    const updateCountdown = () => {
      const now = new Date();
      const currentDate = getLocalDateString();
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        // Clean up in-memory daily counters for the fresh day
        setStoryReadDone(false);
        setFlashcardsDoneCount(0);
        setClaimedMissions({});
        setDailyQuiz(null);
        loadData();
      }
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTimeUntilMidnight('00:00:00');
        setStoryReadDone(false);
        setFlashcardsDoneCount(0);
        setClaimedMissions({});
        setDailyQuiz(null);
        loadData();
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
  }, [getLocalDateString, loadData]);

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

    // Trigger celebratory confetti burst
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    setShowConfetti(true);
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 3500);

    const todayStr = getLocalDateString();
    const updatedClaimed = { ...claimedMissions, [missionId]: true };

    // Optimistic UI update & immediate local persistence
    setClaimedMissions(updatedClaimed);
    await AsyncStorage.setItem(`@brightpath_claimed_missions_${userId}_${todayStr}`, JSON.stringify(updatedClaimed)).catch(() => {});
    await addLocalStars(userId, starsReward);
    setTotalStars(prev => prev + starsReward);

    try {
      const res = await fetch(`${API_URL}/student/${userId}/daily-missions/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: missionId,
          stars_reward: starsReward,
          client_date: todayStr,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.total_stars !== undefined) {
          setTotalStars(data.total_stars);
          await saveLocalTotalStars(userId, data.total_stars);
        }
      }
    } catch (err) {
      console.log('Error claiming mission on server (retained offline):', err);
    } finally {
      setClaimingMission(null);
    }
  };

  const handleStoryExplorerPress = () => {
    // Determine which core subject the student has taken the least
    const coreSubjects = [
      'story-grammar',
      'mathematics',
      'technology-and-livelihood-education',
      'araling-panlipunan',
    ];

    const sorted = [...coreSubjects].map(id => {
      const stats = topicProgress[id] || { progress: 0, stars: 0, attempts: 0 };
      return {
        id,
        progress: stats.progress,
        stars: stats.stars,
        attempts: stats.attempts,
        score: (stats.attempts * 10) + stats.progress,
      };
    }).sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      if (a.progress !== b.progress) {
        return a.progress - b.progress;
      }
      return a.stars - b.stars;
    });

    const targetTopicId = sorted[0]?.id || 'story-grammar';
    router.push(`/topic/${targetTopicId}?subjectId=english` as any);
  };

  const completedQuizSlots = dailyQuiz?.completed_count ?? 0;
  const isQuizMissionDone = completedQuizSlots >= 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {showConfetti && <Confetti count={70} />}
      {/* 1. Sleek Compact Header Matching Brand Theme */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, highContrast && { color: '#000000', fontWeight: '900' }]}>Quests & Missions</Text>
          <Text style={[styles.headerSubtitle, highContrast && { color: '#0F172A', fontWeight: '700' }]}>Complete daily quests to earn stars</Text>
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
          <Text style={styles.loadingText}>Loading quests...</Text>
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
                    ? (totalStars >= 30
                        ? 'Streak paused! Tap Repair to restore.'
                        : `Streak paused! Need 30★ to repair (you have ${totalStars}★).`)
                    : 'Streak shield active! Complete 1 quest to extend.'}
                </Text>
              </View>

              {streak.streak_broken && (
                totalStars >= 30 ? (
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
                ) : (
                  <TouchableOpacity
                    style={[styles.repairButton, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.alert(`Streak Repair requires 30 stars. You currently have ${totalStars} stars (${30 - totalStars} more needed). Complete quizzes or daily missions to earn stars!`);
                      } else {
                        // React Native mobile
                        import('react-native').then(({ Alert }) => {
                          Alert.alert('Streak Repair', `Streak Repair requires 30 stars.\n\nYou currently have ${totalStars} stars (${30 - totalStars} more needed).\n\nComplete quizzes or daily missions to earn stars!`);
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="lock-closed" size={13} color="#64748B" />
                    <Text style={[styles.repairButtonText, { color: '#64748B' }]}>{totalStars}/30★</Text>
                  </TouchableOpacity>
                )
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
                  <View style={[styles.missionProgressBarFill, { width: `${storyReadDone ? 100 : 0}%`, backgroundColor: COLORS.primary }]} />
                </View>
                <Text style={styles.missionProgressText}>{storyReadDone ? '1' : '0'}/1</Text>
              </View>
            </View>
            {claimedMissions['story'] ? (
              <View style={styles.claimedPill}>
                <Ionicons name="checkmark" size={13} color={COLORS.success} />
                <Text style={styles.claimedPillText}>Claimed</Text>
              </View>
            ) : storyReadDone ? (
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
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.8}
                onPress={handleStoryExplorerPress}
              >
                <Text style={styles.actionButtonText}>Read</Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
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
              <Text style={styles.missionDesc}>Review vocabulary flashcards (5 cards)</Text>
              <View style={styles.missionProgressRow}>
                <View style={styles.missionProgressBarBg}>
                  <View style={[styles.missionProgressBarFill, { width: `${Math.min((flashcardsDoneCount / 5) * 100, 100)}%`, backgroundColor: COLORS.aslTeal }]} />
                </View>
                <Text style={styles.missionProgressText}>{Math.min(flashcardsDoneCount, 5)}/5</Text>
              </View>
            </View>
            {claimedMissions['flashcards'] ? (
              <View style={styles.claimedPill}>
                <Ionicons name="checkmark" size={13} color={COLORS.success} />
                <Text style={styles.claimedPillText}>Claimed</Text>
              </View>
            ) : flashcardsDoneCount >= 5 ? (
              <TouchableOpacity
                style={styles.claimButton}
                activeOpacity={0.8}
                disabled={claimingMission === 'flashcards'}
                onPress={() => handleClaimMission('flashcards', 10)}
              >
                {claimingMission === 'flashcards' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.claimButtonText}>Claim</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.8}
                onPress={() => router.push('/flashcards' as any)}
              >
                <Text style={styles.actionButtonText}>Review</Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            )}
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
                dailyQuiz?.slots?.[0]?.completed
                  ? styles.slotPillDone
                  : dailyQuiz?.slots?.[0]?.is_locked
                  ? [styles.slotPillPending, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]
                  : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Easy</Text>
                <Text style={styles.slotPillReward}>+10★</Text>
                <Ionicons
                  name={
                    dailyQuiz?.slots?.[0]?.completed
                      ? 'checkmark-circle'
                      : dailyQuiz?.slots?.[0]?.is_locked
                      ? 'lock-closed'
                      : 'time-outline'
                  }
                  size={14}
                  color={
                    dailyQuiz?.slots?.[0]?.completed
                      ? COLORS.success
                      : dailyQuiz?.slots?.[0]?.is_locked
                      ? '#94A3B8'
                      : COLORS.textSecondary
                  }
                />
              </View>

              {/* Medium */}
              <View style={[
                styles.slotPill,
                dailyQuiz?.slots?.[1]?.completed
                  ? styles.slotPillDone
                  : dailyQuiz?.slots?.[1]?.is_locked
                  ? [styles.slotPillPending, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]
                  : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Medium</Text>
                <Text style={styles.slotPillReward}>+20★</Text>
                <Ionicons
                  name={
                    dailyQuiz?.slots?.[1]?.completed
                      ? 'checkmark-circle'
                      : dailyQuiz?.slots?.[1]?.is_locked
                      ? 'lock-closed'
                      : 'time-outline'
                  }
                  size={14}
                  color={
                    dailyQuiz?.slots?.[1]?.completed
                      ? COLORS.success
                      : dailyQuiz?.slots?.[1]?.is_locked
                      ? '#94A3B8'
                      : COLORS.textSecondary
                  }
                />
              </View>

              {/* Hard */}
              <View style={[
                styles.slotPill,
                dailyQuiz?.slots?.[2]?.completed
                  ? styles.slotPillDone
                  : dailyQuiz?.slots?.[2]?.is_locked
                  ? [styles.slotPillPending, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]
                  : styles.slotPillPending
              ]}>
                <Text style={styles.slotPillLabel}>Hard</Text>
                <Text style={styles.slotPillReward}>+30★</Text>
                <Ionicons
                  name={
                    dailyQuiz?.slots?.[2]?.completed
                      ? 'checkmark-circle'
                      : dailyQuiz?.slots?.[2]?.is_locked
                      ? 'lock-closed'
                      : 'time-outline'
                  }
                  size={14}
                  color={
                    dailyQuiz?.slots?.[2]?.completed
                      ? COLORS.success
                      : dailyQuiz?.slots?.[2]?.is_locked
                      ? '#94A3B8'
                      : COLORS.textSecondary
                  }
                />
              </View>
            </View>
          </TouchableOpacity>

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
    paddingBottom: 80,
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
});
