import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';
import { cacheFlashcards, getCachedFlashcards } from '../context/OfflineCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const FLASHCARD_IMAGES: Record<number, any> = {
  // Story Grammar
  1: require('../assets/images/flashcards/sg_character.jpg'),
  2: require('../assets/images/flashcards/sg_setting.jpg'),
  3: require('../assets/images/flashcards/sg_problem.jpg'),
  4: require('../assets/images/flashcards/sg_resolution.jpg'),
  5: require('../assets/images/flashcards/sg_first.jpg'),
  6: require('../assets/images/flashcards/sg_finally.jpg'),
  // Mathematics (Animated 2D Vector GIFs)
  201: require('../assets/images/flashcards/math_translation.gif'),
  202: require('../assets/images/flashcards/math_reflection.gif'),
  203: require('../assets/images/flashcards/math_rotation.gif'),
  204: require('../assets/images/flashcards/math_symmetry.gif'),
  205: require('../assets/images/flashcards/math_congruent.gif'),
  206: require('../assets/images/flashcards/math_grid.gif'),
  // Technology and Livelihood Education (Animated 2D Vector GIFs)
  301: require('../assets/images/flashcards/tle_webcam_privacy.gif'),
  302: require('../assets/images/flashcards/tle_mute_mic.gif'),
  303: require('../assets/images/flashcards/tle_meeting_link.gif'),
  304: require('../assets/images/flashcards/tle_password_protection.gif'),
  305: require('../assets/images/flashcards/tle_visual_clarity.gif'),
  306: require('../assets/images/flashcards/tle_chat_etiquette.gif'),
  // Araling Panlipunan (Authentic Historical Artifacts, Paintings & Photographs)
  401: require('../assets/images/flashcards/ap_katipunan_flag.png'),
  402: require('../assets/images/flashcards/ap_andres_bonifacio.jpg'),
  403: require('../assets/images/flashcards/ap_sanduguan.jpg'),
  404: require('../assets/images/flashcards/ap_kartilya.jpg'),
  405: require('../assets/images/flashcards/ap_kalayaan.png'),
  406: require('../assets/images/flashcards/ap_gregoria_de_jesus.jpg'),
};

const FLASHCARD_CONTENT: Record<number, { example: string }> = {
  // Story Grammar
  1: {
    example: 'Rad is a cheerful student who loves flying his red kite.',
  },
  2: {
    example: 'Rad walks across a sunny grassy hill with an oak tree on a breezy afternoon.',
  },
  3: {
    example: "Rad's red kite gets stuck high in the oak tree branches.",
  },
  4: {
    example: 'A friendly helper uses a ladder to rescue the kite and safely returns it to Rad.',
  },
  5: {
    example: 'First, Rad crafts his red kite at his wooden work table.',
  },
  6: {
    example: 'Finally, Rad runs joyfully across the hill as his red kite soars high in the sky.',
  },
  // Mathematics
  201: {
    example: 'The blue triangle slides 4 units to the right in a straight line.',
  },
  202: {
    example: 'The shape flips across the red mirror line to create an opposite matching image.',
  },
  203: {
    example: 'The purple shape turns 90 degrees clockwise around the red center point.',
  },
  204: {
    example: 'The dashed center line folds the shape into two matching halves.',
  },
  205: {
    example: 'Shape A and Shape B are congruent because they have the exact same size and shape.',
  },
  206: {
    example: 'The horizontal X-axis and vertical Y-axis help us find the exact position of points.',
  },
  // Technology and Livelihood Education
  301: {
    example: 'Slide your webcam privacy shutter closed to protect your private room.',
  },
  302: {
    example: 'Always mute your microphone when the teacher or classmates are speaking.',
  },
  303: {
    example: 'Only share the meeting link with trusted school classmates.',
  },
  304: {
    example: 'Keep your secret password protected and confidential.',
  },
  305: {
    example: 'Face the bright front light so your hand signs are clear and easy to see.',
  },
  306: {
    example: 'Use the chat box only for polite and lesson-related questions.',
  },
  // Araling Panlipunan
  401: {
    example: 'The Katipunan united Filipinos under a common vision of liberty.',
  },
  402: {
    example: 'Andres Bonifacio inspired the people with his courage and love of country.',
  },
  403: {
    example: 'Katipuneros performed the Sanduguan to pledge their lives for freedom.',
  },
  404: {
    example: 'The Kartilya taught that all human beings are equal regardless of wealth.',
  },
  405: {
    example: 'The supreme goal of the Katipuneros was to achieve Kalayaan for the country.',
  },
  406: {
    example: "Gregoria de Jesus led the women's chapter and protected the Katipunan seal.",
  },
};

