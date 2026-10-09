import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from 'expo-haptics';
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";
import { COLORS } from "../../context/theme";
import { getCachedTopicLessons, getCachedStudentProgress } from "../../context/OfflineCache";

// --- Types -------------------------------------------------------------------

interface Slide {
  slide_index: number;
  description_text: string;
  image_url?: string;
}

interface DBLesson {
  id: number;
  topic_id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  slides: Slide[];
  quiz_id?: number;
}

const THEME_COLORS: Record<string, { primary: string; light: string; border: string }> = {
  'story-grammar': { primary: COLORS.storyGrammar, light: COLORS.storyGrammarBg, border: '#DDD6FE' },
  'mathematics': { primary: COLORS.mathematics, light: COLORS.mathematicsBg, border: '#BFDBFE' },
  'technology-and-livelihood-education': { primary: COLORS.tle, light: COLORS.tleBg, border: '#FDE68A' },
  'araling-panlipunan': { primary: COLORS.aralingPanlipunan, light: COLORS.aralingPanlipunanBg, border: '#A7F3D0' },
};

// DHH Story Grammar signposts for narrative structure
const getStoryGrammarBadge = (index: number) => {
  switch (index) {
    case 0:
      return {
        label: "Character & Setting",
        icon: "person" as const,
        color: COLORS.primary,
        bgColor: COLORS.primaryLight,
      };
    case 1:
      return {
        label: "Problem & Challenge",
        icon: "alert-circle" as const,
        color: "#D97706",
        bgColor: "#FEF3C7",
      };
    case 2:
      return {
        label: "Action & Rules",
        icon: "construct" as const,
        color: "#2563EB",
        bgColor: "#EFF6FF",
      };
    default:
      return {
        label: "Resolution & Outcome",
        icon: "checkmark-circle" as const,
        color: "#059669",
        bgColor: "#ECFDF5",
      };
  }
};

