import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Dimensions, Modal, Alert, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from "expo-router";
import { useSubjects } from "../../context/SubjectsContext";
import { useAuth } from "../../context/AuthContext";
import { API_URL, resolveMediaUrl } from "../../context/config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from "../../context/theme";
import { useAccessibility } from "../../context/AccessibilityContext";
import Confetti from "../../components/Confetti";
import {
  cacheQuizSession,
  getCachedQuizSession,
  getCachedTopicQuizzes,
  enqueuePendingQuiz,
  updateLocalKCMastery,
  StudentKCMastery,
  addLocalStars,
  saveLocalTotalStars,
} from "../../context/OfflineCache";
import {
  getEliminationScaffold,
  getWrongAnswerScaffold,
} from "../../context/kcScaffolding";
import { translateToAslGloss } from "../../context/aslTranslator";

const { width } = Dimensions.get('window');

interface MatchPair {
  left: string;
  right: string;
}

interface QuestionAnswerRecord {
  question_id: number;
  is_correct: boolean;
  time_spent_seconds: number;
}

export default function QuizScreen() {
  const { id, subjectId, deafEnglish, lessonId, quizId: paramQuizId, difficulty: paramDiff, mode, slot_difficulty } = useLocalSearchParams<{ id?: string; subjectId?: string; deafEnglish?: string; lessonId?: string; quizId?: string; difficulty?: string; mode?: string; slot_difficulty?: string }>();
  const { subjects } = useSubjects();
  const { user } = useAuth();
  const userId = user?.id || 1;

  const subject = subjects[subjectId as string];
  let topic = null;

  if (subject) {
    for (const category of subject.categories) {
      const foundTopic = category.topics.find(t => t.id === id);
      if (foundTopic) {
        topic = foundTopic;
        break;
      }
    }
  }

  const { hapticsEnabled, highContrast } = useAccessibility();
  const [isDeafEnglish, setIsDeafEnglish] = useState<boolean>(deafEnglish === 'true');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Milestone 7 Session State
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [difficulty, setDifficulty] = useState<string>( (paramDiff as string) || "easy");
  const [loading, setLoading] = useState(true);
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Answer tracking for backend submission
  const [answersRecord, setAnswersRecord] = useState<QuestionAnswerRecord[]>([]);
  const [submittingResults, setSubmittingResults] = useState(false);

  // Result state from completion response
  const [completionResult, setCompletionResult] = useState<{
    accuracy_pct: number;
    passed: boolean;
    stars_earned: number;
    unlocked_medium: boolean;
    unlocked_hard: boolean;
    unlocked_next_lesson: boolean;
  } | null>(null);
  const [bktMasteryResult, setBktMasteryResult] = useState<StudentKCMastery | null>(null);

  // Timers for tracking time spent per question
  const questionStartTimeRef = useRef<number>(Date.now());
  const totalQuizStartTimeRef = useRef<number>(Date.now());
  const resolvedQuizIdRef = useRef<string | number | null>(null);

  // Matching mode interactive states
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [currentMatchedPairs, setCurrentMatchedPairs] = useState<MatchPair[]>([]);
  const [shuffledLeftItems, setShuffledLeftItems] = useState<string[]>([]);
  const [shuffledRightItems, setShuffledRightItems] = useState<string[]>([]);
  const [matchingFeedback, setMatchingFeedback] = useState<'correct' | 'wrong' | null>(null);

  // ASL / Deaf English Helper state
  const [aslDrawerVisible, setAslDrawerVisible] = useState(false);
  const [aslResult, setAslResult] = useState('');
  const [aslLoading, setAslLoading] = useState(false);

  // Hint state
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminatedOptionIdx, setEliminatedOptionIdx] = useState<number | null>(null);
  const [eliminatedOptionInfo, setEliminatedOptionInfo] = useState<{
    index: number;
    optionText: string;
    reasonEn: string;
    reasonAsl: string;
  } | null>(null);

  // Wrong Answer Review Modal State
  const [wrongFeedbackVisible, setWrongFeedbackVisible] = useState(false);
  const [wrongFeedbackData, setWrongFeedbackData] = useState<{
    selectedText: string;
    correctText: string;
    reasonEn: string;
    reasonAsl: string;
    kcDisplayName: string;
    pendingScore: number;
    pendingAnswers: QuestionAnswerRecord[];
  } | null>(null);

  // Visual Feedback Animations (Auditory-Free)
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintElimAnim = useRef(new Animated.Value(0)).current;

  // Praise Pop Animation (Randomized encouraging feedback on correct answers)
  const PRAISE_MESSAGES = ["Correct!", "Very Well!", "Great!", "Awesome!", "Well Done!", "Excellent!", "Good Job!", "Nice Work!"];
  const [praiseText, setPraiseText] = useState("Correct!");
  const [showPraisePop, setShowPraisePop] = useState(false);
  const praisePopAnim = useRef(new Animated.Value(0)).current;

  const triggerPraisePop = () => {
    const randomPraise = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];
    setPraiseText(randomPraise);
    setShowPraisePop(true);
    praisePopAnim.setValue(0);
    Animated.timing(praisePopAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowPraisePop(false);
    });
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const handleUseHint = async () => {
    if (!attemptId && !quizQuestions.length) {
      Alert.alert('Not available', 'Quiz session is not started yet.');
      return;
    }
    if (hintUsed) return;
    setHintLoading(true);

    const currentQ = quizQuestions[currentQuestionIndex];
    if (!currentQ) {
      setHintLoading(false);
      return;
    }

    try {
      let serverData: any = null;
      try {
        const res = await fetch(`${API_URL}/quiz/session/use-hint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            attempt_id: attemptId, 
            question_id: currentQ.id, 
            user_id: userId 
          }),
        });
        if (res.status === 400) {
          const errData = await res.json();
          Alert.alert('Not enough stars', errData.detail || 'You need at least 5 stars to use a hint.');
          setHintLoading(false);
          return;
        }
        if (res.ok) {
          serverData = await res.json();
        }
      } catch (networkErr) {
        console.log('Using local offline hint scaffolding:', networkErr);
      }

      setHintUsed(true);

      // Multiple choice elimination
      if (currentQ.question_type !== 'matching' && currentQ.options && currentQ.options.length > 2) {
        let wrongIdx = -1;
        let wrongOptText = '';

        if (serverData?.eliminated_option_idx !== undefined && serverData.eliminated_option_idx !== null && serverData.eliminated_option_idx >= 0) {
          wrongIdx = serverData.eliminated_option_idx;
          wrongOptText = currentQ.options[wrongIdx]?.text || serverData.eliminated_option_text || '';
        } else {
          // Local fallback selection
          const wrongIndices = currentQ.options
            .map((_: any, i: number) => i)
            .filter((i: number) => i !== currentQ.correctOptionIndex && currentQ.options[i].id !== currentQ.correctOptionId);
          if (wrongIndices.length > 0) {
            wrongIdx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
            wrongOptText = currentQ.options[wrongIdx]?.text || '';
          }
        }

        if (wrongIdx >= 0) {
          setEliminatedOptionIdx(wrongIdx);

          // Get Hybrid 2-Tier Scaffolding
          const scaffold = getEliminationScaffold(
            currentQ.knowledge_component,
            wrongOptText,
            currentQ.hint,
            currentQ.question || currentQ.question_text
          );

          const finalReasonEn = serverData?.reason_en || scaffold.reasonEn;
          const finalReasonAsl = serverData?.reason_asl || scaffold.reasonAsl;

          setEliminatedOptionInfo({
            index: wrongIdx,
            optionText: wrongOptText,
            reasonEn: finalReasonEn,
            reasonAsl: finalReasonAsl,
          });

          setHintText(finalReasonEn);

          hintElimAnim.setValue(0);
          Animated.timing(hintElimAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: false,
          }).start();

          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } catch {}
        }
      } else {
        const scaffold = getEliminationScaffold(
          currentQ.knowledge_component,
          '',
          currentQ.hint,
          currentQ.question || currentQ.question_text
        );
        setHintText(serverData?.hint || scaffold.reasonEn);
      }
    } catch {
      Alert.alert('Error', 'Could not process hint request.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleAslTranslate = async () => {
    const currentQ = quizQuestions[currentQuestionIndex];
    if (!currentQ) return;
    setAslLoading(true);
    setAslResult('');

    // Build the text to translate:
    // For matching questions, the question_text is just "Match the pairs below:" which
    // gives the model no content. Instead, send the actual item pairs as a sentence.
    let textToTranslate = currentQ.question || currentQ.question_text || '';
    if (!textToTranslate) {
      setAslResult('No question text available to translate.');
      setAslLoading(false);
      return;
    }
    if (currentQ.question_type === 'matching' && currentQ.matching_pairs?.length > 0) {
      const pairs = currentQ.matching_pairs
        .map((p: any) => `${p.left || p.left_item} matches ${p.right || p.right_item}`)
        .join('. ');
      textToTranslate = `Match the following pairs: ${pairs}`;
    }

    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, direction: 'en_to_asl' }),
      });
      const data = await res.json();
      const result = data.result?.trim();
      if (result) {
        setAslResult(result);
      } else {
        setAslResult(translateToAslGloss(textToTranslate));
      }
    } catch {
      // Local client-side ASL Gloss fallback if server is unreachable
      setAslResult(translateToAslGloss(textToTranslate));
    } finally {
      setAslLoading(false);
    }
  };


  const getActiveQuizStorageKey = (qId: string | number) => `@brightpath_active_quiz_${userId}_${qId}`;

  const persistQuizProgress = async (
    qIndex: number,
    currentScore: number,
    answers: QuestionAnswerRecord[],
    questionsList = quizQuestions
  ) => {
    const qId = resolvedQuizIdRef.current || paramQuizId;
    if (!qId || !questionsList || questionsList.length === 0) return;
    try {
      await AsyncStorage.setItem(
        getActiveQuizStorageKey(qId),
        JSON.stringify({
          targetQuizId: qId,
          attemptId,
          difficulty,
          currentQuestionIndex: qIndex,
          score: currentScore,
          answersRecord: answers,
          quizQuestions: questionsList,
          timestamp: Date.now(),
        })
      );
    } catch {}
  };

  const clearQuizProgress = (qId?: string | number | null) => {
    const idToClear = qId || resolvedQuizIdRef.current || paramQuizId;
    if (idToClear) {
      AsyncStorage.removeItem(getActiveQuizStorageKey(idToClear)).catch(() => {});
    }
  };

  const startQuizSession = async (forceRestart = false) => {
    setLoading(true);
    setLockedError(null);
    setIsFinished(false);
    setSelectedOptionIndex(null);
    setIsAnswered(false);
    setShowHint(false);
    setHintUsed(false);
    setHintText(null);
    setEliminatedOptionIdx(null);
    setEliminatedOptionInfo(null);
    setSelectedLeft(null);
    setSelectedRight(null);
    setCurrentMatchedPairs([]);
    setMatchingFeedback(null);
    setWrongFeedbackVisible(false);
    setWrongFeedbackData(null);
    setShowPraisePop(false);
    setAslDrawerVisible(false);
    setAslResult('');
    setCompletionResult(null);
    setBktMasteryResult(null);
    setIsOfflineSaved(false);
    totalQuizStartTimeRef.current = Date.now();

    // 1. Resolve target quiz ID (online or offline)
    let targetQuizId = resolvedQuizIdRef.current || paramQuizId;
    if (!targetQuizId && (mode === 'daily' || (!lessonId && /^\d+$/.test(String(id || ''))))) {
      targetQuizId = id;
    }

    if (!targetQuizId) {
      try {
        let res;
        if (lessonId) {
          res = await fetch(`${API_URL}/quizzes/lesson/${lessonId}`);
        } else {
          res = await fetch(`${API_URL}/quizzes/${id}`);
        }
        if (res?.ok) {
          const data = await res.json();
          const targetDiff = (difficulty || (paramDiff as string) || 'easy').toLowerCase();
          const quizObj = Array.isArray(data)
            ? (data.find((q: any) => q.difficulty?.toLowerCase() === targetDiff) || data[0])
            : data;
          if (quizObj) targetQuizId = quizObj.id;
        }
      } catch (lookupErr) {
        console.log('Online quiz lookup failed, checking cache:', lookupErr);
      }
    }

    // Offline lookup fallback for targetQuizId
    if (!targetQuizId && lessonId) {
      const cachedByLesson = await getCachedQuizSession(`lesson_${lessonId}`);
      if (cachedByLesson?.id) {
        targetQuizId = cachedByLesson.id;
      }
    }
    if (!targetQuizId && id) {
      const topicQuizzes = await getCachedTopicQuizzes(String(id));
      if (Array.isArray(topicQuizzes) && topicQuizzes.length > 0) {
        const targetDiff = (difficulty || (paramDiff as string) || 'easy').toLowerCase();
        const match = topicQuizzes.find((q: any) =>
          (lessonId ? q.lesson_id === Number(lessonId) : true) &&
          (!targetDiff || (q.difficulty || '').toLowerCase() === targetDiff)
        ) || topicQuizzes[0];
        if (match?.id) targetQuizId = match.id;
      }
    }

    if (targetQuizId) {
      resolvedQuizIdRef.current = targetQuizId;
    }

    // 2. Check for persistent in-progress quiz state (if not force-restarted)
    if (!forceRestart && targetQuizId) {
      try {
        const savedProgressRaw = await AsyncStorage.getItem(getActiveQuizStorageKey(targetQuizId));
        if (savedProgressRaw) {
          const saved = JSON.parse(savedProgressRaw);
          if (
            saved &&
            Array.isArray(saved.quizQuestions) &&
            saved.quizQuestions.length > 0 &&
            typeof saved.currentQuestionIndex === 'number' &&
            saved.currentQuestionIndex < saved.quizQuestions.length
          ) {
            setAttemptId(saved.attemptId || null);
            setDifficulty(saved.difficulty || (paramDiff as string) || 'easy');
            setQuizQuestions(saved.quizQuestions);
            setCurrentQuestionIndex(saved.currentQuestionIndex);
            setScore(saved.score || 0);
            setAnswersRecord(saved.answersRecord || []);
            setQuizTitle(`${(saved.difficulty || 'QUIZ').toUpperCase()} Quiz`);
            questionStartTimeRef.current = Date.now();
            setLockedError(null);
            setLoading(false);
            return;
          }
        }
      } catch (restoreErr) {
        console.log('Error restoring saved quiz progress:', restoreErr);
      }
    }

    // Reset progress tracking if starting a fresh attempt
    setScore(0);
    setCurrentQuestionIndex(0);
    setAnswersRecord([]);

    try {
      if (!targetQuizId) {
        throw new Error("No quiz found for this lesson.");
      }

      // 3. Call AI Session endpoint (randomized 10 questions + lock check)
      const sessionUrl = `${API_URL}/quiz/session/${targetQuizId}?user_id=${userId}${mode === 'daily' ? '&mode=daily' : ''}`;
      const sessionRes = await fetch(sessionUrl);

      if (sessionRes.status === 403) {
        const errorData = await sessionRes.json();
        setLockedError(errorData.detail || "This quiz is locked.");
        return;
      }

      if (!sessionRes.ok) throw new Error("Failed to start quiz session.");

      const sessionData = await sessionRes.json();
      setAttemptId(sessionData.attempt_id);
      setDifficulty(sessionData.difficulty || "easy");

      // Cache session for offline reuse
      await cacheQuizSession(targetQuizId as string, sessionData);
      if (lessonId) {
        await cacheQuizSession(`lesson_${lessonId}`, sessionData);
      }

      const mapped = sessionData.questions.map((q: any) => ({
        id: q.id,
        question: q.question_text,
        deafQuestion: translateToAslGloss(q.question_text),
        question_type: q.question_type || 'descriptive',
        image_url: q.image_url,
        options: (q.options || []).map((opt: string, idx: number) => ({
          id: String.fromCharCode(65 + idx),
          text: opt,
          deafText: translateToAslGloss(opt),
        })),
        correctOptionId: String.fromCharCode(65 + q.correct_option_index),
        matching_pairs: (q.matching_pairs || []).map((p: any) => ({
          left: p.left || p.left_item || '',
          right: p.right || p.right_item || '',
        })),
        hint: q.hint || "",
        deafHint: (q.hint || "").toUpperCase(),
        knowledge_component: q.knowledge_component || 'reading_comprehension',
      }));

      setQuizQuestions(mapped);
      setQuizTitle(`${(sessionData.difficulty || 'QUIZ').toUpperCase()} Quiz`);
      questionStartTimeRef.current = Date.now();
      persistQuizProgress(0, 0, [], mapped);
    } catch (err: any) {
      console.log('Error starting quiz session, checking cache (offline):', err);

      // Offline fallback: load cached session or topic quiz
      let loaded = false;
      let cachedSession = targetQuizId ? await getCachedQuizSession(targetQuizId as string) : null;
      if (!cachedSession && lessonId) {
        cachedSession = await getCachedQuizSession(`lesson_${lessonId}`);
      }
      if (!cachedSession && id) {
        const topicQuizzes = await getCachedTopicQuizzes(String(id));
        if (Array.isArray(topicQuizzes) && topicQuizzes.length > 0) {
          const targetDiff = (difficulty || (paramDiff as string) || 'easy').toLowerCase();
          cachedSession = topicQuizzes.find((q: any) =>
            (lessonId ? q.lesson_id === Number(lessonId) : true) &&
            (!targetDiff || (q.difficulty || '').toLowerCase() === targetDiff)
          ) || topicQuizzes[0];
        }
      }

      if (cachedSession?.questions?.length) {
        setAttemptId(cachedSession.attempt_id || null);
        const resolvedDiff = cachedSession.difficulty || (paramDiff as string) || "easy";
        setDifficulty(resolvedDiff);
        const questionsPool = Array.isArray(cachedSession.questions) ? cachedSession.questions.slice(0, 10) : [];
        const mapped = questionsPool.map((q: any) => ({
          id: q.id,
          question: q.question_text,
          deafQuestion: translateToAslGloss(q.question_text),
          question_type: q.question_type || 'descriptive',
          image_url: q.image_url,
          options: (q.options || []).map((opt: string, idx: number) => ({
            id: String.fromCharCode(65 + idx),
            text: opt,
            deafText: translateToAslGloss(opt),
          })),
          correctOptionId: String.fromCharCode(65 + (q.correct_option_index ?? 0)),
          matching_pairs: (q.matching_pairs || []).map((p: any) => ({
            left: p.left || p.left_item || '',
            right: p.right || p.right_item || '',
          })),
          hint: q.hint || "",
          deafHint: (q.hint || "").toUpperCase(),
          knowledge_component: q.knowledge_component || 'reading_comprehension',
        }));
        setQuizQuestions(mapped);
        setQuizTitle(`${resolvedDiff.toUpperCase()} Quiz (Offline)`);
        questionStartTimeRef.current = Date.now();
        setLockedError(null);
        loaded = true;
        persistQuizProgress(0, 0, [], mapped);
      }

      if (!loaded && topic?.quiz?.questions?.length) {
        setQuizQuestions(topic.quiz.questions);
        setQuizTitle(`${topic.name} Quiz (Offline)`);
        questionStartTimeRef.current = Date.now();
        setLockedError(null);
        loaded = true;
        persistQuizProgress(0, 0, [], topic.quiz.questions);
      }

      if (!loaded) {
        setLockedError(err.message || "Failed to load quiz offline.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startQuizSession();
  }, [id, lessonId, paramQuizId, userId]);

  // Set up matching items when current question changes
  useEffect(() => {
    if (quizQuestions.length > 0 && currentQuestionIndex < quizQuestions.length) {
      const q = quizQuestions[currentQuestionIndex];
      if (q.question_type === 'matching' && q.matching_pairs) {
        const lefts = q.matching_pairs.map((p: MatchPair) => p.left);
        const rights = q.matching_pairs.map((p: MatchPair) => p.right);
        setShuffledLeftItems([...lefts].sort(() => 0.5 - Math.random()));
        setShuffledRightItems([...rights].sort(() => 0.5 - Math.random()));
        setCurrentMatchedPairs([]);
        setSelectedLeft(null);
        setSelectedRight(null);
        setMatchingFeedback(null);
      }
      questionStartTimeRef.current = Date.now();
      // Reset hint per question
      setHintText(null);
      setHintUsed(false);
      setEliminatedOptionIdx(null);
      hintElimAnim.setValue(0);
    }
  }, [currentQuestionIndex, quizQuestions]);

  const currentQuestion = quizQuestions[currentQuestionIndex];

  // Submit quiz results to backend when finished
  const submitQuizResults = async (finalScore: number, finalAnswers: QuestionAnswerRecord[]) => {
    setSubmittingResults(true);
    const totalTimeSec = Math.round((Date.now() - totalQuizStartTimeRef.current) / 1000);
    const totalQ = quizQuestions.length > 0 ? quizQuestions.length : 1;
    const accuracyPct = Math.round((finalScore / totalQ) * 100);
    const isPassed = accuracyPct >= 70;
    const targetQuizId = Number(resolvedQuizIdRef.current || paramQuizId) || 1;

    // Clear saved in-progress quiz since attempt is finished
    clearQuizProgress(targetQuizId);

    try {
      if (attemptId) {
        const res = await fetch(`${API_URL}/quiz/session/${attemptId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: finalScore,
            total_questions: totalQ,
            time_spent_seconds: totalTimeSec,
            answers: finalAnswers,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          setCompletionResult(result);
          setIsOfflineSaved(false);

          if (result.stars_earned && result.stars_earned > 0) {
            await addLocalStars(userId, result.stars_earned);
          }

          // Update local BKT mastery cache
          let latestKCMastery: StudentKCMastery | null = null;
          for (const ans of finalAnswers) {
            const qObj = quizQuestions.find(q => q.id === ans.question_id);
            const kc = qObj?.knowledge_component || 'reading_comprehension';
            latestKCMastery = await updateLocalKCMastery(userId, kc, ans.is_correct);
          }
          if (latestKCMastery) {
            setBktMasteryResult(latestKCMastery);
          }

          // If mode is daily quiz, mark slot complete and earn daily stars & streak
          if (mode === 'daily') {
            try {
              const diff = (slot_difficulty as string) || (difficulty as string) || 'easy';
              await fetch(`${API_URL}/daily-quizzes/${userId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  slot_difficulty: diff,
                  score: finalScore,
                  total_questions: totalQ,
                  time_spent_seconds: totalTimeSec,
                  topic_id: (subjectId as string) || null,
                }),
              });
            } catch (dErr) {
              console.log('Daily slot complete error:', dErr);
            }
          }

          return;
        }
      }
      throw new Error('Network offline or request failed');
    } catch (err) {
      console.log('Quiz submission offline, saving to pending queue:', err);
      // Queue offline attempt for auto-sync
      await enqueuePendingQuiz({
        userId,
        quizId: targetQuizId,
        attemptId: attemptId || null,
        difficulty: difficulty || 'easy',
        score: finalScore,
        totalQuestions: totalQ,
        timeSpentSeconds: totalTimeSec,
        answers: finalAnswers,
      });

      setIsOfflineSaved(true);
      const starRates: Record<string, number> = { easy: 3, medium: 4, hard: 6 };
      const starRate = starRates[(difficulty || 'easy').toLowerCase()] || 3;
      const starsEarned = isPassed ? (finalScore * starRate) : 0;

      // Add stars locally so they reflect immediately even offline
      if (starsEarned > 0) {
        await addLocalStars(userId, starsEarned);
      }

      // Real-time edge BKT update while offline
      let latestKCMastery: StudentKCMastery | null = null;
      for (const ans of finalAnswers) {
        const qObj = quizQuestions.find(q => q.id === ans.question_id);
        const kc = qObj?.knowledge_component || 'reading_comprehension';
        latestKCMastery = await updateLocalKCMastery(userId, kc, ans.is_correct);
      }
      if (latestKCMastery) {
        setBktMasteryResult(latestKCMastery);
      }

      // Optimistic completion result so visual celebrations and unlocks function smoothly
      setCompletionResult({
        accuracy_pct: accuracyPct,
        passed: isPassed,
        stars_earned: starsEarned,
        unlocked_medium: isPassed && difficulty === 'easy',
        unlocked_hard: isPassed && difficulty === 'medium',
        unlocked_next_lesson: false,
      });
    } finally {
      setSubmittingResults(false);
    }
  };

  // Multiple Choice option handler
  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOptionIndex(index);
    setIsAnswered(true);

    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    const selectedOpt = currentQuestion.options[index];
    const isCorrect = selectedOpt.id === currentQuestion.correctOptionId;

    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
      triggerPraisePop();
      if (hapticsEnabled) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } catch {}
      }
    } else {
      triggerShake();
      if (hapticsEnabled) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } catch {}
      }
    }

    const newAnswer: QuestionAnswerRecord = {
      question_id: currentQuestion.id,
      is_correct: isCorrect,
      time_spent_seconds: timeSpent,
    };
    const updatedAnswers = [...answersRecord, newAnswer];
    setAnswersRecord(updatedAnswers);

    if (isCorrect) {
      // Auto-advance after 2.0 seconds for correct answers
      setTimeout(() => {
        setShowPraisePop(false);
        shakeAnim.setValue(0);
        setEliminatedOptionIdx(null);
        setEliminatedOptionInfo(null);
        setHintText(null);
        setHintUsed(false);
        if (currentQuestionIndex < quizQuestions.length - 1) {
          const nextIndex = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextIndex);
          persistQuizProgress(nextIndex, newScore, updatedAnswers);
          setSelectedOptionIndex(null);
          setIsAnswered(false);
          setShowHint(false);
        } else {
          setIsFinished(true);
          setSelectedOptionIndex(null);
          setIsAnswered(false);
          setShowHint(false);
          submitQuizResults(newScore, updatedAnswers);
        }
      }, 2000);
    } else {
      // Wrong Answer Scaffolding: Pause and display review modal
      const correctOpt = currentQuestion.options.find(
        (o: any) => o.id === currentQuestion.correctOptionId
      );
      const scaffold = getWrongAnswerScaffold(
        currentQuestion.knowledge_component,
        selectedOpt?.text || "Your choice",
        correctOpt?.text || "Correct answer",
        currentQuestion.hint,
        currentQuestion.question || currentQuestion.question_text
      );

      setTimeout(() => {
        setWrongFeedbackData({
          selectedText: selectedOpt?.text || "Your choice",
          correctText: correctOpt?.text || "Correct answer",
          reasonEn: scaffold.reasonEn,
          reasonAsl: scaffold.reasonAsl,
          kcDisplayName: scaffold.kcDisplayName,
          pendingScore: newScore,
          pendingAnswers: updatedAnswers,
        });
        setWrongFeedbackVisible(true);
      }, 450);
    }
  };

  const handleDismissWrongFeedback = () => {
    if (!wrongFeedbackVisible) return;
    setWrongFeedbackVisible(false);
    const pendingScore = wrongFeedbackData?.pendingScore ?? score;
    const pendingAnswers = wrongFeedbackData?.pendingAnswers ?? answersRecord;
    setWrongFeedbackData(null);

    // Reset state for next question
    shakeAnim.setValue(0);
    setEliminatedOptionIdx(null);
    setEliminatedOptionInfo(null);
    setHintText(null);
    setHintUsed(false);

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      persistQuizProgress(nextIndex, pendingScore, pendingAnswers);
      setSelectedOptionIndex(null);
      setIsAnswered(false);
      setShowHint(false);
    } else {
      setIsFinished(true);
      setSelectedOptionIndex(null);
      setIsAnswered(false);
      setShowHint(false);
      submitQuizResults(pendingScore, pendingAnswers);
    }
  };

  // Matching pair handler
  const handlePairMatch = (left: string, right: string) => {
    const pairFound = currentQuestion.matching_pairs.find(
      (p: MatchPair) => p.left === left && p.right === right
    );

    if (pairFound) {
      setMatchingFeedback('correct');
      triggerPraisePop();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
      const updatedPairs = [...currentMatchedPairs, { left, right }];
      setCurrentMatchedPairs(updatedPairs);
      setSelectedLeft(null);
      setSelectedRight(null);

      setTimeout(() => {
        setMatchingFeedback(null);
      }, 800);

      // Check if all pairs are matched
      if (updatedPairs.length === currentQuestion.matching_pairs.length) {
        setIsAnswered(true);
        const newScore = score + 1;
        setScore(newScore);

        const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
        const newAnswer: QuestionAnswerRecord = {
          question_id: currentQuestion.id,
          is_correct: true,
          time_spent_seconds: timeSpent,
        };
        const updatedAnswers = [...answersRecord, newAnswer];
        setAnswersRecord(updatedAnswers);

        setTimeout(() => {
          setShowPraisePop(false);
          if (currentQuestionIndex < quizQuestions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            persistQuizProgress(nextIndex, newScore, updatedAnswers);
            setIsAnswered(false);
            setShowHint(false);
          } else {
            setIsFinished(true);
            setSelectedOptionIndex(null);
            setIsAnswered(false);
            setShowHint(false);
            submitQuizResults(newScore, updatedAnswers);
          }
        }, 2000);
      }
    } else {
      setMatchingFeedback('wrong');
      triggerShake();
      if (hapticsEnabled) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } catch {}
      }
      setTimeout(() => {
        setMatchingFeedback(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading quiz questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Locked Quiz Screen
  if (lockedError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0284C7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz Locked</Text>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={64} color="#F59E0B" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 16 }}>
            {difficulty.toUpperCase()} Quiz Locked
          </Text>
          <Text style={{ marginTop: 8, fontSize: 15, color: '#6B7280', textAlign: 'center', paddingHorizontal: 30 }}>
            {lockedError}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: '#0284C7', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Finished Screen (Pass / Fail)
  if (isFinished) {
    const accuracy = completionResult ? completionResult.accuracy_pct : Math.round((score / quizQuestions.length) * 100);
    const passed = completionResult ? completionResult.passed : accuracy >= 70;
    const currentDiffKey = (difficulty || 'easy').toLowerCase();
    const starRate = currentDiffKey === 'hard' ? 6 : currentDiffKey === 'medium' ? 4 : 3;
    const calculatedStars = passed ? (score * starRate) : 0;
    const earnedStars = completionResult?.stars_earned !== undefined ? completionResult.stars_earned : calculatedStars;

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {passed && <Confetti count={65} />}
        <View style={styles.finishedContainer}>
          <Ionicons
            name={passed ? "trophy" : "refresh-circle"}
            size={80}
            color={passed ? "#F59E0B" : COLORS.primary}
          />

          <Text style={styles.finishedTitle}>
            {passed ? "Quiz Passed!" : "Keep Trying!"}
          </Text>

          <Text style={styles.finishedScore}>
            {score} / {quizQuestions.length} ({accuracy}%)
          </Text>

          <Text style={styles.difficultyBadge}>
            Difficulty: {difficulty.toUpperCase()}
          </Text>

          {/* Star Reward Section */}
          {passed ? (
            <View style={styles.rewardCardPassed}>
              <View style={styles.rewardIconCircle}>
                <Ionicons name="star" size={28} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardStarCount}>+{earnedStars} Stars Earned!</Text>
                <Text style={styles.rewardSubtext}>
                  +{starRate} stars per correct answer ({score}/{quizQuestions.length})
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.rewardCardFailed}>
              <View style={styles.rewardIconCircleFailed}>
                <Ionicons name="star-outline" size={26} color="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardFailedTitle}>0 Stars Earned</Text>
                <Text style={styles.rewardFailedSubtext}>
                  Score 70% or higher to pass and earn stars!
                </Text>
              </View>
            </View>
          )}

          {/* Offline Saved Indicator (Auditory-Free, No Emojis) */}
          {isOfflineSaved && (
            <View style={styles.offlineSavedBox}>
              <Ionicons name="cloud-offline-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.offlineSavedText}>Saved Offline: Queued for automatic synchronization</Text>
            </View>
          )}

          {/* Celebration Unlocks */}
          {completionResult?.unlocked_medium && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="sparkles" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Medium Tier Unlocked!</Text>
            </View>
          )}
          {completionResult?.unlocked_hard && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="trophy" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Hard Tier Unlocked!</Text>
            </View>
          )}
          {completionResult?.unlocked_next_lesson && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="checkmark-done" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Next Lesson Unlocked!</Text>
            </View>
          )}

          {submittingResults && (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />
          )}

          {/* Action Buttons */}
          <View style={styles.finishedActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.8}
              onPress={() => {
                setAttemptCount(prev => prev + 1);
                clearQuizProgress();
                startQuizSession(true);
              }}
            >
              <Ionicons name="refresh" size={20} color={COLORS.primary} />
              <Text style={styles.retryBtnText}>Try Again (Fresh Questions)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              activeOpacity={0.85}
              onPress={() => router.back()}
            >
              <Text style={styles.doneBtnText}>Back to Lessons</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text style={{ color: "#EF4444", fontSize: 16 }}>No questions available for this quiz.</Text>
          <TouchableOpacity style={[styles.doneButton, { marginTop: 16 }]} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentDiff = ((paramDiff as string) || difficulty || 'easy').toUpperCase();
  const currentQuestionNumber = currentQuestionIndex + 1;
  const totalQuestions = quizQuestions.length;
  const progressPercent = totalQuestions > 0 ? (currentQuestionNumber / totalQuestions) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{quizTitle || `${currentDiff} Quiz`}</Text>
          <Text style={styles.headerSub}>Difficulty: {currentDiff} • Q{currentQuestionNumber} of {totalQuestions}</Text>
        </View>

        {/* Hint Button */}
        <TouchableOpacity
          style={[styles.hintHeaderBtn, hintUsed && styles.hintHeaderBtnUsed]}
          onPress={handleUseHint}
          disabled={hintUsed || hintLoading}
        >
          {hintLoading ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : (
            <>
              <Ionicons name="bulb-outline" size={16} color={hintUsed ? "#9CA3AF" : "#7C3AED"} />
              <Text style={[styles.hintHeaderBtnText, hintUsed && styles.hintHeaderBtnTextUsed]}>
                {hintUsed ? "Hint Used" : "Hint (-5 Stars)"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Question Card */}
        <View style={[styles.questionCard, highContrast && { borderWidth: 2, borderColor: '#000000', backgroundColor: '#FFFFFF' }]}>
          {currentQuestion.image_url ? (
            <View style={styles.questionImageWrapper}>
              <Image source={{ uri: resolveMediaUrl(currentQuestion.image_url) }} style={styles.questionImage} resizeMode="contain" />
            </View>
          ) : null}

          <Text style={[styles.questionText, highContrast && { color: '#000000', fontWeight: '900', fontSize: 19 }]}>
            {isDeafEnglish ? currentQuestion.deafQuestion : currentQuestion.question}
          </Text>

          {/* Multiple Choice Options */}
          {currentQuestion.question_type !== 'matching' && (
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option: any, idx: number) => {
                const isSelected = selectedOptionIndex === idx;
                const isCorrect = option.id === currentQuestion.correctOptionId;
                const isEliminated = idx === eliminatedOptionIdx;
                let optionStyle: any = styles.optionCard;

                if (isEliminated) {
                  optionStyle = [styles.optionCard, styles.optionEliminated];
                } else if (isAnswered) {
                  if (isCorrect) optionStyle = styles.optionCorrect;
                  else if (isSelected) optionStyle = styles.optionWrong;
                }
                if (highContrast && !isAnswered && !isEliminated) {
                  optionStyle = [optionStyle, { borderWidth: 2, borderColor: '#1E293B', backgroundColor: '#FFFFFF' }];
                }

                return (
                  <View
                    key={idx}
                    style={[
                      { width: '100%', position: 'relative' },
                      isSelected && !isCorrect ? { transform: [{ translateX: shakeAnim }] } : null,
                    ]}
                  >
                    <TouchableOpacity
                      style={optionStyle}
                      disabled={isAnswered || isEliminated}
                      onPress={() => handleSelectOption(idx)}
                    >
                      <View style={[styles.optionLetterBox, isEliminated && styles.optionLetterBoxEliminated, highContrast && { backgroundColor: '#000000' }]}>
                        <Text style={[styles.optionLetter, isEliminated && styles.optionLetterEliminated, highContrast && { color: '#FFFFFF', fontWeight: '900' }]}>
                          {option.id}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, isEliminated && styles.optionTextEliminated, highContrast && { color: '#000000', fontWeight: '800' }]}>
                        {isDeafEnglish ? option.deafText : option.text}
                      </Text>

                      {/* Animated Distractor Strikethrough Line */}
                      {isEliminated && (
                        <Animated.View
                          style={[
                            styles.strikethroughLine,
                            {
                              width: hintElimAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '76%'],
                              }),
                            },
                          ]}
                        />
                      )}

                      {/* Eliminated Badge on Right */}
                      {isEliminated && (
                        <View style={styles.eliminatedBadge}>
                          <Ionicons name="close-circle" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.eliminatedBadgeText}>INCORRECT</Text>
                        </View>
                      )}

                      {/* Floating Praise Pop Animation */}
                      {isAnswered && isCorrect && showPraisePop && (
                        <Animated.View
                          style={[
                            styles.praisePopBadge,
                            {
                              opacity: praisePopAnim.interpolate({
                                inputRange: [0, 0.2, 0.8, 1],
                                outputRange: [0, 1, 1, 0],
                              }),
                              transform: [
                                {
                                  translateY: praisePopAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -38],
                                  }),
                                },
                                {
                                  scale: praisePopAnim.interpolate({
                                    inputRange: [0, 0.25, 1],
                                    outputRange: [0.6, 1.15, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          <Ionicons name="checkmark-circle" size={15} color="#15803D" style={{ marginRight: 4 }} />
                          <Text style={styles.praisePopText}>{praiseText}</Text>
                        </Animated.View>
                      )}
                    </TouchableOpacity>

                    {/* Explanatory Scaffolding Box for Eliminated Distractor */}
                    {isEliminated && eliminatedOptionInfo && (
                      <View style={styles.eliminationCalloutBox}>
                        <View style={styles.eliminationCalloutHeader}>
                          <Ionicons name="information-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                          <Text style={styles.eliminationCalloutTitle}>
                            Why Option {option.id} is Incorrect:
                          </Text>
                        </View>
                        <Text style={styles.eliminationCalloutReason}>
                          {eliminatedOptionInfo.reasonEn}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Matching Pairs UI */}
          {currentQuestion.question_type === 'matching' && (
            <View>
              {/* Matching Praise Pop */}
              {matchingFeedback === 'correct' && showPraisePop && (
                <Animated.View
                  style={[
                    styles.matchingPraisePopBadge,
                    {
                      opacity: praisePopAnim.interpolate({
                        inputRange: [0, 0.2, 0.8, 1],
                        outputRange: [0, 1, 1, 0],
                      }),
                      transform: [
                        {
                          translateY: praisePopAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -20],
                          }),
                        },
                        {
                          scale: praisePopAnim.interpolate({
                            inputRange: [0, 0.25, 1],
                            outputRange: [0.6, 1.15, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={styles.praisePopText}>{praiseText}</Text>
                </Animated.View>
              )}

              <Animated.View
                style={[
                  styles.matchingContainer,
                  matchingFeedback === 'wrong' ? { transform: [{ translateX: shakeAnim }] } : null,
                ]}
              >
                <View style={styles.matchingColumn}>
                  <Text style={styles.matchingColHeader}>Items</Text>
                  {shuffledLeftItems.map((item, idx) => {
                    const isMatched = currentMatchedPairs.some(p => p.left === item);
                    const isSelected = selectedLeft === item;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.matchingChip,
                          isSelected && styles.matchingChipSelected,
                          isMatched && styles.matchingChipMatched,
                        ]}
                        disabled={isMatched}
                        onPress={() => {
                          setSelectedLeft(item);
                          if (selectedRight) handlePairMatch(item, selectedRight);
                        }}
                      >
                        <Text style={[styles.matchingChipText, isMatched && styles.matchingChipTextMatched]}>
                          {isDeafEnglish ? item.toUpperCase() : item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.matchingColumn}>
                  <Text style={styles.matchingColHeader}>Matches</Text>
                  {shuffledRightItems.map((item, idx) => {
                    const isMatched = currentMatchedPairs.some(p => p.right === item);
                    const isSelected = selectedRight === item;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.matchingChip,
                          isSelected && styles.matchingChipSelected,
                          isMatched && styles.matchingChipMatched,
                        ]}
                        disabled={isMatched}
                        onPress={() => {
                          setSelectedRight(item);
                          if (selectedLeft) handlePairMatch(selectedLeft, item);
                        }}
                      >
                        <Text style={[styles.matchingChipText, isMatched && styles.matchingChipTextMatched]}>
                          {isDeafEnglish ? item.toUpperCase() : item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating ASL Helper Button */}
      {!isFinished && (
        <TouchableOpacity
          style={styles.aslFloatBtn}
          onPress={() => { setAslDrawerVisible(true); setAslResult(''); }}
        >
          <Ionicons name="hand-left-outline" size={22} color="white" />
          <Text style={styles.aslFloatBtnText}>ASL Helper</Text>
        </TouchableOpacity>
      )}

      {/* ASL / Deaf English Helper Drawer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={aslDrawerVisible}
        onRequestClose={() => setAslDrawerVisible(false)}
      >
        <View style={styles.aslDrawerOverlay}>
          <View style={styles.aslDrawerContent}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={styles.aslDrawerTitle}>ASL / Deaf English Translator</Text>
              <TouchableOpacity onPress={() => setAslDrawerVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Original question text */}
            <View style={styles.aslOriginalBox}>
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>ORIGINAL QUESTION</Text>
              <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>
                {quizQuestions[currentQuestionIndex]?.question || quizQuestions[currentQuestionIndex]?.question_text || ''}
              </Text>
            </View>

            {/* Loading indicator */}
            {aslLoading && (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 16 }} />
            )}

            {/* Translation result — shown above the button */}
            {!!aslResult && !aslLoading && (
              <View style={styles.aslResultBox}>
                <Text style={styles.aslResultLabel}>ASL / DEAF ENGLISH</Text>
                <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>{aslResult}</Text>
              </View>
            )}

            {/* Translate button — always at the bottom */}
            <TouchableOpacity
              onPress={handleAslTranslate}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#7C3AED', borderRadius: 10, marginTop: 14,
                paddingVertical: 12, paddingHorizontal: 20, gap: 8,
              }}
            >
              <Ionicons name="language-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post-Submission Wrong Answer Scaffolding Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={wrongFeedbackVisible}
        onRequestClose={handleDismissWrongFeedback}
      >
        <TouchableOpacity
          style={styles.reviewModalOverlay}
          activeOpacity={1}
          onPress={handleDismissWrongFeedback}
        >
          <TouchableOpacity
            style={styles.reviewModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.reviewModalHeader}>
              <View style={styles.reviewHeaderBadge}>
                <Ionicons name="bulb" size={20} color="#D97706" />
                <Text style={styles.reviewHeaderTitle}>
                  Let's Review: {wrongFeedbackData?.kcDisplayName || 'Concept'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleDismissWrongFeedback} style={styles.reviewCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Your Choice vs Correct Answer Cards */}
            <View style={styles.reviewCardsRow}>
              {/* Selected Choice (Wrong) */}
              <View style={styles.reviewWrongBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Ionicons name="close-circle" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.reviewWrongLabel}>Your Answer</Text>
                </View>
                <Text style={styles.reviewWrongText} numberOfLines={2}>
                  {wrongFeedbackData?.selectedText}
                </Text>
              </View>

              {/* Correct Answer */}
              <View style={styles.reviewCorrectBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.reviewCorrectLabel}>Correct Answer</Text>
                </View>
                <Text style={styles.reviewCorrectText} numberOfLines={2}>
                  {wrongFeedbackData?.correctText}
                </Text>
              </View>
            </View>

            {/* Integrated Explanation + ASL Scaffold Card */}
            <View style={styles.reviewExplanationCard}>
              <Text style={styles.reviewExplanationLabel}>EXPLANATION</Text>
              <Text style={styles.reviewExplanationBody}>
                {wrongFeedbackData?.reasonEn}
              </Text>

              {/* ASL / Deaf English Scaffolding Box */}
              {!!wrongFeedbackData?.reasonAsl && (
                <View style={styles.reviewAslBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <Ionicons name="hand-left" size={12} color={COLORS.primary} />
                    <Text style={styles.reviewAslLabel}>ASL / DEAF ENGLISH</Text>
                  </View>
                  <Text style={styles.reviewAslBody}>
                    {wrongFeedbackData?.reasonAsl}
                  </Text>
                </View>
              )}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.reviewContinueBtn}
              activeOpacity={0.85}
              onPress={handleDismissWrongFeedback}
            >
              <Text style={styles.reviewContinueBtnText}>Next Question</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  hintHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary,
  },
  hintHeaderBtnUsed: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  hintHeaderBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  hintHeaderBtnTextUsed: { color: '#9CA3AF' },
  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FEF3C7', borderRadius: 10,
    padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  hintBannerText: { fontSize: 14, color: '#92400E', flex: 1, lineHeight: 20 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  questionText: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16, lineHeight: 26 },
  questionImageWrapper: { width: '100%', alignItems: 'center', marginBottom: 16 },
  questionImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 16 },
  optionsContainer: { gap: 10 },
  optionCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  optionCorrect: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.success,
    backgroundColor: COLORS.successBg,
  },
  optionWrong: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorBg,
  },
  optionLetterBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetter: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  optionText: { fontSize: 16, color: COLORS.textPrimary, flex: 1, fontWeight: '500' },
  matchingContainer: { flexDirection: 'row', gap: 16 },
  matchingColumn: { flex: 1, gap: 10 },
  matchingColHeader: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  matchingChip: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#F8FAFC', alignItems: 'center' },
  matchingChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, borderWidth: 2 },
  matchingChipMatched: { borderColor: COLORS.success, backgroundColor: COLORS.successBg, opacity: 0.6 },
  matchingChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  matchingChipTextMatched: { color: COLORS.success },
  finishedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  finishedTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16 },
  finishedScore: { fontSize: 22, color: COLORS.primary, fontWeight: '700', marginTop: 8 },
  difficultyBadge: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textTransform: 'uppercase', fontWeight: '700' },
  unlockCelebrationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF08A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  unlockCelebrationText: { color: '#854D0E', fontWeight: '700', fontSize: 15 },
  finishedActions: { width: '100%', gap: 10, marginTop: 28 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  retryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  doneBtn: { backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3 },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  aslFloatBtn: {
    position: 'absolute', bottom: 100, right: 16,
    backgroundColor: '#7C3AED', borderRadius: 24,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    elevation: 6, shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8,
  },
  aslFloatBtnText: { color: 'white', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  aslDrawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  aslDrawerContent: {
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  aslDrawerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  aslOriginalBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 14 },
  aslResultBox: { backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginTop: 14 },
  aslResultLabel: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 4 },
  optionEliminated: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
  },
  optionLetterBoxEliminated: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
  },
  optionLetterEliminated: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  optionTextEliminated: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#DC2626',
    color: '#374151',
    fontWeight: '500',
  },
  eliminatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  eliminatedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  strikethroughLine: {
    position: 'absolute',
    left: 56,
    height: 3,
    backgroundColor: '#EF4444',
    borderRadius: 2,
    top: '50%',
    zIndex: 10,
  },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  doneButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 20 },
  doneButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  praisePopBadge: {
    position: 'absolute',
    right: 14,
    top: -12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 20,
  },
  praisePopText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  matchingPraisePopBadge: {
    alignSelf: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  offlineSavedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  offlineSavedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  rewardCardPassed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 6,
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  rewardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rewardStarCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400E',
  },
  rewardSubtext: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    marginTop: 2,
  },
  rewardCardFailed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 6,
    width: '100%',
  },
  rewardIconCircleFailed: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rewardFailedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
  rewardFailedSubtext: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  bktMasteryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  bktMasteryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
  // Scaffolding Callout for Eliminated Distractor
  eliminationCalloutBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  eliminationCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eliminationCalloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  eliminationCalloutReason: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 20,
  },
  // Wrong Answer Scaffolding Review Modal
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reviewModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  reviewHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  reviewCloseBtn: {
    padding: 4,
  },
  reviewCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  reviewWrongBox: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
  },
  reviewWrongLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 2,
  },
  reviewWrongText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
    textDecorationLine: 'line-through',
    marginTop: 3,
  },
  reviewCorrectBox: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 10,
  },
  reviewCorrectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 2,
  },
  reviewCorrectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginTop: 3,
  },
  reviewExplanationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 16,
  },
  reviewExplanationLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reviewExplanationBody: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
    lineHeight: 20,
    fontWeight: '500',
  },
  reviewAslBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  reviewAslLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  reviewAslBody: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primaryDark,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  reviewContinueBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  reviewContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