const FLASHCARD_FRONT_CONTEXT: Record<number, string> = {
  // Story Grammar
  1: "This character is Rad.",
  2: "This place is a sunny park.",
  3: "Rad's kite is stuck in the tree.",
  4: "A helper rescues the kite.",
  5: "First, Rad builds his kite.",
  6: "Finally, the kite flies high.",
  // Mathematics
  201: "The shape slides to the right.",
  202: "The shape flips like a mirror.",
  203: "The shape turns around a point.",
  204: "This line folds the shape in half.",
  205: "Both shapes are the exact same.",
  206: "This grid shows shape positions.",
  // Technology and Livelihood Education (TLE / ICT)
  301: "The camera shutter is closed.",
  302: "The microphone is turned off.",
  303: "This is a private class link.",
  304: "This is a secret safety password.",
  305: "Bright light makes signs clear.",
  306: "Type polite school messages here.",
  // Araling Panlipunan
  401: "This is the Katipunan flag.",
  402: "This hero is Andres Bonifacio.",
  403: "This ritual is the Sanduguan.",
  404: "This book is the Kartilya.",
  405: "This newspaper means Kalayaan.",
  406: "This hero is Gregoria de Jesus.",
};

interface Flashcard {
  id: number;
  term: string;
  asl_gloss: string;
  definition: string;
  example: string;
  category: string;
  icon: string;
  color: string;
}