export default function DifficultyScreen() {
  const { id: lessonGroupId, subjectId, topicId, deafEnglish: deafEngParam } = useLocalSearchParams();
  const theme = THEME_COLORS[topicId as string] || THEME_COLORS[subjectId as string] || THEME_COLORS['story-grammar'];
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [isDeafEnglish, setIsDeafEnglish] = useState<boolean>(deafEngParam === 'true');
  const [lessonsMap, setLessonsMap] = useState<Record<string, DBLesson>>({});
  const [groupTitle, setGroupTitle] = useState('');
  const [progress, setProgress] = useState<{
    easy_passed: boolean;
    medium_passed: boolean;
    hard_passed: boolean;
    easy_best_score: number;
    medium_best_score: number;
    hard_best_score: number;
  }>({
    easy_passed: false,
    medium_passed: false,
    hard_passed: false,
    easy_best_score: 0,
    medium_best_score: 0,
    hard_best_score: 0,
  });
  const [loading, setLoading] = useState(true);

  // Interactive slide modal state
  const [activeLesson, setActiveLesson] = useState<DBLesson | null>(null);
  const [activeDescIndex, setActiveDescIndex] = useState<number>(0);

  // ASL translation state for slide reader
  const [aslDrawerVisible, setAslDrawerVisible] = useState(false);
  const [aslResult, setAslResult] = useState('');
  const [aslLoading, setAslLoading] = useState(false);

  const handleAslTranslate = async () => {
    const currentSlide = activeLesson?.slides[activeDescIndex];
    const textToTranslate = currentSlide?.description_text || '';
    if (!textToTranslate) return;
    setAslLoading(true);
    setAslResult('');
    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, direction: 'en_to_asl' }),
      });
      const data = await res.json();
      setAslResult(data.result?.trim() || `[ASL version]: "${textToTranslate}"`);
    } catch {
      setAslResult('Could not connect to translation server.');
    } finally {
      setAslLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch lesson group content
      const res = await fetch(`${API_URL}/lessons/${topicId}`);
      if (res.ok) {
        const groups = await res.json();
        const foundGroup = groups.find((g: any) => g.id === Number(lessonGroupId));
        if (foundGroup) {
          setGroupTitle(foundGroup.title);
          const map: Record<string, DBLesson> = {};
          (foundGroup.lessons || []).forEach((l: DBLesson) => {
            map[l.difficulty] = l;
          });
          setLessonsMap(map);
        }
      }

      // 2. Fetch student progress
      const progRes = await fetch(`${API_URL}/student/${userId}/profile/${topicId}`);
      if (progRes.ok) {
        const progData = await progRes.json();
        if (progData.lesson_progress) {
          const found = progData.lesson_progress.find((p: any) => p.lesson_group_id === Number(lessonGroupId));
          if (found) {
            setProgress(found);
          }
        }
      }
    } catch (err) {
      console.log("Error fetching difficulty data, falling back to cache (offline):", err);
      try {
        const cachedGroups = await getCachedTopicLessons(topicId as string);
        if (cachedGroups) {
          const foundGroup = cachedGroups.find((g: any) => g.id === Number(lessonGroupId));
          if (foundGroup) {
            setGroupTitle(foundGroup.title);
            const map: Record<string, DBLesson> = {};
            (foundGroup.lessons || []).forEach((l: DBLesson) => {
              map[l.difficulty] = l;
            });
            setLessonsMap(map);
          }
        }
        const cachedProg = await getCachedStudentProgress(userId, topicId as string);
        if (cachedProg) {
          const progList = Array.isArray(cachedProg) ? cachedProg : Object.values(cachedProg);
          const found = progList.find((p: any) => p.lesson_group_id === Number(lessonGroupId));
          if (found) {
            setProgress(found);
          }
        }
      } catch (cacheErr) {
        console.log("Error reading difficulty cache:", cacheErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lessonGroupId && topicId) {
      fetchData();
    }
  }, [lessonGroupId, topicId, userId]);

  // Slide animation values for smooth horizontal transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;

  const handleOpenDifficulty = (diff: 'easy' | 'medium' | 'hard') => {
    const lesson = lessonsMap[diff];
    if (!lesson) return;
    setActiveLesson(lesson);
    setActiveDescIndex(0);
    slideAnim.setValue(0);
    slideOpacity.setValue(1);
  };

  const handleNextSlide = () => {
    if (!activeLesson || activeDescIndex >= activeLesson.slides.length - 1) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -35, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setActiveDescIndex(prev => prev + 1);
      slideAnim.setValue(35);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideOpacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    });
  };

  const handlePrevSlide = () => {
    if (!activeLesson || activeDescIndex <= 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 35, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setActiveDescIndex(prev => prev - 1);
      slideAnim.setValue(-35);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideOpacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    });
  };

  const currentSlide = activeLesson?.slides?.[activeDescIndex];
  const slideText = currentSlide
    ? isDeafEnglish
      ? currentSlide.description_text.toUpperCase()
      : currentSlide.description_text
    : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ marginTop: 10, color: COLORS.textSecondary, fontWeight: '500' }}>
            Loading lesson tiers...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isUnlocked = (diff: 'easy' | 'medium' | 'hard') => {
    if (diff === 'easy') return true;
    if (diff === 'medium') return progress.easy_passed;
    if (diff === 'hard') return progress.medium_passed;
    return false;
  };

  const getBestScore = (diff: 'easy' | 'medium' | 'hard') => {
    if (diff === 'easy') return progress.easy_best_score;
    if (diff === 'medium') return progress.medium_best_score;
    if (diff === 'hard') return progress.hard_best_score;
    return 0;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.light }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupTitle || "Select Difficulty"}</Text>
          <Text style={styles.headerSub}>Choose your challenge tier</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. Difficulty Tier Selector Cards */}
        {(['easy', 'medium', 'hard'] as const).map(diff => {
          const unlocked = isUnlocked(diff);
          const lessonExists = !!lessonsMap[diff];
          const best = getBestScore(diff);
          const isPassed = diff === 'easy' ? progress.easy_passed : diff === 'medium' ? progress.medium_passed : progress.hard_passed;

          const diffConfig = {
            easy: { label: 'Easy Tier', color: COLORS.easy, bg: COLORS.easyBg, border: COLORS.easyBorder, icon: 'shield-checkmark' as const },
            medium: { label: 'Medium Tier', color: COLORS.medium, bg: COLORS.mediumBg, border: COLORS.mediumBorder, icon: 'flash' as const },
            hard: { label: 'Hard Tier', color: COLORS.hard, bg: COLORS.hardBg, border: COLORS.hardBorder, icon: 'trophy' as const },
          }[diff];

          return (
            <TouchableOpacity
              key={diff}
              style={[
                styles.diffCard,
                { borderColor: unlocked ? diffConfig.border : COLORS.border },
                !unlocked && styles.diffCardLocked,
                !lessonExists && styles.diffCardMissing,
              ]}
              disabled={!unlocked || !lessonExists}
              activeOpacity={0.8}
              onPress={() => handleOpenDifficulty(diff)}
            >
              <View style={styles.cardHeader}>
                <View style={[
                  styles.cardIconBox,
                  { backgroundColor: unlocked ? diffConfig.bg : '#F1F5F9' }
                ]}>
                  <Ionicons
                    name={!unlocked ? "lock-closed" : diffConfig.icon}
                    size={26}
                    color={!unlocked ? COLORS.textMuted : diffConfig.color}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={styles.cardTitle}>{diffConfig.label}</Text>
                    {isPassed ? (
                      <View style={styles.passedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                        <Text style={styles.passedBadgeText}>Passed ({best}%)</Text>
                      </View>
                    ) : diff === 'easy' && !progress.easy_passed ? (
                      <View style={styles.recommendedBadge}>
                        <Ionicons name="star" size={11} color="#B45309" />
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.cardSub}>
                    {!lessonExists
                      ? "Not available yet (Slides in development)"
                      : !unlocked
                      ? diff === 'medium'
                        ? "Score 70%+ on Easy to unlock"
                        : "Score 70%+ on Medium to unlock"
                      : isPassed
                      ? "Tap to review story slides and quiz"
                      : "Tap to read lesson slides and take quiz"}
                  </Text>
                </View>

                {unlocked && lessonExists && (
                  <Ionicons name="arrow-forward" size={18} color={diffConfig.color} style={{ marginLeft: 6 }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. DHH Interactive Slide Reader Modal */}
      {activeLesson && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!activeLesson}
          onRequestClose={() => setActiveLesson(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: theme.light }]}
                onPress={() => setActiveLesson(null)}
              >
                <Ionicons name="close" size={22} color={theme.primary} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {groupTitle}
                </Text>
                <Text style={styles.headerSub}>
                  {activeLesson.difficulty.toUpperCase()} TIER • SLIDE {activeDescIndex + 1} OF {activeLesson.slides.length}
                </Text>
              </View>
            </View>

            <View style={styles.readerContent}>
              {/* Progress Dots Track */}
              <View style={styles.dotsRow}>
                {activeLesson.slides.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      i === activeDescIndex ? [styles.progressDotActive, { backgroundColor: theme.primary }] : null
                    ]}
                  />
                ))}
              </View>

              {/* High-Contrast Slide Card */}
              <Animated.View style={[styles.flipCard, { transform: [{ translateX: slideAnim }], opacity: slideOpacity }]}>
                {/* Story Grammar Signpost Badge */}
                {(() => {
                  const badge = getStoryGrammarBadge(activeDescIndex);
                  return (
                    <View style={[styles.narrativeBadge, { backgroundColor: badge.bgColor }]}>
                      <Ionicons name={badge.icon} size={15} color={badge.color} />
                      <Text style={[styles.narrativeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  );
                })()}

                <ScrollView contentContainerStyle={styles.cardScrollView} showsVerticalScrollIndicator={false}>
                  {currentSlide?.image_url ? (
                    <View style={styles.imageWrapper}>
                      <Image source={{ uri: currentSlide.image_url }} style={styles.slideImage} resizeMode="contain" />
                    </View>
                  ) : null}
                  <Text style={styles.cardText}>{slideText}</Text>
                </ScrollView>

                <Text style={styles.cardCounter}>
                  Slide {activeDescIndex + 1} of {activeLesson.slides.length}
                </Text>
              </Animated.View>

              {/* Reader Navigation Footer */}
              <View style={styles.actionsFooter}>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: theme.light }, activeDescIndex === 0 && styles.navBtnDisabled]}
                  disabled={activeDescIndex === 0}
                  onPress={handlePrevSlide}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={20} color={activeDescIndex === 0 ? COLORS.textMuted : theme.primary} />
                  <Text style={[styles.navBtnText, { color: theme.primary }, activeDescIndex === 0 && styles.navBtnTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                {activeDescIndex < activeLesson.slides.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: theme.light }]}
                    onPress={handleNextSlide}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.navBtnText, { color: theme.primary }]}>Next</Text>
                    <Ionicons name="arrow-forward" size={20} color={theme.primary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.quizStartBtn}
                    onPress={() => {
                      const qId = activeLesson.quiz_id;
                      setActiveLesson(null);
                      router.push(`/quiz/${topicId}?subjectId=${subjectId}&deafEnglish=${isDeafEnglish}&lessonId=${activeLesson.id}&quizId=${qId || ''}&difficulty=${activeLesson.difficulty}` as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="pencil" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.quizStartBtnText}>Start Quiz</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Floating ASL Helper Button */}
            <TouchableOpacity
              style={styles.aslFloatBtn}
              activeOpacity={0.85}
              onPress={() => { setAslDrawerVisible(true); setAslResult(''); }}
            >
              <Ionicons name="hand-left" size={20} color="#FFFFFF" />
              <Text style={styles.aslFloatBtnText}>ASL Helper</Text>
            </TouchableOpacity>

            {/* ASL / Deaf English Slide Helper Drawer Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={aslDrawerVisible}
              onRequestClose={() => setAslDrawerVisible(false)}
            >
              <View style={styles.aslDrawerOverlay}>
                <View style={styles.aslDrawerContent}>
                  {/* Header row */}
                  <View style={styles.aslHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="language" size={20} color={COLORS.primary} />
                      <Text style={styles.aslDrawerTitle}>ASL / Deaf English Helper</Text>
                    </View>
                    <TouchableOpacity onPress={() => setAslDrawerVisible(false)}>
                      <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Original slide text */}
                  <View style={styles.aslOriginalBox}>
                    <Text style={styles.aslOriginalLabel}>ENGLISH SLIDE TEXT</Text>
                    <Text style={styles.aslOriginalText}>
                      {slideText || 'No slide text.'}
                    </Text>
                  </View>

                  {/* Loading indicator */}
                  {aslLoading && (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <ActivityIndicator color={COLORS.primary} />
                      <Text style={{ marginTop: 6, fontSize: 12, color: COLORS.textSecondary }}>Translating to ASL structure...</Text>
                    </View>
                  )}

                  {/* Translation result */}
                  {!!aslResult && !aslLoading && (
                    <View style={styles.aslResultBox}>
                      <Text style={styles.aslResultLabel}>ASL GLOSS / DEAF ENGLISH STRUCTURE</Text>
                      <Text style={styles.aslResultText}>{aslResult}</Text>
                    </View>
                  )}

                  {/* Translate button */}
                  <TouchableOpacity
                    onPress={handleAslTranslate}
                    style={styles.aslTranslateBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="language" size={18} color="#FFFFFF" />
                    <Text style={styles.aslTranslateBtnText}>Translate Slide</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </SafeAreaView>
        </Modal>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Tier Cards
  diffCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  diffCardLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.border,
    opacity: 0.75,
  },
  diffCardMissing: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSub: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.starBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendedBadgeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
  },
  passedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  passedBadgeText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '700',
  },
  // Slide Reader Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  readerContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  progressDotActive: {
    width: 20,
    borderRadius: 4,
  },
  flipCard: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  narrativeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 12,
  },
  narrativeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  imageWrapper: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  cardScrollView: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardText: {
    fontSize: 19,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardCounter: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  actionsFooter: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 6,
  },
  navBtnDisabled: {
    backgroundColor: '#F1F5F9',
  },
  navBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  navBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  quizStartBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  quizStartBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  aslFloatBtn: {
    position: 'absolute',
    bottom: 80,
    right: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    gap: 6,
  },
  aslFloatBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  aslDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  aslDrawerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  aslHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aslDrawerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  aslOriginalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  aslOriginalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  aslOriginalText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  aslResultBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  aslResultLabel: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  aslResultText: {
    fontSize: 14.5,
    color: COLORS.textPrimary,
    lineHeight: 21,
    fontWeight: '600',
  },
  aslTranslateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 8,
  },
  aslTranslateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
