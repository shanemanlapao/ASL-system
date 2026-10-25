import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";
import { COLORS } from "../context/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AttemptRecord {
  id: number;
  quiz_id: number;
  quiz_title: string;
  topic_id: string;
  difficulty: string;
  score: number;
  total_questions: number;
  accuracy: number;
  time_spent_seconds: number;
  completed_at: string;
}

interface GroupedPastAttempt {
  key: string;
  quiz_title: string;
  topic_id: string;
  difficulty: string;
  totalTries: number;
  bestAccuracy: number;
  bestScore: number;
  totalQuestions: number;
  latestDate: string;
  attempts: AttemptRecord[];
}

export default function PastReportsScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const fetchAttempts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/past-attempts`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.attempts || [];
        setAttempts(list);
      }
    } catch (err) {
      console.log("Error fetching past attempts:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchAttempts();
    }, [fetchAttempts])
  );

  // Group attempts by Quiz Title & Difficulty
  const groupedAttempts: GroupedPastAttempt[] = useMemo(() => {
    if (!attempts || attempts.length === 0) return [];
    const map: Record<string, GroupedPastAttempt> = {};

    for (const att of attempts) {
      const key = `${att.quiz_title}___${att.difficulty}`;
      if (!map[key]) {
        map[key] = {
          key,
          quiz_title: att.quiz_title,
          topic_id: att.topic_id,
          difficulty: att.difficulty,
          totalTries: 0,
          bestAccuracy: typeof att.accuracy === "number" ? att.accuracy : 0,
          bestScore: att.score,
          totalQuestions: att.total_questions,
          latestDate: att.completed_at || "Recent",
          attempts: [],
        };
      }
      map[key].attempts.push(att);
      map[key].totalTries += 1;
      const acc = typeof att.accuracy === "number" ? att.accuracy : 0;
      if (acc > map[key].bestAccuracy) {
        map[key].bestAccuracy = acc;
        map[key].bestScore = att.score;
        map[key].totalQuestions = att.total_questions;
      }
    }

    return Object.values(map);
  }, [attempts]);

  const getDifficultyColor = (diff: string) => {
    const d = (diff || "easy").toLowerCase();
    if (d === "hard") return { text: COLORS.hard, bg: COLORS.hardBg, border: COLORS.hardBorder };
    if (d === "medium") return { text: COLORS.medium, bg: COLORS.mediumBg, border: COLORS.mediumBorder };
    return { text: COLORS.easy, bg: COLORS.easyBg, border: COLORS.easyBorder };
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder > 0 ? `${mins}m ${remainder}s` : `${mins}m`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Past Reports</Text>
          <Text style={styles.headerSub}>Review your completed quiz records</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontWeight: "500" }}>
              Loading past records...
            </Text>
          </View>
        ) : groupedAttempts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Quiz Reports Yet</Text>
            <Text style={styles.emptySub}>
              Complete quizzes from Story Grammar or English Literacy to track your progress and performance here!
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/(tabs)/home" as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Start a Lesson</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <View style={styles.summaryBar}>
              <Text style={styles.summaryBarTitle}>
                {groupedAttempts.length} Unique {groupedAttempts.length === 1 ? "Quiz" : "Quizzes"}
              </Text>
              <Text style={styles.summaryBarSub}>
                {attempts.length} Total Attempts
              </Text>
            </View>

            {groupedAttempts.map((group) => {
              const isExpanded = !!expandedKeys[group.key];
              const diffStyle = getDifficultyColor(group.difficulty);
              const isPassed = group.bestAccuracy >= 70;

              return (
                <View key={group.key} style={styles.groupCard}>
                  {/* Single Accordion Header */}
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(group.key)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quizTitle}>{group.quiz_title}</Text>

                      <View style={styles.badgeRow}>
                        {/* Difficulty */}
                        <View
                          style={[
                            styles.diffBadge,
                            { backgroundColor: diffStyle.bg, borderColor: diffStyle.border },
                          ]}
                        >
                          <Text style={[styles.diffBadgeText, { color: diffStyle.text }]}>
                            {group.difficulty.toUpperCase()}
                          </Text>
                        </View>

                        {/* Total Tries Badge */}
                        <View style={styles.triesBadge}>
                          <Ionicons name="repeat" size={12} color={COLORS.primary} />
                          <Text style={styles.triesBadgeText}>
                            {group.totalTries} {group.totalTries === 1 ? "Try" : "Tries"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Best Score & Chevron */}
                    <View style={styles.scoreRight}>
                      <View style={styles.scoreTextCol}>
                        <Text
                          style={[
                            styles.bestScoreVal,
                            isPassed ? { color: COLORS.success } : { color: COLORS.error },
                          ]}
                        >
                          {group.bestScore}/{group.totalQuestions}
                        </Text>
                        <Text style={styles.bestScoreSub}>{group.bestAccuracy}% Best</Text>
                      </View>

                      <View style={styles.chevronBox}>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={COLORS.primary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <View style={styles.historyDrawer}>
                      <View style={styles.historyDrawerHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                          <Text style={styles.historyDrawerTitle}>
                            Attempt Breakdown ({group.totalTries} {group.totalTries === 1 ? "try" : "tries"})
                          </Text>
                        </View>
                        <Text style={styles.historyDrawerSub}>Newest to Oldest</Text>
                      </View>

                      {group.attempts.map((att, attIdx) => {
                        const tryNum = group.attempts.length - attIdx;
                        const attPassed = (att.accuracy || 0) >= 70;
                        const isLatest = attIdx === 0;

                        return (
                          <View
                            key={att.id || attIdx}
                            style={[
                              styles.historyRow,
                              attIdx !== group.attempts.length - 1 && styles.historyRowBorder,
                            ]}
                          >
                            <View style={styles.historyLeft}>
                              <View style={styles.historyIndexBadge}>
                                <Text style={styles.historyIndexText}>#{tryNum}</Text>
                              </View>
                              <View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={styles.historyTryText}>Try {tryNum}</Text>
                                  {isLatest && (
                                    <View style={styles.latestTag}>
                                      <Text style={styles.latestTagText}>Latest</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.historyMetaText}>
                                  Time: {formatTime(att.time_spent_seconds)}
                                  {att.completed_at ? ` • ${att.completed_at.slice(0, 10)}` : ""}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.historyRight}>
                              <Text
                                style={[
                                  styles.historyScore,
                                  attPassed ? { color: COLORS.success } : { color: COLORS.error },
                                ]}
                              >
                                {att.score}/{att.total_questions} ({att.accuracy}%)
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 60,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  summaryBarTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  summaryBarSub: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listContainer: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    minHeight: 64,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  triesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  triesBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  scoreRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 8,
  },
  scoreTextCol: {
    alignItems: "flex-end",
  },
  bestScoreVal: {
    fontSize: 16,
    fontWeight: "700",
  },
  bestScoreSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  // Expanded history drawer
  historyDrawer: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyDrawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  historyDrawerTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyDrawerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  historyIndexText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  historyTryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  latestTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  latestTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  historyMetaText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyRight: {
    alignItems: "flex-end",
  },
  historyScore: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.cardSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  emptyBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
});
