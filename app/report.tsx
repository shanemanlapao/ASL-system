import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";
import { COLORS } from "../context/theme";

interface TopicBreakdown {
  topic_id: string;
  knowledge_level: string;
  avg_accuracy: number;
  quizzes_done: number;
  total_stars: number;
}

interface WeakTopic {
  topic_id: string;
  accuracy: number;
  level: string;
}

interface RecentAttempt {
  quiz_title: string;
  score: number;
  total: number;
  difficulty: string;
  accuracy: number;
  time_spent_seconds: number;
  completed_at: string | null;
}

interface ReportData {
  user_id: number;
  total_stars: number;
  overall_accuracy: number;
  total_time_spent_seconds: number;
  quizzes_completed: number;
  topic_breakdown: TopicBreakdown[];
  weak_topics: WeakTopic[];
  recent_attempts: RecentAttempt[];
}

interface GroupedQuizAttempt {
  key: string;
  quiz_title: string;
  difficulty: string;
  attempts: RecentAttempt[];
  totalTries: number;
  firstScore: number;
  firstTotal: number;
  firstAccuracy: number;
  bestScore: number;
  bestTotal: number;
  bestAccuracy: number;
  latestScore: number;
  latestTotal: number;
  latestAccuracy: number;
  latestTimeSeconds: number;
}