export default function FlashcardsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const initialTopic = (params.topicId as string) || 'story-grammar';

  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masteredIds, setMasteredIds] = useState<number[]>([]);

  const flipAnim = useRef(new Animated.Value(0)).current;

  const recordFlashcardReview = async () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const raw = await AsyncStorage.getItem(`@dhh_flashcards_count_${today}`);
      const nextVal = (parseInt(raw || '0', 10) || 0) + 1;
      await AsyncStorage.setItem(`@dhh_flashcards_count_${today}`, String(nextVal));
    } catch {}
  };

  const handleFlipCard = () => {
    recordFlashcardReview();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    if (isFlipped) {
      Animated.spring(flipAnim, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setIsFlipped(false);
    } else {
      Animated.spring(flipAnim, {
        toValue: 180,
        friction: 8,
        tension: 10,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setIsFlipped(true);
    }
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  const normalizeCards = (rawCards: Flashcard[]) => {
    return rawCards.map((c) => {
      if (FLASHCARD_CONTENT[c.id]) {
        return {
          ...c,
          example: FLASHCARD_CONTENT[c.id].example,
        };
      }
      return c;
    });
  };

  const fetchCards = async (topicId: string) => {
    setLoading(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.setValue(0);
    try {
      const res = await fetch(`${API_URL}/flashcards/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        const loadedCards = normalizeCards(data.cards || []);
        setCards(loadedCards);
        if (loadedCards.length > 0) {
          await cacheFlashcards(topicId, loadedCards);
        }
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.log('Error fetching flashcards, falling back to cache (offline):', err);
      const cached = await getCachedFlashcards(topicId);
      if (cached && cached.length > 0) {
        setCards(normalizeCards(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards(selectedTopic);
  }, [selectedTopic]);

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      flipAnim.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      flipAnim.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleToggleMastered = (id: number) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}
    if (masteredIds.includes(id)) {
      setMasteredIds(masteredIds.filter(i => i !== id));
    } else {
      setMasteredIds([...masteredIds, id]);
    }
    handleNext();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Visual Vocabulary Flashcards</Text>
          <Text style={styles.headerSub}>Tap card to flip between English & ASL Gloss</Text>
        </View>
      </View>

      {/* Topic Selector */}
      <View style={styles.topicBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicBarScroll}>
          {[
            { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline', color: '#7C3AED' },
            { id: 'mathematics', name: 'Mathematics', icon: 'shapes-outline', color: '#2563EB' },
            { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'videocam-outline', color: '#D97706' },
            { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline', color: '#059669' },
          ].map((t) => {
            const isActive = selectedTopic === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.topicChip,
                  isActive && { backgroundColor: t.color, borderColor: t.color }
                ]}
                onPress={() => setSelectedTopic(t.id)}
              >
                <Text style={[styles.topicChipText, isActive && styles.topicChipTextActive]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />
        ) : !currentCard ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No flashcards available for this topic.</Text>
          </View>
        ) : (
          <View style={styles.cardArea}>
            {/* Card Counter & Tag */}
            <View style={styles.cardTopRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{currentCard.category}</Text>
              </View>
              <Text style={styles.cardCounterText}>
                {currentIndex + 1} of {cards.length}
              </Text>
            </View>

            {/* Interactive 3D Flip Card */}
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={handleFlipCard}
              style={styles.cardContainer}
            >
              {/* FRONT OF CARD */}
              <Animated.View
                style={[
                  styles.flashcard,
                  styles.flashcardFront,
                  {
                    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
                    opacity: frontOpacity,
                  },
                ]}
              >
                <View style={styles.cardSideContainer}>
                  {FLASHCARD_IMAGES[currentCard.id] ? (
                    <View style={styles.cardImageContainer}>
                      <Image
                        source={FLASHCARD_IMAGES[currentCard.id]}
                        style={styles.cardIllustration}
                        contentFit={selectedTopic === 'araling-panlipunan' ? 'contain' : 'cover'}
                        autoplay={true}
                      />
                    </View>
                  ) : (
                    <View style={[styles.iconWrapper, { backgroundColor: `${currentCard.color}15` }]}>
                      <Ionicons name={currentCard.icon as any} size={48} color={currentCard.color} />
                    </View>
                  )}
                  <Text style={styles.cardTerm}>{currentCard.term}</Text>
                  <Text style={styles.cardFrontHint}>
                    {FLASHCARD_FRONT_CONTEXT[currentCard.id] || "Tap to reveal ASL Gloss & Definition"}
                  </Text>
                  <View style={styles.flipPrompt}>
                    <Ionicons name="repeat-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.flipPromptText}>Tap to Flip</Text>
                  </View>
                </View>
              </Animated.View>

              {/* BACK OF CARD */}
              <Animated.View
                style={[
                  styles.flashcard,
                  styles.flashcardBack,
                  styles.cardBackAbsolute,
                  {
                    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
                    opacity: backOpacity,
                  },
                ]}
              >
                <View style={styles.cardSideContainer}>
                  <View style={styles.aslBox}>
                    <Text style={styles.aslTag}>ASL GLOSS</Text>
                    <Text style={styles.aslText}>{currentCard.asl_gloss}</Text>
                  </View>

                  <View style={styles.defBox}>
                    <Text style={styles.defLabel}>Definition:</Text>
                    <Text style={styles.defText}>{currentCard.definition}</Text>
                  </View>

                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleLabel}>Example Sentence:</Text>
                    <Text style={styles.exampleText}>"{FLASHCARD_CONTENT[currentCard.id]?.example || currentCard.example}"</Text>
                  </View>

                  <View style={[styles.flipPrompt, { marginTop: 12 }]}>
                    <Ionicons name="repeat-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.flipPromptText}>Tap to Flip Back</Text>
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                onPress={handlePrev}
                disabled={currentIndex === 0}
              >
                <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? '#9CA3AF' : '#1F2937'} />
                <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.masteredBtn,
                  masteredIds.includes(currentCard.id) && styles.masteredBtnActive
                ]}
                onPress={() => handleToggleMastered(currentCard.id)}
              >
                <Ionicons
                  name={masteredIds.includes(currentCard.id) ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={20}
                  color="white"
                />
                <Text style={styles.masteredBtnText}>
                  {masteredIds.includes(currentCard.id) ? "Mastered" : "Mark Mastered"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navBtn, currentIndex === cards.length - 1 && styles.navBtnDisabled]}
                onPress={handleNext}
                disabled={currentIndex === cards.length - 1}
              >
                <Text style={[styles.navBtnText, currentIndex === cards.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={20} color={currentIndex === cards.length - 1 ? '#9CA3AF' : '#1F2937'} />
              </TouchableOpacity>
            </View>
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
    paddingBottom: 12,
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  topicBarContainer: {
    marginBottom: 10,
  },
  topicBarScroll: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topicChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  topicChipTextActive: { color: 'white', fontWeight: 'bold' },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED' },
  container: { padding: 20, alignItems: 'center' },
  emptyBox: { marginTop: 40 },
  emptyText: { color: '#6B7280', fontSize: 15 },
  cardArea: { width: '100%', maxWidth: 440, alignItems: 'center' },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#7C3AED' },
  cardCounterText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  cardContainer: {
    width: '100%',
    minHeight: 390,
    marginBottom: 24,
    position: 'relative',
  },
  flashcard: {
    width: '100%',
    minHeight: 390,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBackAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flashcardFront: { borderColor: '#EDE9FE' },
  flashcardBack: { borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' },
  cardSideContainer: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  cardImageContainer: {
    width: 220,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cardIllustration: {
    width: '100%',
    height: '100%',
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTerm: { fontSize: 26, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  cardFrontHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  flipPrompt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flipPromptText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  aslBox: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  aslTag: { fontSize: 11, fontWeight: 'bold', color: '#7C3AED', marginBottom: 4 },
  aslText: { fontSize: 17, fontWeight: 'bold', color: '#5B21B6', textAlign: 'center' },
  defBox: { width: '100%', marginBottom: 12 },
  defLabel: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 },
  defText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  exampleBox: { width: '100%', backgroundColor: 'white', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  exampleLabel: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 },
  exampleText: { fontSize: 14, color: '#1F2937', fontStyle: 'italic', lineHeight: 20 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  navBtnTextDisabled: { color: '#9CA3AF' },
  masteredBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  masteredBtnActive: { backgroundColor: '#10B981' },
  masteredBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
