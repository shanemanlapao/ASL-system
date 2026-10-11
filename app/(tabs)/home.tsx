import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import PermissionModal from '../../components/PermissionModal';
import { useSubjects } from '../../context/SubjectsContext';
import { API_URL } from '../../context/config';
import { COLORS } from '../../context/theme';
import {
  cacheHomeSummary,
  getCachedHomeSummary,
  syncPendingQuizzes,
  getPendingQuizzes,
} from '../../context/OfflineCache';

// Helper to get consistent subject theme tokens
const getSubjectTheme = (topicId: string) => {
  switch (topicId) {
    case 'story-grammar':
      return {
        color: COLORS.storyGrammar,
        bg: COLORS.storyGrammarBg,
        icon: 'book' as const,
      };
    case 'mathematics':
      return {
        color: COLORS.mathematics,
        bg: COLORS.mathematicsBg,
        icon: 'shapes' as const,
      };
    case 'technology-and-livelihood-education':
      return {
        color: COLORS.tle,
        bg: COLORS.tleBg,
        icon: 'videocam' as const,
      };
    case 'araling-panlipunan':
      return {
        color: COLORS.aralingPanlipunan,
        bg: COLORS.aralingPanlipunanBg,
        icon: 'globe' as const,
      };
    default:
      return {
        color: COLORS.primary,
        bg: COLORS.primaryLight,
        icon: 'book' as const,
      };
  }
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const displayName = user?.name ?? 'Student';
  const userId = user?.id || 1;
  const initial = displayName.charAt(0).toUpperCase() || 'S';

  const [totalStars, setTotalStars] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [topicProgress, setTopicProgress] = useState<{ [topicId: string]: { stars: number; progress: number } }>({});
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Subtle flame pulse animation for active streak
  const flameAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const flameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1.15,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flameAnim, {
          toValue: 0.95,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flameAnim, {
          toValue: 1.1,
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

  const fetchHomeSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/home-summary`);
      if (res.ok) {
        const data = await res.json();
        setIsOffline(false);
        setTotalStars(data.total_stars ?? 0);
        setStreak(data.current_streak ?? 0);

        if (data.topics) {
          const map: { [topicId: string]: { stars: number; progress: number } } = {};
          if (Array.isArray(data.topics)) {
            data.topics.forEach((t: any) => {
              map[t.topic_id] = { stars: t.stars_earned ?? t.stars ?? 0, progress: t.progress_pct ?? t.progress ?? 0 };
            });
          } else if (typeof data.topics === 'object') {
            Object.entries(data.topics).forEach(([topicId, t]: [string, any]) => {
              map[topicId] = { stars: t.stars_earned ?? t.stars ?? 0, progress: t.progress_pct ?? t.progress ?? 0 };
            });
          }
          setTopicProgress(map);
        }

        // Cache summary for offline access
        await cacheHomeSummary(userId, data);
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.log('Using cached home summary (offline):', err);
      setIsOffline(true);
      const cached = await getCachedHomeSummary(userId);
      if (cached) {
        setTotalStars(cached.total_stars ?? 0);
        setStreak(cached.current_streak ?? 0);
        if (cached.topics) {
          const map: { [topicId: string]: { stars: number; progress: number } } = {};
          if (Array.isArray(cached.topics)) {
            cached.topics.forEach((t: any) => {
              map[t.topic_id] = { stars: t.stars_earned ?? t.stars ?? 0, progress: t.progress_pct ?? t.progress ?? 0 };
            });
          } else if (typeof cached.topics === 'object') {
            Object.entries(cached.topics).forEach(([topicId, t]: [string, any]) => {
              map[topicId] = { stars: t.stars_earned ?? t.stars ?? 0, progress: t.progress_pct ?? t.progress ?? 0 };
            });
          }
          setTopicProgress(map);
        }
      }
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      const checkAndSync = async () => {
        await fetchHomeSummary();
        const pending = await getPendingQuizzes();
        setPendingCount(pending.length);

        if (pending.length > 0) {
          setIsSyncing(true);
          const syncRes = await syncPendingQuizzes(API_URL);
          setIsSyncing(false);
          if (syncRes.synced > 0) {
            await fetchHomeSummary();
          }
          const remaining = await getPendingQuizzes();
          setPendingCount(remaining.length);
        }
      };

      checkAndSync();
    }, [fetchHomeSummary])
  );

  // Load English subjects category and topics dynamically
  const englishSubject = subjects['english'];
  const categoryName = englishSubject?.categories[0]?.name ?? 'Core Learning Modules';
  const topics = englishSubject?.categories[0]?.topics ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PermissionModal />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* 1. Sleek Compact Header + Stat Badges in a Single Row */}
        <View style={styles.headerRow}>
          <View style={styles.headerUser}>
            <View style={styles.avatarCircle}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View>
              <Text style={styles.greeting}>Hi, {displayName}!</Text>
              <Text style={styles.subGreeting}>Ready to learn today?</Text>
            </View>
          </View>

          {/* Quick Stats Badges on Top Right */}
          <View style={styles.headerBadgesRow}>
            {/* Stars Badge */}
            <TouchableOpacity
              style={styles.statPill}
              activeOpacity={0.8}
              onPress={() => router.push('/badges' as any)}
            >
              <Ionicons name="star" size={15} color={COLORS.star} />
              <Text style={styles.statPillText}>{totalStars}</Text>
            </TouchableOpacity>

            {/* Streak Badge */}
            <TouchableOpacity
              style={styles.statPillStreak}
              activeOpacity={0.8}
              onPress={() => router.push('/leaderboard' as any)}
            >
              <Animated.View style={streak > 0 ? { transform: [{ scale: flameAnim }] } : null}>
                <Ionicons name={streak > 0 ? 'flame' : 'flame-outline'} size={15} color={COLORS.streak} />
              </Animated.View>
              <Text style={styles.statPillStreakText}>{streak}d</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Offline & Sync Status Pill (if active) */}
        {isSyncing ? (
          <View style={styles.syncBadgeViolet}>
            <Ionicons name="sync-outline" size={13} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.syncBadgeTextViolet}>
              Syncing {pendingCount} offline quiz attempt{pendingCount > 1 ? 's' : ''}...
            </Text>
          </View>
        ) : pendingCount > 0 ? (
          <View style={styles.syncBadgeAmber}>
            <Ionicons name="cloud-offline-outline" size={13} color={COLORS.star} style={{ marginRight: 6 }} />
            <Text style={styles.syncBadgeTextAmber}>
              Offline Mode: {pendingCount} attempt{pendingCount > 1 ? 's' : ''} queued
            </Text>
          </View>
        ) : isOffline ? (
          <View style={styles.syncBadgeAmber}>
            <Ionicons name="cloud-offline-outline" size={13} color={COLORS.star} style={{ marginRight: 6 }} />
            <Text style={styles.syncBadgeTextAmber}>Offline Mode: Using cached lesson data</Text>
          </View>
        ) : null}

        {/* 3. Sleek Balanced Quick Tools (Clean White Cards with Soft Tinted Badges) */}
        <View style={styles.quickBar}>
          {/* Daily Quiz */}
          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
            onPress={() => router.push('/daily-quiz' as any)}
          >
            <View style={[styles.quickIconBadge, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="trophy" size={22} color="#7C3AED" />
            </View>
            <Text style={styles.quickCardLabel} numberOfLines={1}>Daily Quiz</Text>
          </TouchableOpacity>

          {/* Flashcards */}
          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
            onPress={() => router.push('/flashcards' as any)}
          >
            <View style={[styles.quickIconBadge, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="albums" size={22} color="#6366F1" />
            </View>
            <Text style={styles.quickCardLabel} numberOfLines={1}>Flashcards</Text>
          </TouchableOpacity>

          {/* Translation */}
          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/translate' as any)}
          >
            <View style={[styles.quickIconBadge, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="language" size={22} color="#0D9488" />
            </View>
            <Text style={styles.quickCardLabel} numberOfLines={1}>Translation</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Core Learning Modules Section (Compact, 100% Above-the-Fold) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>{categoryName}</Text>
          <Text style={styles.sectionSubCount}>{topics.length} Modules</Text>
        </View>

        {/* Dynamic Topic List */}
        {topics.map((topic) => {
          const liveStats = topicProgress[topic.id] || {
            stars: topic.starsEarned || 0,
            progress: topic.progress || 0,
          };
          const progressVal = Math.min(Math.max(liveStats.progress, 0), 100);
          const theme = getSubjectTheme(topic.id);
          const hasProgress = progressVal > 0;

          return (
            <TouchableOpacity
              key={topic.id}
              style={styles.subjectCard}
              activeOpacity={0.75}
              onPress={() => router.push(`/topic/${topic.id}?subjectId=english` as any)}
            >
              <View style={styles.subjectRow}>
                {/* 1. Weighted Solid Icon in Soft Tinted Squircle */}
                <View style={[styles.subjectIconBox, { backgroundColor: theme.bg }]}>
                  <Ionicons name={theme.icon} size={24} color={theme.color} />
                </View>

                {/* 2. Topic Title & Clean Meta */}
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{topic.name}</Text>
                  <View style={styles.subjectMetaRow}>
                    <View style={styles.subjectStars}>
                      <Ionicons name="star" size={12} color={COLORS.star} />
                      <Text style={styles.subjectStarsText}> {liveStats.stars} stars</Text>
                    </View>
                    {hasProgress && (
                      <Text style={[styles.subjectProgressText, { color: theme.color }]}>
                        • {progressVal}% complete
                      </Text>
                    )}
                  </View>
                </View>

                {/* 3. Action Indicator */}
                <View style={styles.actionLink}>
                  <Text style={[styles.actionLinkText, { color: hasProgress ? theme.color : COLORS.textSecondary }]}>
                    {hasProgress ? 'Continue' : 'Start'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={hasProgress ? theme.color : COLORS.textSecondary}
                  />
                </View>
              </View>

              {/* 4. Slim Bottom Accent Progress Line (Only shown when progress > 0) */}
              {hasProgress && (
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressVal}%`, backgroundColor: theme.color },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // Glare-free Slate-50 canvas
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 24,
  },
  // Compact Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.starBg,
    borderWidth: 1,
    borderColor: COLORS.starBorder,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  statPillStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.streakBg,
    borderWidth: 1,
    borderColor: COLORS.streakBorder,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  statPillStreakText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.streak,
  },
  settingsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  syncBadgeViolet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  syncBadgeTextViolet: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  syncBadgeAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.starBg,
    borderWidth: 1,
    borderColor: COLORS.starBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  syncBadgeTextAmber: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.star,
  },
  // Sleek Balanced Quick Tools (Clean White Cards with Soft Tinted Badges)
  quickBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  quickIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSubCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  // Module Cards (Generous & Balanced Size Filling Viewport Elegantly)
  subjectCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 15,
    paddingHorizontal: 14,
    marginBottom: 11,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectStarsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  subjectProgressText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 8,
  },
  actionLinkText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
});
