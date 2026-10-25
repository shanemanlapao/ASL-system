import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  username: string;
  total_stars: number;
  current_streak: number;
  quizzes_completed: number;
  is_current_user: boolean;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/leaderboard?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.user_rank);
        setTotalStudents(data.total_students || 0);
      }
    } catch (err) {
      console.log('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: '#FEF3C7', color: '#D97706', icon: 'trophy' };
    if (rank === 2) return { bg: '#F1F5F9', color: '#64748B', icon: 'ribbon' };
    if (rank === 3) return { bg: '#FFEDD5', color: '#C2410C', icon: 'medal' };
    return { bg: '#F3F4F6', color: '#6B7280', icon: null };
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#EA580C" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Class Leaderboard</Text>
          <Text style={styles.headerSub}>Top learners ranked by stars earned</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* User Rank Card */}
        {userRank !== null && (
          <View style={styles.userRankCard}>
            <View style={styles.userRankIconBox}>
              <Ionicons name="sparkles" size={24} color="#EA580C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userRankTitle}>Your Standing</Text>
              <Text style={styles.userRankSub}>
                Rank <Text style={styles.highlightText}>#{userRank}</Text> of {totalStudents} students
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#EA580C" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.listContainer}>
            {leaderboard.map((item) => {
              const badge = getRankBadge(item.rank);

              return (
                <View
                  key={item.user_id}
                  style={[
                    styles.rankCard,
                    item.is_current_user && styles.currentUserCard
                  ]}
                >
                  {/* Rank Indicator */}
                  <View style={[styles.rankBox, { backgroundColor: badge.bg }]}>
                    {badge.icon ? (
                      <Ionicons name={badge.icon as any} size={18} color={badge.color} />
                    ) : (
                      <Text style={[styles.rankNumber, { color: badge.color }]}>{item.rank}</Text>
                    )}
                  </View>

                  {/* Student Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                      {item.is_current_user && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.studentUser}>@{item.username} • {item.quizzes_completed} quizzes</Text>
                  </View>

                  {/* Stars & Streak */}
                  <View style={styles.statsCol}>
                    <View style={styles.starRow}>
                      <Ionicons name="star" size={16} color="#FF8A65" />
                      <Text style={styles.starVal}>{item.total_stars}</Text>
                    </View>
                    <View style={styles.streakRow}>
                      <Ionicons name="flame" size={14} color="#EA580C" />
                      <Text style={styles.streakVal}>{item.current_streak}d</Text>
                    </View>
                  </View>
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
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#F8F9FA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  container: { padding: 20, paddingBottom: 60 },
  userRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  userRankIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRankTitle: { fontSize: 13, fontWeight: '600', color: '#9A3412' },
  userRankSub: { fontSize: 15, color: '#431407', fontWeight: '500', marginTop: 2 },
  highlightText: { fontWeight: 'bold', color: '#EA580C', fontSize: 16 },
  listContainer: { gap: 10 },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  currentUserCard: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFBF5',
    borderWidth: 2,
  },
  rankBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: { fontSize: 15, fontWeight: 'bold' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  studentUser: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  youBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  statsCol: { alignItems: 'flex-end', gap: 4 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starVal: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakVal: { fontSize: 12, fontWeight: '600', color: '#EA580C' },
});