export default function ReportScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<any>(null);

  // Accordion expanded state for each quiz group key
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/report`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.log("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/streak`);
      if (res.ok) setStreak(await res.json());
    } catch {
      /* silent */
    }
  };

  const handleRepairStreak = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/repair-streak`, { method: "POST" });
      if (res.ok) fetchStreak();
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchReport();
    fetchStreak();
  }, [userId]);

  // Group attempts by unique Quiz Title & Difficulty
  const groupedAttempts: GroupedQuizAttempt[] = useMemo(() => {
    if (!report?.recent_attempts || report.recent_attempts.length === 0) return [];
    const map: Record<string, GroupedQuizAttempt> = {};

    for (const ra of report.recent_attempts) {
      const key = `${ra.quiz_title}___${ra.difficulty}`;
      if (!map[key]) {
        map[key] = {
          key,
          quiz_title: ra.quiz_title,
          difficulty: ra.difficulty,
          attempts: [],
          totalTries: 0,
          firstScore: ra.score,
          firstTotal: ra.total,
          firstAccuracy: ra.accuracy,
          bestScore: ra.score,
          bestTotal: ra.total,
          bestAccuracy: ra.accuracy,
          latestScore: ra.score,
          latestTotal: ra.total,
          latestAccuracy: ra.accuracy,
          latestTimeSeconds: ra.time_spent_seconds,
        };
      }
      map[key].attempts.push(ra);
      map[key].totalTries += 1;
      if (ra.accuracy > map[key].bestAccuracy) {
        map[key].bestAccuracy = ra.accuracy;
        map[key].bestScore = ra.score;
        map[key].bestTotal = ra.total;
      }
    }

    // Sort each group's attempts chronologically ascending to pinpoint initial try vs peak try
    Object.values(map).forEach((group) => {
      group.attempts.sort((a, b) => {
        const tA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const tB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return tA - tB;
      });
      const first = group.attempts[0];
      const latest = group.attempts[group.attempts.length - 1];
      if (first) {
        group.firstScore = first.score;
        group.firstTotal = first.total;
        group.firstAccuracy = first.accuracy;
      }
      if (latest) {
        group.latestScore = latest.score;
        group.latestTotal = latest.total;
        group.latestAccuracy = latest.accuracy;
        group.latestTimeSeconds = latest.time_spent_seconds;
      }
    });

    return Object.values(map);
  }, [report?.recent_attempts]);

  const StatCard = ({
    icon,
    value,
    label,
    bgColor,
    iconColor,
  }: {
    icon: any;
    value: string;
    label: string;
    bgColor: string;
    iconColor: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: iconColor + "22" }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const formatTime = (seconds: number) => {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder > 0 ? `${mins}m ${remainder}s` : `${mins}m`;
  };

  const getDifficultyColor = (diff: string) => {
    const d = (diff || "easy").toLowerCase();
    if (d === "hard") return { text: COLORS.hard, bg: COLORS.hardBg, border: COLORS.hardBorder };
    if (d === "medium") return { text: COLORS.medium, bg: COLORS.mediumBg, border: COLORS.mediumBorder };
    return { text: COLORS.easy, bg: COLORS.easyBg, border: COLORS.easyBorder };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontWeight: "500" }}>
            Loading your learning report...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Learning Report
          </Text>
          <Text style={styles.headerSub}>@{user?.username || "student"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="star"
            value={report?.total_stars.toString() || "0"}
            label="Total Stars"
            bgColor="#FFFBEB"
            iconColor="#D97706"
          />
          <StatCard
            icon="scan-circle-outline"
            value={`${report?.overall_accuracy || 0}%`}
            label="Accuracy"
            bgColor="#ECFDF5"
            iconColor="#10B981"
          />
          <StatCard
            icon="time-outline"
            value={formatTime(report?.total_time_spent_seconds || 0)}
            label="Time Spent"
            bgColor={COLORS.primaryLight}
            iconColor={COLORS.primary}
          />
          <StatCard
            icon="ribbon-outline"
            value={report?.quizzes_completed.toString() || "0"}
            label="Quizzes Done"
            bgColor="#EEF2FF"
            iconColor="#4F46E5"
          />
        </View>

        {/* Learning Streak Widget */}
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <View style={styles.streakIconCircle}>
              <Ionicons
                name="flame"
                size={24}
                color={streak?.active_today ? COLORS.streak : "#94A3B8"}
              />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.streakCount}>{streak?.current_streak ?? 0} Day Streak</Text>
              <Text style={styles.streakSub}>Longest record: {streak?.longest_streak ?? 0} days</Text>
            </View>
          </View>
          {streak?.can_repair && (
            <TouchableOpacity style={styles.repairBtn} onPress={handleRepairStreak}>
              <Ionicons name="build-outline" size={14} color="white" />
              <Text style={styles.repairBtnText}>Repair (30★)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phase 3: Daily Quiz entry point */}
        <TouchableOpacity
          style={styles.dailyQuizBanner}
          onPress={() => router.push("/quest" as any)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={styles.bannerIconBox}>
              <Ionicons name="trophy" size={20} color={COLORS.primary} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.dailyQuizTitle}>Daily Quizzes & Quests</Text>
              <Text style={styles.dailyQuizSub}>Complete 3 daily challenges for bonus stars</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {/* ── Phase 2: Skill Tree Banner ── */}
        <TouchableOpacity
          style={styles.skillTreeBanner}
          onPress={() => router.push("/skill-tree" as any)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={[styles.bannerIconBox, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="git-network-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.skillTreeTitle}>View Skill Mastery Tree</Text>
              <Text style={styles.skillTreeSub}>See your pyBKT knowledge tracing progress</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Grouped Recent Quiz Attempts (Accordion View) */}
        {groupedAttempts.length > 0 && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Quiz Attempts</Text>
              <Text style={styles.sectionCounter}>
                {groupedAttempts.length} {groupedAttempts.length === 1 ? "Quiz" : "Quizzes"}
              </Text>
            </View>

            <View style={styles.groupedListContainer}>
              {groupedAttempts.map((group) => {
                const isExpanded = !!expandedKeys[group.key];
                const diffStyle = getDifficultyColor(group.difficulty);
                const isPassed = group.bestAccuracy >= 70;

                return (
                  <View key={group.key} style={styles.groupedCard}>
                    {/* Main Touchable Row: Acts as 1 Clean Card */}
                    <TouchableOpacity
                      style={styles.groupCardHeader}
                      onPress={() => toggleExpand(group.key)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        {/* Title */}
                        <Text style={styles.groupQuizTitle}>{group.quiz_title}</Text>

                        {/* Badges Row */}
                        <View style={styles.groupBadgesRow}>
                          {/* Difficulty Pill */}
                          <View
                            style={[
                              styles.diffPill,
                              { backgroundColor: diffStyle.bg, borderColor: diffStyle.border },
                            ]}
                          >
                            <Text style={[styles.diffPillText, { color: diffStyle.text }]}>
                              {group.difficulty.toUpperCase()}
                            </Text>
                          </View>

                          {/* Tries Count Pill */}
                          <View style={styles.triesPill}>
                            <Ionicons name="repeat" size={12} color={COLORS.primary} />
                            <Text style={styles.triesPillText}>
                              {group.totalTries} {group.totalTries === 1 ? "Try" : "Tries"}
                            </Text>
                          </View>

                          {/* First Try Comparison Badge (if repeated) */}
                          {group.totalTries > 1 && (
                            <View style={[styles.triesPill, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
                              <Ionicons name="flag-outline" size={11} color="#64748B" />
                              <Text style={[styles.triesPillText, { color: '#475569' }]}>
                                1st: {group.firstAccuracy}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Best Score & Expand Trigger */}
                      <View style={styles.groupScoreRight}>
                        <View style={styles.bestScoreBox}>
                          <Text
                            style={[
                              styles.bestScoreText,
                              isPassed ? { color: COLORS.success } : { color: COLORS.error },
                            ]}
                          >
                            {group.bestScore}/{group.bestTotal}
                          </Text>
                          <Text style={styles.bestScoreAccuracy}>
                            {group.bestAccuracy}% Best
                          </Text>
                        </View>

                        <View style={styles.expandChevronCircle}>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.primary}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Expandable Attempt History Breakdown */}
                    {isExpanded && (
                      <View style={styles.expandedAttemptsContainer}>
                        <View style={styles.expandedHeaderRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.expandedHeaderTitle}>
                              Attempt History ({group.totalTries} {group.totalTries === 1 ? "try" : "tries"})
                            </Text>
                          </View>
                          <Text style={styles.expandedHeaderSubtitle}>Newest First</Text>
                        </View>

                        {[...group.attempts].reverse().map((att, attIdx) => {
                          const tryNumber = group.attempts.length - attIdx;
                          const attPassed = att.accuracy >= 70;
                          const isLatest = attIdx === 0;
                          const isFirst = tryNumber === 1;
                          const isPeak = att.accuracy === group.bestAccuracy;

                          return (
                            <View
                              key={attIdx}
                              style={[
                                styles.attemptItemRow,
                                attIdx !== group.attempts.length - 1 && styles.attemptItemBorder,
                              ]}
                            >
                              <View style={styles.attemptLeft}>
                                <View style={styles.tryBadge}>
                                  <Text style={styles.tryBadgeText}>#{tryNumber}</Text>
                                </View>
                                <View>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Text style={styles.attemptTryLabel}>
                                      Try {tryNumber}
                                    </Text>
                                    {isLatest && (
                                      <View style={styles.latestPill}>
                                        <Text style={styles.latestPillText}>Latest</Text>
                                      </View>
                                    )}
                                    {isFirst && group.totalTries > 1 && (
                                      <View style={[styles.latestPill, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                                        <Text style={[styles.latestPillText, { color: '#475569' }]}>Initial</Text>
                                      </View>
                                    )}
                                    {isPeak && (
                                      <View style={[styles.latestPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                                        <Text style={[styles.latestPillText, { color: '#B45309' }]}>Peak</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.attemptTimeText}>
                                    Time: {formatTime(att.time_spent_seconds)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.attemptScoreRight}>
                                <Text
                                  style={[
                                    styles.attemptScoreValue,
                                    attPassed ? { color: COLORS.success } : { color: COLORS.error },
                                  ]}
                                >
                                  {att.score}/{att.total} ({att.accuracy}%)
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
          </View>
        )}

        {/* Topic Breakdown */}
        <Text style={styles.sectionTitle}>Topic Performance</Text>
        <View style={styles.sectionCard}>
          {!report?.topic_breakdown || report.topic_breakdown.length === 0 ? (
            <Text style={styles.emptyText}>
              No quizzes completed yet. Start learning to see performance!
            </Text>
          ) : (
            report.topic_breakdown.map((t, idx) => (
              <View key={idx} style={styles.subjectRow}>
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectInfoLeft}>
                    <View style={styles.subjectIconBg}>
                      <Ionicons name="book-outline" size={18} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.subjectName}>{t.topic_id.toUpperCase()}</Text>
                      <Text style={styles.subjectStats}>
                        {t.quizzes_done} quizzes • Level: {t.knowledge_level.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.subjectPercentage, { color: COLORS.primary }]}>
                    {t.avg_accuracy}%
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, t.avg_accuracy)}%`,
                        backgroundColor: COLORS.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Areas to Improve */}
        <Text style={styles.sectionTitle}>Areas to Improve</Text>
        <View style={styles.improvementCard}>
          {!report?.weak_topics || report.weak_topics.length === 0 ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
              <Text style={{ color: COLORS.success, fontWeight: "700", marginTop: 6 }}>
                Great job! No weak topics detected.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.warningHeader}>
                <Ionicons name="warning-outline" size={20} color={COLORS.error} />
                <Text style={styles.warningText}>Topics with accuracy below 70%</Text>
              </View>

              {report.weak_topics.map((wt, idx) => (
                <View key={idx} style={styles.topicRow}>
                  <View>
                    <Text style={styles.topicName}>{wt.topic_id.toUpperCase()}</Text>
                    <Text style={styles.topicSubject}>Current Level: {wt.level.toUpperCase()}</Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{wt.accuracy}%</Text>
                  </View>
                </View>
              ))}

              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={18} color="#D97706" />
                <Text style={styles.tipText}>
                  Practice these topics more to unlock higher difficulty levels!
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  container: { padding: 16, paddingBottom: 60 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    width: "48%",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10, marginLeft: 2 },
  sectionWrapper: { marginBottom: 18 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginHorizontal: 2,
  },
  sectionCounter: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", paddingVertical: 10 },
  subjectRow: { marginBottom: 16 },
  subjectHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  subjectInfoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  subjectIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  subjectName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  subjectStats: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  subjectPercentage: { fontSize: 15, fontWeight: "700" },
  progressBarBg: { height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  improvementCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warningHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  warningText: { fontSize: 13, color: COLORS.error, fontWeight: "700" },
  topicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  topicName: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  topicSubject: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scoreBadge: { backgroundColor: COLORS.errorBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  scoreText: { color: COLORS.error, fontWeight: "700", fontSize: 13 },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  tipText: { fontSize: 12, color: "#92400E", flex: 1, fontWeight: "500" },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  continueButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
  skillTreeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    elevation: 1,
  },
  bannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  skillTreeTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  skillTreeSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakLeft: { flexDirection: "row", alignItems: "center" },
  streakIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.streakBg,
    justifyContent: "center",
    alignItems: "center",
  },
  streakCount: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  streakSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  repairBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repairBtnText: { color: "white", fontSize: 12, fontWeight: "700" },
  dailyQuizBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  dailyQuizTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  dailyQuizSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Grouped Attempts Accordion Styles
  groupedListContainer: {
    gap: 12,
  },
  groupedCard: {
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
  groupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    minHeight: 64,
  },
  groupQuizTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  groupBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diffPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  triesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  triesPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  groupScoreRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 8,
  },
  bestScoreBox: {
    alignItems: "flex-end",
  },
  bestScoreText: {
    fontSize: 16,
    fontWeight: "700",
  },
  bestScoreAccuracy: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },
  expandChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  // Expanded History Panel
  expandedAttemptsContainer: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expandedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  expandedHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expandedHeaderSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  attemptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  attemptItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  attemptLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tryBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  tryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  attemptTryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  latestPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  latestPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  attemptTimeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  attemptScoreRight: {
    alignItems: "flex-end",
  },
  attemptScoreValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
