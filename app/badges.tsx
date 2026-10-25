import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';

export const BADGE_IMAGES: Record<string, any> = {
  first_step: require('../assets/images/badges/first_step.jpg'),
  streak_master: require('../assets/images/badges/streak_master.jpg'),
  perfect_score: require('../assets/images/badges/perfect_score.jpg'),
  daily_champion: require('../assets/images/badges/daily_champion.jpg'),
  story_explorer: require('../assets/images/badges/story_explorer.jpg'),
  curriculum_pioneer: require('../assets/images/badges/curriculum_pioneer.jpg'),
  literacy_champ: require('../assets/images/badges/curriculum_pioneer.jpg'),
};

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

export default function BadgesScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/badges`);
      if (res.ok) {
        const data = await res.json();
        setBadges(data);
      }
    } catch (err) {
      console.log('Error fetching badges:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchBadges();
    }, [fetchBadges])
  );

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Achievement Badges</Text>
          <Text style={styles.headerSub}>Earn badges by completing lessons and streaks</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Progress Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconBox}>
            <Ionicons name="trophy" size={32} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{unlockedCount} of {badges.length || 6} Badges Unlocked</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(unlockedCount / Math.max(badges.length, 1)) * 100}%` }]} />
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <View
                key={badge.id}
                style={[
                  styles.badgeCard,
                  badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked
                ]}
              >
                {BADGE_IMAGES[badge.id] ? (
                  <View style={styles.badgeImageWrapper}>
                    <Image
                      source={BADGE_IMAGES[badge.id]}
                      style={[
                        styles.badgeImage,
                        !badge.unlocked && styles.badgeImageLocked,
                      ]}
                      resizeMode="cover"
                    />
                    {!badge.unlocked && (
                      <View style={styles.badgeImageLockOverlay}>
                        <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[
                    styles.iconCircle,
                    badge.unlocked
                      ? { backgroundColor: `${badge.color}15`, borderColor: badge.color }
                      : { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }
                  ]}>
                    <Ionicons
                      name={badge.icon as any}
                      size={30}
                      color={badge.unlocked ? badge.color : '#9CA3AF'}
                    />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={styles.badgeTitleRow}>
                    <Text style={[styles.badgeTitle, !badge.unlocked && { color: '#6B7280' }]}>
                      {badge.title}
                    </Text>
                    {badge.unlocked ? (
                      <View style={styles.unlockedTag}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text style={styles.unlockedTagText}>Unlocked</Text>
                      </View>
                    ) : (
                      <View style={styles.lockedTag}>
                        <Ionicons name="lock-closed-outline" size={13} color="#9CA3AF" />
                        <Text style={styles.lockedTagText}>Locked</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              </View>
            ))}
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
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  container: { padding: 20, paddingBottom: 60 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  bannerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#5B21B6', marginBottom: 8 },
  progressBarBg: { height: 8, backgroundColor: 'white', borderRadius: 4, width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 4 },
  badgeGrid: { gap: 12 },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  badgeCardUnlocked: { borderColor: '#EDE9FE' },
  badgeCardLocked: { borderColor: '#E5E7EB', opacity: 0.7 },
  badgeImageWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  badgeImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  badgeImageLocked: {
    opacity: 0.35,
  },
  badgeImageLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 29,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  badgeDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  unlockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  unlockedTagText: { fontSize: 11, fontWeight: 'bold', color: '#10B981' },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  lockedTagText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
});
