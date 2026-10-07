import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../context/config';
import { useAuth } from '../context/AuthContext';

interface Slide {
  description_text: string;
  image_url?: string;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface Question {
  id?: number;
  question_text: string;
  question_type: string;
  image_url?: string;
  options: string[];
  correct_option_index: number;
  matching_pairs?: MatchingPair[];
  hint?: string;
}

interface Lesson {
  id: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lesson_group_id?: number;
  slides?: Slide[];
  slide_count?: number;
  quiz_id?: number | null;
  quiz_question_count?: number;
}

interface LessonGroup {
  id: number;
  topic_id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
}

const getStoryGrammarBadge = (index: number) => {
  switch (index % 4) {
    case 0:
      return {
        label: "Character & Setting",
        icon: "person-outline" as const,
        color: "#7C3AED",
        bgColor: "#EDE9FE",
      };
    case 1:
      return {
        label: "Problem & Challenge",
        icon: "alert-circle-outline" as const,
        color: "#D97706",
        bgColor: "#FEF3C7",
      };
    case 2:
      return {
        label: "Action & Rules",
        icon: "build-outline" as const,
        color: "#4F46E5",
        bgColor: "#EEF2FF",
      };
    default:
      return {
        label: "Resolution & Outcome",
        icon: "checkmark-circle-outline" as const,
        color: "#059669",
        bgColor: "#D1FAE5",
      };
  }
};

const resolveImageUrl = (url?: string): string => {
  if (!url) return '';
  // Normalize any hardcoded IP or localhost to current active API_URL
  if (url.includes('/static/')) {
    const filename = url.substring(url.indexOf('/static/'));
    return `${API_URL}${filename}`;
  }
  return url;
};

export default function TeacherDashboardScreen() {
  const { user, logout } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1000;

  const [activeTab, setActiveTab] = useState<'current' | 'lessons' | 'quizzes' | 'analytics'>('current');
  const [selectedTopicId, setSelectedTopicId] = useState('story-grammar');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [showModalStudentPreview, setShowModalStudentPreview] = useState(false);

  // Lessons State
  const [lessonGroups, setLessonGroups] = useState<LessonGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [expandedStoryIds, setExpandedStoryIds] = useState<number[]>([]);

  const toggleStoryExpand = (groupId: number) => {
    setExpandedStoryIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };
  const [lessonGroupName, setLessonGroupName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [descriptions, setDescriptions] = useState<Slide[]>([{ description_text: '', image_url: '' }]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [submittingLesson, setSubmittingLesson] = useState(false);

  // Edit Lesson Slides Modal
  const [editingLesson, setEditingLesson] = useState<{ id: number; groupTitle: string; difficulty: string } | null>(null);
  const [editSlides, setEditSlides] = useState<Slide[]>([]);
  const [activeEditSlideIndex, setActiveEditSlideIndex] = useState(0);
  const [savingEditSlides, setSavingEditSlides] = useState(false);

  // Edit Quiz Modal
  const [editingQuiz, setEditingQuiz] = useState<{ id: number; title: string; difficulty: string } | null>(null);
  const [editQuizQuestions, setEditQuizQuestions] = useState<Question[]>([]);
  const [loadingQuizQuestions, setLoadingQuizQuestions] = useState(false);
  const [savingEditQuiz, setSavingEditQuiz] = useState(false);

  // Trash & History State
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quizzes State
  const [selectedLessonGroupId, setSelectedLessonGroupId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedQuizDifficulty, setSelectedQuizDifficulty] = useState<string>('easy');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: '',
      question_type: 'descriptive',
      image_url: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      matching_pairs: [{ left: '', right: '' }],
      hint: '',
    },
  ]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedStudentForInspect, setSelectedStudentForInspect] = useState<any>(null);
  const [studentQuizAttempts, setStudentQuizAttempts] = useState<any[]>([]);
  const [studentKcMastery, setStudentKcMastery] = useState<any[]>([]);
  const [studentBadges, setStudentBadges] = useState<any[]>([]);
  const [loadingStudentDetails, setLoadingStudentDetails] = useState<boolean>(false);
  const [studentDossierTab, setStudentDossierTab] = useState<'attempts' | 'mastery' | 'badges'>('attempts');
  const [studentAttemptFilter, setStudentAttemptFilter] = useState<'all' | 'passed' | 'review'>('all');
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');
  const [studentSortBy, setStudentSortBy] = useState<'stars' | 'attempts' | 'needs_support'>('stars');

  // Pulse & Readiness Metrics
  const totalStories = lessonGroups.length;
  const totalTiers = lessonGroups.reduce((acc, g) => acc + (g.lessons?.length || 0), 0);
  const storiesNeedingQuizzes = lessonGroups.filter((g) =>
    (g.lessons || []).some((l) => !l.quiz_id)
  );
  const completeStories = lessonGroups.filter((g) => {
    const tiers = ['easy', 'medium', 'hard'];
    return tiers.every((t) => (g.lessons || []).some((l) => l.difficulty === t && l.quiz_id));
  });

  const topics = [
    { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline' as const },
    { id: 'mathematics', name: 'Mathematics', icon: 'calculator-outline' as const },
    { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'hardware-chip-outline' as const },
    { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline' as const },
  ];

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  // Fetch Lesson Groups
  const fetchLessonGroups = useCallback(async (topicId: string) => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson-groups/${topicId}`);
      if (!res.ok) throw new Error('Failed to fetch lesson groups');
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => {
            if (b.created_at && a.created_at) {
              const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              if (diff !== 0) return diff;
            }
            return (b.id || 0) - (a.id || 0);
          })
        : [];
      setLessonGroups(sorted);
    } catch {
      // Offline fallback
      setLessonGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // Fetch Existing Quizzes
  const fetchQuizzes = useCallback(async (topicId: string) => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch(`${API_URL}/quizzes/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setExistingQuizzes(Array.isArray(data) ? data : []);
      }
    } catch {
      setExistingQuizzes([]);
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  // Fetch Trash
  const fetchTrash = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const res = await fetch(`${API_URL}/admin/trash`);
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data.trash || []);
        setTrashCount(data.total_count || 0);
      }
    } catch {
      setTrashItems([]);
      setTrashCount(0);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/admin/teacher-history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.history || []);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch Student Analytics Deep-Dive
  const handleInspectStudent = useCallback(async (student: any) => {
    setSelectedStudentForInspect(student);
    setLoadingStudentDetails(true);
    setStudentDossierTab('attempts');
    setStudentAttemptFilter('all');
    try {
      const studentId = student.user_id || student.id;
      const [attemptsRes, masteryRes, badgesRes] = await Promise.all([
        fetch(`${API_URL}/teacher/student/${studentId}/quiz-attempts`),
        fetch(`${API_URL}/student/${studentId}/kc-mastery`),
        fetch(`${API_URL}/student/${studentId}/badges`),
      ]);

      if (attemptsRes.ok) {
        const attemptsData = await attemptsRes.json();
        setStudentQuizAttempts(attemptsData.attempts || []);
      } else {
        setStudentQuizAttempts([]);
      }

      if (masteryRes.ok) {
        const masteryData = await masteryRes.json();
        setStudentKcMastery(Array.isArray(masteryData) ? masteryData : []);
      } else {
        setStudentKcMastery([]);
      }

      if (badgesRes.ok) {
        const badgesData = await badgesRes.json();
        setStudentBadges(badgesData.badges || (Array.isArray(badgesData) ? badgesData : []));
      } else {
        setStudentBadges([]);
      }
    } catch {
      setStudentQuizAttempts([]);
      setStudentKcMastery([]);
      setStudentBadges([]);
    } finally {
      setLoadingStudentDetails(false);
    }
  }, []);

  useEffect(() => {
    fetchLessonGroups(selectedTopicId);
    fetchQuizzes(selectedTopicId);
    fetchTrash();
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [selectedTopicId, activeTab, fetchLessonGroups, fetchQuizzes, fetchTrash, fetchAnalytics]);

  // Image Upload helper
  const pickAndUploadImage = async (onSuccess: (url: string) => void) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      showAlert('Permission Required', 'Camera roll permission is needed to select an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const uri = result.assets[0].uri;
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'upload.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          const blob = await response.blob();
          let ext = '.jpg';
          if (blob.type === 'image/png') ext = '.png';
          else if (blob.type === 'image/gif') ext = '.gif';
          else if (blob.type === 'image/webp') ext = '.webp';
          const safeFilename = filename.includes('.') ? filename : `upload_${Date.now()}${ext}`;
          formData.append('file', blob, safeFilename);
        } else {
          formData.append('file', { uri, name: filename, type } as any);
        }

        const res = await fetch(`${API_URL}/admin/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        onSuccess(data.url);
      } catch (err: any) {
        showAlert('Upload Error', err.message || 'Could not upload image.');
      }
    }
  };

  // Submit Lesson
  const handleSubmitLesson = async () => {
    if (!lessonGroupName.trim()) {
      showAlert('Required Field', 'Please enter a Lesson Group title.');
      return;
    }
    const validSlides = descriptions.filter((d) => d.description_text.trim() !== '');
    if (validSlides.length === 0) {
      showAlert('Required Field', 'Please add text for at least one slide.');
      return;
    }

    setSubmittingLesson(true);
    try {
      let groupId: number | null = null;
      const existingGroup = lessonGroups.find(
        (g) => g.title.toLowerCase().trim() === lessonGroupName.toLowerCase().trim()
      );

      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        const groupRes = await fetch(`${API_URL}/admin/lesson-group/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: selectedTopicId,
            title: lessonGroupName.trim(),
            order_index: lessonGroups.length,
          }),
        });
        if (!groupRes.ok) throw new Error('Failed to create lesson group');
        const groupData = await groupRes.json();
        groupId = groupData.lesson_group.id;
      }

      const res = await fetch(`${API_URL}/admin/lesson/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          title: `${lessonGroupName.trim()} (${difficulty.toUpperCase()})`,
          difficulty,
          lesson_group_id: groupId,
          slides: validSlides,
        }),
      });

      if (res.status === 409) {
        showAlert('Duplicate Tier', `A ${difficulty.toUpperCase()} tier already exists for "${lessonGroupName}". Select a different tier.`);
        return;
      }

      if (!res.ok) throw new Error('Failed to save lesson');

      showAlert('Success', `${difficulty.toUpperCase()} lesson saved successfully.`);
      setLessonGroupName('');
      setDescriptions([{ description_text: '', image_url: '' }]);
      fetchLessonGroups(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to submit lesson.');
    } finally {
      setSubmittingLesson(false);
    }
  };

  // Delete Lesson Group (Move to Trash)
  const handleDeleteGroup = async (groupId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move "${title}" and all its difficulty tiers to Trash?`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson-group/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Lesson group "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchTrash();
        fetchHistory();
      }
    } catch {
      showAlert('Error', 'Could not move lesson group to trash.');
    }
  };

  // Delete Individual Lesson Tier (Move to Trash)
  const handleDeleteLesson = async (lessonId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move "${title}" to Trash?`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson/${lessonId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Lesson "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchTrash();
        fetchHistory();
      } else {
        showAlert('Error', 'Could not delete lesson.');
      }
    } catch {
      showAlert('Error', 'Could not delete lesson.');
    }
  };

  // Delete Quiz (Move to Trash)
  const handleDeleteQuiz = async (quizId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move quiz "${title}" to Trash? This will allow you to create a new quiz for this lesson difficulty.`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/quiz/${quizId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Quiz "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchQuizzes(selectedTopicId);
        fetchTrash();
        fetchHistory();
      } else {
        showAlert('Error', 'Could not delete quiz.');
      }
    } catch {
      showAlert('Error', 'Could not delete quiz.');
    }
  };

  // Slide Editor Handlers
  const handleOpenEditSlides = (lesson: Lesson, groupTitle: string) => {
    setEditingLesson({ id: lesson.id, groupTitle, difficulty: lesson.difficulty });
    setEditSlides((lesson.slides && lesson.slides.length > 0) ? JSON.parse(JSON.stringify(lesson.slides)) : [{ description_text: '', image_url: '' }]);
    setActiveEditSlideIndex(0);
  };

  const handleSaveEditSlides = async () => {
    if (!editingLesson) return;
    const valid = editSlides.filter(s => s.description_text.trim() !== '');
    if (valid.length === 0) {
      showAlert('Required', 'At least one slide with text is required.');
      return;
    }
    setSavingEditSlides(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson/${editingLesson.id}/slides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: valid }),
      });
      if (!res.ok) throw new Error('Failed to update slides.');
      showAlert('Success', 'Lesson slides updated successfully.');
      setEditingLesson(null);
      fetchLessonGroups(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update slides.');
    } finally {
      setSavingEditSlides(false);
    }
  };

  // Quiz Editor Handlers
  const handleOpenEditQuiz = async (quizId: number, groupTitle: string, difficulty: string) => {
    setEditingQuiz({ id: quizId, title: `${groupTitle} Quiz (${difficulty.toUpperCase()})`, difficulty });
    setLoadingQuizQuestions(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${quizId}/questions`);
      if (!res.ok) throw new Error('Failed to fetch questions.');
      const data = await res.json();
      setEditQuizQuestions(Array.isArray(data) ? data : []);
    } catch {
      showAlert('Error', 'Could not load quiz questions.');
      setEditingQuiz(null);
    } finally {
      setLoadingQuizQuestions(false);
    }
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz) return;
    const valid = editQuizQuestions.filter(q => q.question_text.trim() !== '');
    if (valid.length === 0) {
      showAlert('Required', 'At least one question is required.');
      return;
    }
    setSavingEditQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${editingQuiz.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: valid }),
      });
      if (!res.ok) throw new Error('Failed to update quiz questions.');
      showAlert('Success', 'Quiz updated successfully.');
      setEditingQuiz(null);
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update quiz.');
    } finally {
      setSavingEditQuiz(false);
    }
  };

  // Trash Handlers
  const handleRestoreItem = async (itemType: string, itemId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/trash/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          teacher_name: user?.name || user?.username || 'Teacher',
        }),
      });
      if (!res.ok) throw new Error('Failed to restore item.');
      showAlert('Restored', 'Item restored to active curriculum.');
      fetchTrash();
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not restore item.');
    }
  };

  const handlePermanentDeleteItem = async (itemType: string, itemId: number, title: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Permanently delete "${title}"? This cannot be undone.`)
      : true;
    if (!confirm) return;

    try {
      const res = await fetch(`${API_URL}/admin/trash/permanent`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          teacher_name: user?.name || user?.username || 'Teacher',
        }),
      });
      if (!res.ok) throw new Error('Failed to permanently delete item.');
      showAlert('Deleted', 'Item permanently removed.');
      fetchTrash();
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not delete item permanently.');
    }
  };

  // Active selected lesson group for quiz creation
  const activeGroup = (selectedLessonGroupId !== null
    ? lessonGroups.find((g) => g.id === selectedLessonGroupId)
    : lessonGroups[0]) || null;

  // Selected lesson object and whether it already has a quiz
  const selectedLessonObj = (selectedLessonId
    ? activeGroup?.lessons?.find((l) => l.id === selectedLessonId)
    : activeGroup?.lessons?.find((l) => l.difficulty === selectedQuizDifficulty)) || null;
  const selectedLessonHasQuiz = Boolean(selectedLessonObj?.quiz_id);

  // Submit Quiz (Automatic KC linking)
  const handleSubmitQuiz = async () => {
    if (selectedLessonHasQuiz) {
      showAlert('Quiz Already Exists', `A quiz has already been created for the ${selectedQuizDifficulty.toUpperCase()} tier.`);
      return;
    }
    if (!quizTitle.trim()) {
      showAlert('Required Field', 'Please enter a Quiz Title.');
      return;
    }
    if (!selectedLessonId) {
      showAlert('Required Field', 'Please select a Lesson for this quiz.');
      return;
    }

    setSubmittingQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quizTitle.trim(),
          topic_id: selectedTopicId,
          lesson_id: selectedLessonId,
          difficulty: selectedQuizDifficulty,
          questions,
        }),
      });

      if (!res.ok) throw new Error('Failed to create quiz.');

      showAlert('Success', 'Quiz created and linked successfully.');
      setQuizTitle('');
      setQuestions([
        {
          question_text: '',
          question_type: 'descriptive',
          image_url: '',
          options: ['', '', '', ''],
          correct_option_index: 0,
          matching_pairs: [{ left: '', right: '' }],
          hint: '',
        },
      ]);
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not create quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Auto-sync selected lesson when activeGroup changes
  useEffect(() => {
    if (activeGroup && activeGroup.lessons && activeGroup.lessons.length > 0) {
      const match = activeGroup.lessons.find((l) => l.difficulty === selectedQuizDifficulty) || activeGroup.lessons[0];
      setSelectedLessonId(match.id);
      setSelectedQuizDifficulty(match.difficulty);
    } else if (!activeGroup || !activeGroup.lessons || activeGroup.lessons.length === 0) {
      setSelectedLessonId(null);
    }
  }, [activeGroup?.id]);

  const renderStudentPhoneMockup = (
    slides: Slide[],
    currentIndex: number,
    groupTitle: string,
    tierDifficulty: string,
    onNavigateSlide?: (idx: number) => void
  ) => {
    const safeIdx = Math.min(currentIndex, Math.max(0, slides.length - 1));
    const activeSlide = slides[safeIdx] || { description_text: '', image_url: '' };
    const progressPercent = slides.length > 0 ? ((safeIdx + 1) / slides.length) * 100 : 0;
    const stageInfo = getStoryGrammarBadge(safeIdx);

    return (
      <View style={styles.phoneMockupFrame}>
        {/* Phone Screen Canvas */}
        <View style={styles.phoneScreenContent}>
          {/* Android Status Bar with Centered Punch-Hole Camera */}
          <View style={styles.phoneStatusBar}>
            <Text style={styles.phoneStatusTime}>10:00</Text>
            <View style={styles.phonePunchHoleCameraWrapper}>
              <View style={styles.phonePunchHoleCamera} />
            </View>
            <View style={styles.phoneStatusIcons}>
              <Ionicons name="cellular" size={11} color="#0F172A" />
              <Ionicons name="wifi" size={11} color="#0F172A" />
              <Ionicons name="battery-full" size={13} color="#0F172A" />
            </View>
          </View>

          {/* Student Header */}
          <View style={styles.phoneStudentHeader}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.phoneStoryTitle} numberOfLines={1}>
                {groupTitle || 'New Lesson Story'}
              </Text>
              <Text style={styles.phoneStorySubtitle}>
                {topics.find((t) => t.id === selectedTopicId)?.name || 'ASL'}
              </Text>
            </View>
            <View
              style={[
                styles.phoneTierPill,
                tierDifficulty === 'easy' && styles.phoneTierPillEasy,
                tierDifficulty === 'medium' && styles.phoneTierPillMedium,
                tierDifficulty === 'hard' && styles.phoneTierPillHard,
              ]}
            >
              <Text
                style={[
                  styles.phoneTierPillText,
                  tierDifficulty === 'easy' && styles.phoneTierPillTextEasy,
                  tierDifficulty === 'medium' && styles.phoneTierPillTextMedium,
                  tierDifficulty === 'hard' && styles.phoneTierPillTextHard,
                ]}
              >
                {(tierDifficulty || 'EASY').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Progress Header & Bar */}
          <View style={styles.phoneProgressContainer}>
            <View style={styles.phoneProgressRow}>
              <View style={[styles.phoneStageBadge, { backgroundColor: stageInfo.bgColor }]}>
                <Ionicons name={stageInfo.icon} size={10} color={stageInfo.color} style={{ marginRight: 3 }} />
                <Text style={[styles.phoneStageBadgeText, { color: stageInfo.color }]}>
                  {stageInfo.label}
                </Text>
              </View>
              <Text style={styles.phoneProgressText}>
                Slide {safeIdx + 1} of {slides.length}
              </Text>
            </View>
            <View style={styles.phoneProgressBarBg}>
              <View style={[styles.phoneProgressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Slide Visual Image */}
          {activeSlide.image_url ? (
            <Image
              source={{ uri: resolveImageUrl(activeSlide.image_url) }}
              style={styles.phoneSlideImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.phoneImgPlaceholder}>
              <Ionicons name="image-outline" size={24} color="#94A3B8" />
              <Text style={styles.phoneImgPlaceholderText}>Visual sign image will display here</Text>
            </View>
          )}

          {/* Narration Reading Card */}
          <View style={styles.phoneNarrationCard}>
            <Text style={styles.phoneNarrationLabel}>STORY READING</Text>
            <ScrollView style={{ maxHeight: 75 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.phoneNarrationText}>
                {activeSlide.description_text.trim() || 'Type your slide narration in the editor to see it live on the student screen...'}
              </Text>
            </ScrollView>
          </View>

          {/* Interactive Navigation Controls on Mockup */}
          <View style={styles.phoneBottomControls}>
            {safeIdx > 0 && (
              <TouchableOpacity
                style={styles.phoneNavBtn}
                onPress={() => onNavigateSlide && onNavigateSlide(Math.max(0, safeIdx - 1))}
              >
                <Ionicons name="arrow-back" size={13} color="#4F46E5" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.phoneNextBtn}
              onPress={() => {
                if (safeIdx < slides.length - 1 && onNavigateSlide) {
                  onNavigateSlide(safeIdx + 1);
                }
              }}
            >
              <Text style={styles.phoneNextBtnText}>
                {safeIdx === slides.length - 1 ? 'Start Quiz ✓' : 'Next Slide →'}
              </Text>
            </TouchableOpacity>

            {safeIdx > 0 && (
              <View style={{ width: 28 }} />
            )}
          </View>

          {/* Android 3-Button Navigation Bar (Back, Home, Recent Apps) */}
          <View style={styles.androidNavBar}>
            <TouchableOpacity
              style={styles.androidNavBtn}
              activeOpacity={0.6}
              disabled={safeIdx === 0}
              onPress={() => onNavigateSlide && onNavigateSlide(Math.max(0, safeIdx - 1))}
            >
              <Ionicons
                name="chevron-back"
                size={15}
                color={safeIdx === 0 ? "#475569" : "#94A3B8"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.androidNavBtn}
              activeOpacity={0.6}
              onPress={() => onNavigateSlide && onNavigateSlide(0)}
            >
              <Ionicons name="radio-button-off" size={13} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.androidNavBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="square-outline" size={12} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Workspace Body: Sidebar + Main Content */}
        <View style={styles.workspaceBody}>
          {/* Collapsible Subject Sidebar */}
          <View style={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded]}>
            {/* Sidebar Top: Teacher Workspace Branding & Minimize Arrow */}
            <View style={[styles.sidebarBrandHeader, sidebarCollapsed && styles.sidebarBrandHeaderCollapsed]}>
              {!sidebarCollapsed ? (
                <>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.sidebarBrandTitle}>Teacher Workspace</Text>
                    <Text style={styles.sidebarBrandSubtitle} numberOfLines={1}>
                      {user?.name || 'Educator'} ({user?.username})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sidebarToggleBtn}
                    onPress={() => setSidebarCollapsed(true)}
                  >
                    <Ionicons name="chevron-back-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.sidebarToggleBtnCollapsed}
                  onPress={() => setSidebarCollapsed(false)}
                >
                  <Ionicons name="chevron-forward-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Subject Navigations */}
            <ScrollView style={styles.sidebarNavList} showsVerticalScrollIndicator={false}>
              {topics.map((t) => {
                const isSelected = selectedTopicId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.sidebarItem,
                      sidebarCollapsed && styles.sidebarItemCollapsed,
                      isSelected && (sidebarCollapsed ? styles.sidebarItemCollapsedActive : styles.sidebarItemActive),
                    ]}
                    onPress={() => setSelectedTopicId(t.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarItemIconBox, isSelected && styles.sidebarItemIconBoxActive]}>
                      <Ionicons
                        name={t.icon}
                        size={18}
                        color={isSelected ? '#FFFFFF' : '#64748B'}
                      />
                    </View>
                    {!sidebarCollapsed && (
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.sidebarItemText, isSelected && styles.sidebarItemTextActive]}
                          numberOfLines={1}
                        >
                          {t.name}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sidebar Bottom: History, Trash, Log Out */}
            {!sidebarCollapsed ? (
              <View style={styles.sidebarFooter}>
                <TouchableOpacity
                  style={styles.sidebarActionBtn}
                  onPress={() => {
                    fetchHistory();
                    setShowHistoryModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={16} color="#475569" />
                  <Text style={styles.sidebarActionBtnText}>Teacher History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarActionBtn}
                  onPress={() => {
                    fetchTrash();
                    setShowTrashModal(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                    <Ionicons name="trash-bin-outline" size={16} color="#475569" />
                    <Text style={styles.sidebarActionBtnText}>Trash Bin</Text>
                  </View>
                  {trashCount > 0 && (
                    <View style={styles.sidebarTrashBadge}>
                      <Text style={styles.sidebarTrashBadgeText}>{trashCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.sidebarFooterDivider} />

                <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  <Text style={styles.sidebarLogoutBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sidebarFooterCollapsed}>
                <TouchableOpacity
                  style={styles.sidebarActionBtnCollapsed}
                  onPress={() => {
                    fetchHistory();
                    setShowHistoryModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarActionBtnCollapsed}
                  onPress={() => {
                    fetchTrash();
                    setShowTrashModal(true);
                  }}
                >
                  <Ionicons name="trash-bin-outline" size={18} color="#475569" />
                  {trashCount > 0 && <View style={styles.sidebarTrashBadgeDot} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarLogoutBtnCollapsed} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main Workspace Body */}
          <View style={styles.mainArea}>
            {/* Navigation Tabs (Subject header removed for maximum workspace) */}
            <View style={styles.mainHeaderStrip}>
              <View style={styles.tabBar}>
                {[
                  { id: 'current' as const, label: 'Current Lessons', icon: 'layers-outline' as const },
                  { id: 'lessons' as const, label: 'Create Lesson', icon: 'add-circle-outline' as const },
                  { id: 'quizzes' as const, label: 'Create Quiz', icon: 'help-circle-outline' as const },
                  { id: 'analytics' as const, label: 'Class Analytics', icon: 'bar-chart-outline' as const },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                    onPress={() => {
                      if (tab.id === 'analytics') {
                        setSelectedStudentForInspect(null);
                      }
                      setActiveTab(tab.id);
                    }}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={18}
                      color={activeTab === tab.id ? '#4F46E5' : '#64748B'}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Content Area */}
            <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* TAB 1: CURRENT LESSONS & QUIZZES HUB */}
          {activeTab === 'current' && (
            <View>
              {/* CLASS PULSE & ACTIONABLE INTERVENTION HUB */}
              <View style={styles.pulseContainer}>
                {/* Header Row: Topic Details & Action Buttons */}
                <View style={styles.pulseHeaderRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={styles.pulseTitleRow}>
                      <Text style={styles.pulseTitle}>
                        {topics.find((t) => t.id === selectedTopicId)?.name || 'Subject'} Curriculum
                      </Text>
                      <View style={styles.pulseActiveBadge}>
                        <View style={styles.pulseActiveDot} />
                        <Text style={styles.pulseActiveBadgeText}>Active Topic</Text>
                      </View>
                    </View>
                    <Text style={styles.pulseSubtitle}>
                      Manage stories, difficulty tiers, visual ASL slides, and assessment quizzes.
                    </Text>
                  </View>

                  <View style={styles.pulseHeaderActions}>
                    <TouchableOpacity
                      style={styles.pulseActionBtnSecondary}
                      onPress={() => {
                        fetchLessonGroups(selectedTopicId);
                        fetchQuizzes(selectedTopicId);
                      }}
                    >
                      <Ionicons name="refresh-outline" size={15} color="#4F46E5" />
                      <Text style={styles.pulseActionBtnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pulseActionBtnPrimary}
                      onPress={() => setActiveTab('lessons')}
                    >
                      <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.pulseActionBtnPrimaryText}>New Story</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Actionable Pulse Cards (Not passive stats) */}
                <View style={styles.pulseCardsRow}>
                  {/* Card 1: Quiz Status & Interventions */}
                  {storiesNeedingQuizzes.length > 0 ? (
                    <TouchableOpacity
                      style={[styles.pulseCard, styles.pulseCardAmber]}
                      onPress={() => setActiveTab('quizzes')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.pulseCardIconAmber}>
                        <Ionicons name="alert-circle" size={18} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pulseCardTitleAmber}>
                          {storiesNeedingQuizzes.length} {storiesNeedingQuizzes.length === 1 ? 'Story Needs' : 'Stories Need'} Quiz
                        </Text>
                        <Text style={styles.pulseCardSubAmber}>
                          Tiers exist without assessments. Tap to attach quizzes.
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#D97706" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.pulseCard, styles.pulseCardEmerald]}>
                      <View style={styles.pulseCardIconEmerald}>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pulseCardTitleEmerald}>All Quizzes Attached</Text>
                        <Text style={styles.pulseCardSubEmerald}>
                          All difficulty tiers are fully equipped for student practice.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Card 2: Tier Coverage / Readiness */}
                  <View style={[styles.pulseCard, styles.pulseCardIndigo]}>
                    <View style={styles.pulseCardIconIndigo}>
                      <Ionicons name="layers" size={18} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pulseCardTitleIndigo}>
                        {totalTiers} Tiers Across {totalStories} {totalStories === 1 ? 'Story' : 'Stories'}
                      </Text>
                      <Text style={styles.pulseCardSubIndigo}>
                        {completeStories.length} {completeStories.length === 1 ? 'story has' : 'stories have'} complete Easy, Med & Hard tiers.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {loadingGroups ? (
                <ActivityIndicator color="#4F46E5" size="large" style={{ marginVertical: 30 }} />
              ) : lessonGroups.length === 0 ? (
                <View style={styles.card}>
                  <View style={styles.emptyStateContainer}>
                    <Ionicons name="book-outline" size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyStateTitle}>No Lessons Created Yet</Text>
                    <Text style={styles.emptyStateText}>
                      Get started by adding your first story and difficulty slides.
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginTop: 14, alignSelf: 'center', paddingHorizontal: 24 }]}
                      onPress={() => setActiveTab('lessons')}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>Create First Lesson</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                lessonGroups.map((group) => {
                  const tiers = ['easy', 'medium', 'hard'] as const;
                  const availableTiers = tiers.filter((t) => (group.lessons || []).some((l) => l.difficulty === t));
                  const isExpanded = expandedStoryIds.includes(group.id);

                  return (
                    <View key={group.id} style={styles.curriculumStoryCard}>
                      {/* Story Card Header (Click to expand/collapse) */}
                      <TouchableOpacity
                        style={[
                          styles.storyCardHeader,
                          !isExpanded && styles.storyCardHeaderCollapsed,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => toggleStoryExpand(group.id)}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="book" size={18} color="#4F46E5" />
                            <Text style={styles.storyCardTitle}>{group.title}</Text>
                            <View
                              style={[
                                styles.expandChevronBadge,
                                isExpanded && styles.expandChevronBadgeActive,
                              ]}
                            >
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={isExpanded ? '#4F46E5' : '#64748B'}
                              />
                            </View>
                          </View>
                          <Text style={styles.storyCardSub}>
                            {availableTiers.length} of 3 tiers created ({availableTiers.map((t) => t.toUpperCase()).join(', ') || 'None'})
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.storyDeleteBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleDeleteGroup(group.id, group.title);
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          <Text style={styles.storyDeleteBtnText}>Trash Story</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {/* Tier Cards List (Only shown when expanded) */}
                      {isExpanded && (
                        <View style={styles.storyTiersContainer}>
                        {tiers.map((tier) => {
                          const tierLesson = (group.lessons || []).find((l) => l.difficulty === tier);
                          const slideCount = tierLesson ? (tierLesson.slide_count ?? tierLesson.slides?.length ?? 0) : 0;
                          const hasQuiz = Boolean(tierLesson?.quiz_id);
                          const quizQuestionsCount = tierLesson?.quiz_question_count || 0;

                          if (tierLesson) {
                            return (
                              <View key={tier} style={styles.tierCardActive}>
                                <View style={styles.tierCardRow}>
                                  {/* Difficulty Badge */}
                                  <View
                                    style={[
                                      styles.tierBadge,
                                      tier === 'easy' && styles.tierBadgeEasy,
                                      tier === 'medium' && styles.tierBadgeMedium,
                                      tier === 'hard' && styles.tierBadgeHard,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tierBadgeText,
                                        tier === 'easy' && styles.tierBadgeTextEasy,
                                        tier === 'medium' && styles.tierBadgeTextMedium,
                                        tier === 'hard' && styles.tierBadgeTextHard,
                                      ]}
                                    >
                                      {tier.toUpperCase()}
                                    </Text>
                                  </View>

                                  {/* Slide Info & Edit Slides Button */}
                                  <View style={styles.tierSection}>
                                    <View style={styles.tierInfoRow}>
                                      <Ionicons name="images-outline" size={15} color="#475569" />
                                      <Text style={styles.tierInfoText}>
                                        {slideCount} {slideCount === 1 ? 'Slide' : 'Slides'}
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.actionBtnSecondary}
                                      onPress={() => handleOpenEditSlides(tierLesson, group.title)}
                                    >
                                      <Ionicons name="create-outline" size={14} color="#4F46E5" />
                                      <Text style={styles.actionBtnSecondaryText}>Edit Slides</Text>
                                    </TouchableOpacity>
                                  </View>

                                  {/* Attached Quiz Info */}
                                  <View style={styles.tierSection}>
                                    <View style={styles.tierInfoRow}>
                                      <Ionicons
                                        name={hasQuiz ? 'help-circle' : 'alert-circle-outline'}
                                        size={15}
                                        color={hasQuiz ? '#059669' : '#D97706'}
                                      />
                                      <Text style={hasQuiz ? styles.tierInfoTextSuccess : styles.tierInfoTextWarning}>
                                        {hasQuiz ? `Quiz Attached (${quizQuestionsCount}Q)` : 'No quiz attached'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Right side: Edit Quiz and Delete Quiz Actions (replaced gray trash) */}
                                  <View style={styles.tierActionsRight}>
                                    {hasQuiz ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <TouchableOpacity
                                          style={styles.actionBtnSuccess}
                                          onPress={() => handleOpenEditQuiz(tierLesson.quiz_id!, group.title, tier)}
                                        >
                                          <Ionicons name="pencil-outline" size={13} color="#059669" />
                                          <Text style={styles.actionBtnSuccessText}>Edit Quiz</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.actionBtnDangerSmall}
                                          onPress={() => handleDeleteQuiz(tierLesson.quiz_id!, `${group.title} (${tier.toUpperCase()}) Quiz`)}
                                        >
                                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                      </View>
                                    ) : (
                                      <TouchableOpacity
                                        style={styles.actionBtnAmber}
                                        onPress={() => {
                                          setSelectedLessonGroupId(group.id);
                                          setSelectedLessonId(tierLesson.id);
                                          setSelectedQuizDifficulty(tier);
                                          setQuizTitle(`${group.title} (${tier.toUpperCase()}) Quiz`);
                                          setActiveTab('quizzes');
                                        }}
                                      >
                                        <Ionicons name="add-outline" size={14} color="#B45309" />
                                        <Text style={styles.actionBtnAmberText}>+ Add Quiz</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              </View>
                            );
                          }

                          {/* Missing Tier Row */}
                          return (
                            <View key={tier} style={styles.tierCardMissing}>
                              <View style={styles.tierBadgeMissing}>
                                <Text style={styles.tierBadgeTextMissing}>{tier.toUpperCase()}</Text>
                              </View>
                              <Text style={styles.tierMissingText}>Tier not created yet</Text>
                              <TouchableOpacity
                                style={styles.tierCreateBtn}
                                onPress={() => {
                                  setLessonGroupName(group.title);
                                  setDifficulty(tier);
                                  setActiveTab('lessons');
                                }}
                              >
                                <Ionicons name="add-circle-outline" size={14} color="#4F46E5" />
                                <Text style={styles.tierCreateBtnText}>Create {tier.toUpperCase()}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
                })
              )}
            </View>
          )}

          {/* TAB 2: CREATE LESSON & SLIDES */}
          {activeTab === 'lessons' && (
            <View>
              {/* Split Workspace: Left Editor Card, Right Sticky Android Simulator */}
              <View style={[styles.editorLayoutRow, (!isDesktop || !showStudentPreview) && styles.editorLayoutRowMobile]}>
                {/* Left Column: Lesson Form Card */}
                <View style={[styles.editorLayoutColumn, (!showStudentPreview || !isDesktop) && { minWidth: '100%' }]}>
                  <View style={styles.card}>
                    {/* Header & Student Phone Preview Toggle */}
                    <View style={styles.editorTopBar}>
                      <View style={{ flex: 1, minWidth: 220 }}>
                        <Text style={styles.cardTitle}>Add Lesson or Difficulty Tier</Text>
                        <Text style={styles.cardHelp}>
                          Create reading and visual slides for students. Knowledge components and mastery targets are generated automatically.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.previewToggleBtn, showStudentPreview && styles.previewToggleBtnActive]}
                        onPress={() => setShowStudentPreview(!showStudentPreview)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showStudentPreview ? "phone-portrait" : "phone-portrait-outline"}
                          size={15}
                          color={showStudentPreview ? "#4F46E5" : "#64748B"}
                        />
                        <Text style={[styles.previewToggleBtnText, showStudentPreview && styles.previewToggleBtnTextActive]}>
                          {showStudentPreview ? "Hide Android Preview" : "Show Android Preview"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Lesson Group Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. The Lost Puppy"
                      value={lessonGroupName}
                      onChangeText={setLessonGroupName}
                    />

                    <Text style={styles.fieldLabel}>Select Difficulty Tier</Text>
                    <View style={styles.tierRow}>
                      {(['easy', 'medium', 'hard'] as const).map((tier) => (
                        <TouchableOpacity
                          key={tier}
                          style={[styles.tierBtn, difficulty === tier && styles.tierBtnActive]}
                          onPress={() => setDifficulty(tier)}
                        >
                          <Text style={[styles.tierBtnText, difficulty === tier && styles.tierBtnTextActive]}>
                            {tier.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Visual Storyboard Filmstrip & Slide Deck Builder */}
                    <View style={styles.storyboardFilmstripWrapper}>
                      <View style={styles.filmstripHeaderRow}>
                        <Text style={styles.filmstripHeaderLabel}>
                          Lesson Storyboard Deck ({descriptions.length} {descriptions.length === 1 ? 'Slide' : 'Slides'})
                        </Text>
                        <Text style={styles.filmstripHeaderHint}>
                          Tap a slide card to edit or reorder
                        </Text>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmstripScroll}>
                        {descriptions.map((desc, idx) => {
                          const isSelected = (activeSlideIndex === idx);
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[styles.filmstripCard, isSelected && styles.filmstripCardActive]}
                              onPress={() => setActiveSlideIndex(idx)}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.filmstripBadge, isSelected && styles.filmstripBadgeActive]}>
                                <Text style={[styles.filmstripBadgeText, isSelected && styles.filmstripBadgeTextActive]}>
                                  Slide {idx + 1}
                                </Text>
                              </View>

                              {desc.image_url ? (
                                <Image source={{ uri: resolveImageUrl(desc.image_url) }} style={styles.filmstripThumb} resizeMode="cover" />
                              ) : (
                                <View style={styles.filmstripPlaceholderThumb}>
                                  <Ionicons name="image-outline" size={18} color={isSelected ? '#4F46E5' : '#94A3B8'} />
                                </View>
                              )}

                              <Text style={[styles.filmstripExcerpt, isSelected && styles.filmstripExcerptActive]} numberOfLines={2}>
                                {desc.description_text.trim() || '(No reading text)'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Add Slide Button Card in Filmstrip */}
                        <TouchableOpacity
                          style={styles.filmstripAddCard}
                          onPress={() => {
                            const nextLen = descriptions.length;
                            setDescriptions([...descriptions, { description_text: '', image_url: '' }]);
                            setActiveSlideIndex(nextLen);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.filmstripAddIconBox}>
                            <Ionicons name="add" size={20} color="#4F46E5" />
                          </View>
                          <Text style={styles.filmstripAddText}>+ Add Slide</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>

                    {/* Active Slide Canvas Editor */}
                    {descriptions[Math.min(activeSlideIndex, descriptions.length - 1)] && (() => {
                      const currentIdx = Math.min(activeSlideIndex, descriptions.length - 1);
                      const currentSlide = descriptions[currentIdx];
                      return (
                        <View style={styles.activeSlideCanvas}>
                          {/* Canvas Header & Navigation Toolbar */}
                          <View style={styles.activeSlideToolbar}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={styles.activeSlideNumberPill}>
                                <Text style={styles.activeSlideNumberPillText}>
                                  Slide {currentIdx + 1} of {descriptions.length}
                                </Text>
                              </View>
                              <Text style={styles.activeSlideHelpText}>Active Slide Editor</Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {/* Previous Slide */}
                              <TouchableOpacity
                                style={[styles.slideNavBtn, currentIdx === 0 && styles.slideNavBtnDisabled]}
                                onPress={() => setActiveSlideIndex(Math.max(0, currentIdx - 1))}
                                disabled={currentIdx === 0}
                              >
                                <Ionicons name="chevron-back" size={16} color={currentIdx === 0 ? '#94A3B8' : '#4F46E5'} />
                              </TouchableOpacity>

                              {/* Next Slide */}
                              <TouchableOpacity
                                style={[styles.slideNavBtn, currentIdx === descriptions.length - 1 && styles.slideNavBtnDisabled]}
                                onPress={() => setActiveSlideIndex(Math.min(descriptions.length - 1, currentIdx + 1))}
                                disabled={currentIdx === descriptions.length - 1}
                              >
                                <Ionicons name="chevron-forward" size={16} color={currentIdx === descriptions.length - 1 ? '#94A3B8' : '#4F46E5'} />
                              </TouchableOpacity>

                              {/* Delete Slide */}
                              {descriptions.length > 1 && (
                                <TouchableOpacity
                                  style={styles.slideDeleteBtn}
                                  onPress={() => {
                                    const updated = descriptions.filter((_, i) => i !== currentIdx);
                                    setDescriptions(updated);
                                    setActiveSlideIndex(Math.max(0, currentIdx - 1));
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* Reading / Narration Text Input */}
                          <Text style={styles.canvasFieldLabel}>Slide Reading & Narration Text</Text>
                          <TextInput
                            style={[styles.input, styles.canvasTextArea]}
                            placeholder="Enter slide story or reading passage for Deaf students..."
                            value={currentSlide.description_text}
                            onChangeText={(txt) => {
                              const updated = [...descriptions];
                              updated[currentIdx].description_text = txt;
                              setDescriptions(updated);
                            }}
                            multiline
                          />

                          {/* ASL Illustration / Sign Media Box */}
                          <Text style={[styles.canvasFieldLabel, { marginTop: 8 }]}>ASL Sign / Visual Story Illustration</Text>
                          {currentSlide.image_url ? (
                            <View style={styles.canvasImagePreviewContainer}>
                              <Image
                                source={{ uri: resolveImageUrl(currentSlide.image_url) }}
                                style={styles.canvasSlidePreviewImg}
                                resizeMode="cover"
                              />
                              <View style={styles.canvasImageActionsRow}>
                                <TouchableOpacity
                                  style={styles.canvasChangeImgBtn}
                                  onPress={() =>
                                    pickAndUploadImage((url) => {
                                      const updated = [...descriptions];
                                      updated[currentIdx].image_url = url;
                                      setDescriptions(updated);
                                    })
                                  }
                                >
                                  <Ionicons name="swap-horizontal" size={15} color="#4F46E5" />
                                  <Text style={styles.canvasChangeImgText}>Replace Image</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.canvasRemoveImgBtn}
                                  onPress={() => {
                                    const updated = [...descriptions];
                                    updated[currentIdx].image_url = '';
                                    setDescriptions(updated);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                  <Text style={styles.canvasRemoveImgText}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.canvasUploadDropzone}
                              onPress={() =>
                                pickAndUploadImage((url) => {
                                  const updated = [...descriptions];
                                  updated[currentIdx].image_url = url;
                                  setDescriptions(updated);
                                })
                              }
                            >
                              <View style={styles.canvasUploadIconCircle}>
                                <Ionicons name="cloud-upload-outline" size={24} color="#4F46E5" />
                              </View>
                              <Text style={styles.canvasUploadTitle}>Upload ASL Illustration or Gesture Sign</Text>
                              <Text style={styles.canvasUploadSubtitle}>PNG, JPG, or GIF image for students</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })()}

                    <TouchableOpacity
                      style={[styles.primaryBtn, submittingLesson && styles.primaryBtnDisabled]}
                      onPress={handleSubmitLesson}
                      disabled={submittingLesson}
                    >
                      {submittingLesson ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Save Lesson</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.viewCurriculumLinkBtn}
                    onPress={() => setActiveTab('current')}
                  >
                    <Ionicons name="layers-outline" size={16} color="#4F46E5" />
                    <Text style={styles.viewCurriculumLinkText}>View All Current Lessons & Attached Quizzes</Text>
                  </TouchableOpacity>
                </View>

                {/* Right Column: Sticky Live Android Preview Stage */}
                {showStudentPreview && (
                  <View style={[styles.phoneSimulatorColumn, !isDesktop && styles.phoneSimulatorColumnMobile]}>
                    <View style={styles.phoneSimulatorCard}>
                      <View style={styles.previewPanelHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.phoneSimulatorLiveDot} />
                          <Text style={styles.previewPanelTitle}>Live Student Preview</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.previewPanelCloseBtn}
                          onPress={() => setShowStudentPreview(false)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.previewPanelSubtitle}>
                        Real-time interactive Android student view
                      </Text>
                      {renderStudentPhoneMockup(descriptions, activeSlideIndex, lessonGroupName, difficulty, setActiveSlideIndex)}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: QUIZZES & QUESTIONS */}
          {activeTab === 'quizzes' && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Quiz for Lesson</Text>
                <Text style={styles.cardHelp}>
                  Build assessment questions. Questions are automatically linked to the lesson knowledge component.
                </Text>

                {/* 1. Target Lesson Story Selection */}
                <Text style={styles.fieldLabel}>Select Story / Lesson</Text>
                {lessonGroups.length === 0 ? (
                  <Text style={styles.emptyText}>Create a lesson first before creating a quiz.</Text>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {lessonGroups.map((g) => {
                        const isGroupActive = activeGroup?.id === g.id;
                        const lessonCount = g.lessons?.length || 0;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[styles.lessonGroupChip, isGroupActive && styles.lessonGroupChipActive]}
                            onPress={() => {
                              setSelectedLessonGroupId(g.id);
                              const match = g.lessons?.find((l) => l.difficulty === selectedQuizDifficulty) || (g.lessons && g.lessons[0]);
                              if (match) {
                                setSelectedLessonId(match.id);
                                setSelectedQuizDifficulty(match.difficulty);
                              } else {
                                setSelectedLessonId(null);
                              }
                            }}
                          >
                            <Ionicons
                              name="book-outline"
                              size={15}
                              color={isGroupActive ? '#FFFFFF' : '#4F46E5'}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.lessonGroupChipText, isGroupActive && styles.lessonGroupChipTextActive]}>
                              {g.title}
                            </Text>
                            <View style={[styles.tierCountBadge, isGroupActive && styles.tierCountBadgeActive]}>
                              <Text style={[styles.tierCountText, isGroupActive && styles.tierCountTextActive]}>
                                {lessonCount} {lessonCount === 1 ? 'tier' : 'tiers'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* 2. Difficulty Tier Selector for the chosen Story */}
                    {activeGroup && (
                      <View style={styles.tierSelectionContainer}>
                        <Text style={styles.subFieldLabel}>
                          Select Difficulty Tier for "{activeGroup.title}":
                        </Text>
                        <View style={styles.tierRow}>
                          {(['easy', 'medium', 'hard'] as const).map((tier) => {
                            const tierLesson = activeGroup.lessons?.find((l) => l.difficulty === tier);
                            const isAvailable = Boolean(tierLesson);
                            const isSelected = isAvailable && (selectedLessonId === tierLesson?.id || selectedQuizDifficulty === tier);
                            const hasQuiz = Boolean(tierLesson?.quiz_id);
                            const slideCount = tierLesson ? (tierLesson.slide_count ?? tierLesson.slides?.length ?? 0) : 0;

                            return (
                              <TouchableOpacity
                                key={tier}
                                style={[
                                  styles.quizTierBtn,
                                  hasQuiz && styles.quizTierBtnHasQuiz,
                                  isSelected && (hasQuiz ? styles.quizTierBtnHasQuizActive : styles.quizTierBtnActive),
                                  !isAvailable && styles.quizTierBtnDisabled,
                                ]}
                                disabled={!isAvailable}
                                onPress={() => {
                                  if (tierLesson) {
                                    setSelectedLessonId(tierLesson.id);
                                    setSelectedQuizDifficulty(tier);
                                  }
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Ionicons
                                    name={
                                      hasQuiz
                                        ? 'checkmark-circle'
                                        : isSelected
                                        ? 'checkmark-circle'
                                        : isAvailable
                                        ? 'radio-button-off'
                                        : 'close-circle-outline'
                                    }
                                    size={15}
                                    color={
                                      isSelected
                                        ? '#FFFFFF'
                                        : hasQuiz
                                        ? '#D97706'
                                        : isAvailable
                                        ? '#475569'
                                        : '#94A3B8'
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.quizTierBtnText,
                                      hasQuiz && styles.quizTierBtnTextHasQuiz,
                                      isSelected && (hasQuiz ? styles.quizTierBtnTextHasQuizActive : styles.quizTierBtnTextActive),
                                      !isAvailable && styles.quizTierBtnTextDisabled,
                                    ]}
                                  >
                                    {tier.toUpperCase()}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.quizTierSubtext,
                                    hasQuiz && styles.quizTierSubtextHasQuiz,
                                    isSelected && (hasQuiz ? styles.quizTierSubtextHasQuizActive : styles.quizTierSubtextActive),
                                    !isAvailable && styles.quizTierSubtextDisabled,
                                  ]}
                                >
                                  {isAvailable
                                    ? `${slideCount} slides${hasQuiz ? ` • Quiz exists (${tierLesson?.quiz_question_count || 0}Q)` : ' • No quiz yet'}`
                                    : 'Not created yet'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {selectedLessonHasQuiz && (
                          <View style={styles.quizExistsAlert}>
                            <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.quizExistsAlertTitle}>
                                Quiz Already Exists for {selectedQuizDifficulty.toUpperCase()} Tier
                              </Text>
                              <Text style={styles.quizExistsAlertText}>
                                A quiz has already been created for this difficulty with {selectedLessonObj?.quiz_question_count || 0} questions. Creating duplicate quizzes for this tier is disabled.
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.fieldLabel}>Quiz Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. The Lost Puppy Comprehension Check"
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                />

                {/* Questions Section */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Questions Pool ({questions.length})
                </Text>

                {questions.map((q, qIdx) => (
                  <View key={qIdx} style={styles.questionBox}>
                    <View style={styles.questionBoxHeader}>
                      <Text style={styles.slideNumber}>Question {qIdx + 1}</Text>
                      {questions.length > 1 && (
                        <TouchableOpacity onPress={() => setQuestions(questions.filter((_, i) => i !== qIdx))}>
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Question Type Toggle */}
                    <View style={styles.typeToggleRow}>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type !== 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...questions];
                          updated[qIdx].question_type = 'descriptive';
                          setQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type !== 'matching' && styles.typeBtnTextActive]}>
                          Multiple Choice
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type === 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...questions];
                          updated[qIdx].question_type = 'matching';
                          if (!updated[qIdx].matching_pairs || updated[qIdx].matching_pairs!.length === 0) {
                            updated[qIdx].matching_pairs = [{ left: '', right: '' }];
                          }
                          setQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type === 'matching' && styles.typeBtnTextActive]}>
                          Matching Pairs
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Type the question statement here..."
                      value={q.question_text}
                      onChangeText={(txt) => {
                        const updated = [...questions];
                        updated[qIdx].question_text = txt;
                        setQuestions(updated);
                      }}
                      multiline
                    />

                    {/* Multiple Choice Options */}
                    {q.question_type !== 'matching' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Choices (Select radio button for the correct answer):</Text>
                        {q.options.map((opt, optIdx) => (
                          <View key={optIdx} style={styles.optionRow}>
                            <TouchableOpacity
                              style={[styles.radio, q.correct_option_index === optIdx && styles.radioActive]}
                              onPress={() => {
                                const updated = [...questions];
                                updated[qIdx].correct_option_index = optIdx;
                                setQuestions(updated);
                              }}
                            >
                              {q.correct_option_index === optIdx && <View style={styles.radioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={opt}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].options[optIdx] = txt;
                                setQuestions(updated);
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Matching Pairs */}
                    {q.question_type === 'matching' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Matching Pairs (Left Item matches Right Item):</Text>
                        {(q.matching_pairs || []).map((pair, pIdx) => (
                          <View key={pIdx} style={styles.matchingRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Left ${pIdx + 1}`}
                              value={pair.left}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].matching_pairs![pIdx].left = txt;
                                setQuestions(updated);
                              }}
                            />
                            <Ionicons name="arrow-forward" size={16} color="#64748B" style={{ marginHorizontal: 6 }} />
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Right ${pIdx + 1}`}
                              value={pair.right}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].matching_pairs![pIdx].right = txt;
                                setQuestions(updated);
                              }}
                            />
                            {(q.matching_pairs || []).length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = [...questions];
                                  updated[qIdx].matching_pairs = updated[qIdx].matching_pairs!.filter((_, i) => i !== pIdx);
                                  setQuestions(updated);
                                }}
                                style={{ marginLeft: 6 }}
                              >
                                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addPairBtn}
                          onPress={() => {
                            const updated = [...questions];
                            updated[qIdx].matching_pairs = [...(updated[qIdx].matching_pairs || []), { left: '', right: '' }];
                            setQuestions(updated);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#4F46E5" />
                          <Text style={styles.addPairBtnText}>Add Matching Pair</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Visual Hint / Explanation */}
                    <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>Visual Hint / Scaffolding Note (Optional):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Look at the dog's collar in slide 2"
                      value={q.hint || ''}
                      onChangeText={(txt) => {
                        const updated = [...questions];
                        updated[qIdx].hint = txt;
                        setQuestions(updated);
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addSlideBtn, selectedLessonHasQuiz && { opacity: 0.4 }]}
                  disabled={selectedLessonHasQuiz}
                  onPress={() =>
                    setQuestions([
                      ...questions,
                      {
                        question_text: '',
                        question_type: 'descriptive',
                        image_url: '',
                        options: ['', '', '', ''],
                        correct_option_index: 0,
                        matching_pairs: [{ left: '', right: '' }],
                        hint: '',
                      },
                    ])
                  }
                >
                  <Ionicons name="add-circle-outline" size={18} color={selectedLessonHasQuiz ? '#94A3B8' : '#4F46E5'} />
                  <Text style={[styles.addSlideBtnText, selectedLessonHasQuiz && { color: '#94A3B8' }]}>
                    Add Question to Pool
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (submittingQuiz || selectedLessonHasQuiz) && styles.primaryBtnDisabled,
                    selectedLessonHasQuiz && styles.primaryBtnQuizExists,
                  ]}
                  onPress={handleSubmitQuiz}
                  disabled={submittingQuiz || selectedLessonHasQuiz}
                >
                  {submittingQuiz ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : selectedLessonHasQuiz ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="lock-closed-outline" size={16} color="#64748B" />
                      <Text style={styles.primaryBtnQuizExistsText}>Quiz Already Created for this Tier</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>Create Quiz</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.viewCurriculumLinkBtn}
                onPress={() => setActiveTab('current')}
              >
                <Ionicons name="layers-outline" size={16} color="#4F46E5" />
                <Text style={styles.viewCurriculumLinkText}>View All Current Lessons & Attached Quizzes</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: CLASS ANALYTICS */}
          {activeTab === 'analytics' && (
            <View>
              {loadingAnalytics ? (
                <View style={styles.analyticsLoadingBox}>
                  <ActivityIndicator color="#4F46E5" size="large" />
                  <Text style={styles.analyticsLoadingText}>Loading class analytics & student records...</Text>
                </View>
              ) : !analyticsData ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No analytics data available yet.</Text>
                </View>
              ) : selectedStudentForInspect === null ? (
                /* ─── OPTION A: MAIN CLASS ANALYTICS (CLEAN & UNCLUTTERED) ─── */
                <>
                  {/* 1. Executive Summary Metric Cards (4 cards) */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricCard}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="people-outline" size={20} color="#4F46E5" />
                      </View>
                      <Text style={styles.metricValue}>{analyticsData.total_students || 0}</Text>
                      <Text style={styles.metricLabel}>Enrolled Students</Text>
                    </View>

                    <View style={styles.metricCard}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-done-circle-outline" size={20} color="#059669" />
                      </View>
                      <Text style={[styles.metricValue, { color: '#059669' }]}>{analyticsData.total_attempts || 0}</Text>
                      <Text style={styles.metricLabel}>Quizzes Completed</Text>
                    </View>

                    <View style={styles.metricCard}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="trending-up-outline" size={20} color="#2563EB" />
                      </View>
                      <Text style={[styles.metricValue, { color: '#2563EB' }]}>
                        {Math.round(analyticsData.class_avg_accuracy ?? analyticsData.avg_accuracy ?? 0)}%
                      </Text>
                      <Text style={styles.metricLabel}>Class Accuracy</Text>
                    </View>

                    <View style={styles.metricCard}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#FAF5FF' }]}>
                        <Ionicons name="book-outline" size={20} color="#7C3AED" />
                      </View>
                      <Text style={[styles.metricValue, { color: '#7C3AED' }]}>
                        {analyticsData.topic_stats
                          ? (Array.isArray(analyticsData.topic_stats)
                              ? analyticsData.topic_stats.length
                              : Object.keys(analyticsData.topic_stats).length)
                          : 4}
                      </Text>
                      <Text style={styles.metricLabel}>Active Subjects</Text>
                    </View>
                  </View>

                  {/* 2. Curriculum Coverage Strip */}
                  <View style={styles.card}>
                    <View style={styles.analyticsSectionHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="library-outline" size={18} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Curriculum Distribution</Text>
                      </View>
                      <Text style={styles.analyticsSectionHint}>Content scope & quiz availability across topics</Text>
                    </View>

                    <View style={styles.curriculumGrid}>
                      {[
                        { id: 'story-grammar', label: 'Story Grammar', icon: 'book-outline', color: '#4F46E5', bg: '#EEF2FF' },
                        { id: 'mathematics', label: 'Mathematics', icon: 'calculator-outline', color: '#059669', bg: '#ECFDF5' },
                        { id: 'technology-and-livelihood-education', label: 'TLE (ICT)', icon: 'hardware-chip-outline', color: '#D97706', bg: '#FFFBEB' },
                        { id: 'araling-panlipunan', label: 'Araling Panlipunan', icon: 'globe-outline', color: '#7C3AED', bg: '#FAF5FF' },
                      ].map((sub) => {
                        const topicStatsObj = analyticsData.topic_stats;
                        const stat = topicStatsObj
                          ? (Array.isArray(topicStatsObj)
                              ? topicStatsObj.find((t: any) => t.topic_id === sub.id)
                              : topicStatsObj[sub.id])
                          : null;
                        return (
                          <View key={sub.id} style={styles.curriculumSubjectCard}>
                            <View style={[styles.curriculumIconCircle, { backgroundColor: sub.bg }]}>
                              <Ionicons name={sub.icon as any} size={18} color={sub.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.curriculumSubjectName}>{sub.label}</Text>
                              <Text style={styles.curriculumSubjectStats}>
                                {stat
                                  ? (stat.total_lessons !== undefined
                                      ? `${stat.total_lessons} Lessons • ${stat.total_quizzes} Quizzes`
                                      : `${stat.attempts || 0} attempts • ${Math.round(stat.avg_accuracy || 0)}% avg`)
                                  : 'Curriculum Ready'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. Student Performance Directory (Uncluttered Roster) */}
                  <View style={styles.card}>
                    <View style={styles.analyticsSectionHeader}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="school-outline" size={18} color="#4F46E5" />
                          <Text style={styles.cardTitle}>Student Performance Directory</Text>
                        </View>
                        <Text style={styles.analyticsSectionHint}>
                          Click any student card to inspect detailed quiz attempts, cognitive BKT mastery, and badges
                        </Text>
                      </View>
                    </View>

                    {/* Search & Sort Bar */}
                    <View style={styles.directoryControlsRow}>
                      <View style={styles.directorySearchInputWrap}>
                        <Ionicons name="search-outline" size={16} color="#94A3B8" />
                        <TextInput
                          style={styles.directorySearchInput}
                          placeholder="Search student by name or username..."
                          placeholderTextColor="#94A3B8"
                          value={searchStudentQuery}
                          onChangeText={setSearchStudentQuery}
                        />
                        {searchStudentQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchStudentQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Sort Pills */}
                      <View style={styles.sortPillsRow}>
                        <TouchableOpacity
                          style={[styles.sortPill, studentSortBy === 'stars' && styles.sortPillActive]}
                          onPress={() => setStudentSortBy('stars')}
                        >
                          <Ionicons
                            name="star"
                            size={12}
                            color={studentSortBy === 'stars' ? '#4F46E5' : '#64748B'}
                          />
                          <Text
                            style={[styles.sortPillText, studentSortBy === 'stars' && styles.sortPillTextActive]}
                          >
                            Top Stars
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.sortPill, studentSortBy === 'attempts' && styles.sortPillActive]}
                          onPress={() => setStudentSortBy('attempts')}
                        >
                          <Ionicons
                            name="flame"
                            size={12}
                            color={studentSortBy === 'attempts' ? '#4F46E5' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.sortPillText,
                              studentSortBy === 'attempts' && styles.sortPillTextActive,
                            ]}
                          >
                            Most Active
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.sortPill, studentSortBy === 'needs_support' && styles.sortPillActive]}
                          onPress={() => setStudentSortBy('needs_support')}
                        >
                          <Ionicons
                            name="alert-circle-outline"
                            size={12}
                            color={studentSortBy === 'needs_support' ? '#4F46E5' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.sortPillText,
                              studentSortBy === 'needs_support' && styles.sortPillTextActive,
                            ]}
                          >
                            Needs Support
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Student List */}
                    {(() => {
                      const roster = (analyticsData.student_roster || []).filter((s: any) => {
                        const q = searchStudentQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          (s.name || '').toLowerCase().includes(q) ||
                          (s.username || '').toLowerCase().includes(q)
                        );
                      }).sort((a: any, b: any) => {
                        if (studentSortBy === 'needs_support') {
                          return (a.avg_accuracy || 0) - (b.avg_accuracy || 0);
                        }
                        if (studentSortBy === 'attempts') {
                          return (b.attempts_count || 0) - (a.attempts_count || 0);
                        }
                        return (b.total_stars || 0) - (a.total_stars || 0);
                      });

                      if (roster.length === 0) {
                        return (
                          <View style={styles.directoryEmptyBox}>
                            <Ionicons name="search-outline" size={28} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No students match the search filter.</Text>
                          </View>
                        );
                      }

                      return roster.map((student: any) => {
                        const accuracy = Math.round(student.avg_accuracy || 0);
                        const isHighAcc = accuracy >= 70;
                        const isMidAcc = accuracy >= 50 && accuracy < 70;
                        const accColor = isHighAcc ? '#059669' : isMidAcc ? '#D97706' : '#DC2626';
                        const accBg = isHighAcc ? '#ECFDF5' : isMidAcc ? '#FFFBEB' : '#FEF2F2';

                        return (
                          <TouchableOpacity
                            key={student.user_id || student.id}
                            style={styles.studentDirectoryCard}
                            onPress={() => handleInspectStudent(student)}
                            activeOpacity={0.7}
                          >
                            {/* Student Avatar */}
                            <View style={styles.studentAvatarCircle}>
                              <Text style={styles.studentAvatarText}>
                                {(student.name || 'Student').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>

                            {/* Main Info */}
                            <View style={{ flex: 1, marginRight: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.studentName}>{student.name || 'Student'}</Text>
                                <Text style={styles.studentUsername}>@{student.username}</Text>
                              </View>

                              {/* Badges / Metrics Row */}
                              <View style={styles.studentMetricsPillsRow}>
                                <View style={styles.studentPillItem}>
                                  <Ionicons name="star" size={12} color="#D97706" />
                                  <Text style={styles.studentPillText}>{student.total_stars || 0} Stars</Text>
                                </View>

                                <View style={styles.studentPillItem}>
                                  <Ionicons name="document-text-outline" size={12} color="#4F46E5" />
                                  <Text style={styles.studentPillText}>{student.attempts_count || 0} Quizzes</Text>
                                </View>

                                <View style={[styles.studentPillItem, { backgroundColor: accBg }]}>
                                  <Ionicons name="analytics-outline" size={12} color={accColor} />
                                  <Text style={[styles.studentPillText, { color: accColor, fontWeight: '700' }]}>
                                    {accuracy}% Acc
                                  </Text>
                                </View>

                                {Boolean(student.current_streak && student.current_streak > 0) && (
                                  <View style={[styles.studentPillItem, { backgroundColor: '#FFF7ED' }]}>
                                    <Ionicons name="flame" size={12} color="#EA580C" />
                                    <Text style={[styles.studentPillText, { color: '#EA580C' }]}>
                                      {student.current_streak}d streak
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Action Button Indicator */}
                            <View style={styles.inspectStudentBtn}>
                              <Text style={styles.inspectStudentBtnText}>Inspect</Text>
                              <Ionicons name="chevron-forward" size={15} color="#4F46E5" />
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>
                </>
              ) : (
                /* ─── OPTION A: STUDENT DOSSIER SUB-VIEW (ON-DEMAND DEEP DIVE) ─── */
                <View style={styles.dossierContainer}>
                  {/* Top Breadcrumb Navigation */}
                  <View style={styles.dossierBreadcrumbBar}>
                    <TouchableOpacity
                      style={styles.dossierBackBtn}
                      onPress={() => setSelectedStudentForInspect(null)}
                    >
                      <Ionicons name="arrow-back-outline" size={18} color="#4F46E5" />
                      <Text style={styles.dossierBackBtnText}>Back to Class Analytics</Text>
                    </TouchableOpacity>

                    <View style={styles.dossierHeaderBadge}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                      <Text style={styles.dossierHeaderBadgeText}>Student Dossier</Text>
                    </View>
                  </View>

                  {/* Student Header Profile Card */}
                  <View style={styles.dossierProfileCard}>
                    <View style={styles.dossierProfileTop}>
                      <View style={styles.dossierAvatar}>
                        <Text style={styles.dossierAvatarText}>
                          {(selectedStudentForInspect.name || 'S').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dossierStudentName}>
                          {selectedStudentForInspect.name || 'Student'}
                        </Text>
                        <Text style={styles.dossierStudentUser}>
                          @{selectedStudentForInspect.username} • Enrolled Student
                        </Text>
                      </View>
                    </View>

                    {/* Quick Metric Stat Row */}
                    <View style={styles.dossierQuickStatsRow}>
                      <View style={styles.dossierQuickStatCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="star" size={15} color="#D97706" />
                          <Text style={styles.dossierQuickStatValue}>
                            {selectedStudentForInspect.total_stars || 0}
                          </Text>
                        </View>
                        <Text style={styles.dossierQuickStatLabel}>Total Stars</Text>
                      </View>

                      <View style={styles.dossierQuickStatCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="document-text-outline" size={15} color="#4F46E5" />
                          <Text style={styles.dossierQuickStatValue}>
                            {selectedStudentForInspect.attempts_count || studentQuizAttempts.length}
                          </Text>
                        </View>
                        <Text style={styles.dossierQuickStatLabel}>Quizzes Completed</Text>
                      </View>

                      <View style={styles.dossierQuickStatCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="analytics-outline" size={15} color="#2563EB" />
                          <Text style={styles.dossierQuickStatValue}>
                            {Math.round(selectedStudentForInspect.avg_accuracy || 0)}%
                          </Text>
                        </View>
                        <Text style={styles.dossierQuickStatLabel}>Mean Accuracy</Text>
                      </View>

                      <View style={styles.dossierQuickStatCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="flame" size={15} color="#EA580C" />
                          <Text style={styles.dossierQuickStatValue}>
                            {selectedStudentForInspect.current_streak || 0}d
                          </Text>
                        </View>
                        <Text style={styles.dossierQuickStatLabel}>Current Streak</Text>
                      </View>
                    </View>
                  </View>

                  {/* Dossier Segmented Tabs */}
                  <View style={styles.dossierSegmentedBar}>
                    <TouchableOpacity
                      style={[
                        styles.dossierSegmentTab,
                        studentDossierTab === 'attempts' && styles.dossierSegmentTabActive,
                      ]}
                      onPress={() => setStudentDossierTab('attempts')}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={studentDossierTab === 'attempts' ? '#4F46E5' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.dossierSegmentTabText,
                          studentDossierTab === 'attempts' && styles.dossierSegmentTabTextActive,
                        ]}
                      >
                        Quiz Attempts ({studentQuizAttempts.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.dossierSegmentTab,
                        studentDossierTab === 'mastery' && styles.dossierSegmentTabActive,
                      ]}
                      onPress={() => setStudentDossierTab('mastery')}
                    >
                      <Ionicons
                        name="hardware-chip-outline"
                        size={16}
                        color={studentDossierTab === 'mastery' ? '#4F46E5' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.dossierSegmentTabText,
                          studentDossierTab === 'mastery' && styles.dossierSegmentTabTextActive,
                        ]}
                      >
                        pyBKT Mastery ({studentKcMastery.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.dossierSegmentTab,
                        studentDossierTab === 'badges' && styles.dossierSegmentTabActive,
                      ]}
                      onPress={() => setStudentDossierTab('badges')}
                    >
                      <Ionicons
                        name="trophy-outline"
                        size={16}
                        color={studentDossierTab === 'badges' ? '#4F46E5' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.dossierSegmentTabText,
                          studentDossierTab === 'badges' && styles.dossierSegmentTabTextActive,
                        ]}
                      >
                        Badges ({studentBadges.filter((b: any) => b.unlocked).length}/{studentBadges.length || 6})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dossier Tab Content */}
                  {loadingStudentDetails ? (
                    <View style={styles.analyticsLoadingBox}>
                      <ActivityIndicator color="#4F46E5" size="large" />
                      <Text style={styles.analyticsLoadingText}>Loading student dossier details...</Text>
                    </View>
                  ) : studentDossierTab === 'attempts' ? (
                    /* ── TAB 1: QUIZ ATTEMPTS HISTORY ── */
                    <View style={styles.dossierTabContent}>
                      {/* Sub-filter chips */}
                      <View style={styles.attemptsFilterRow}>
                        <TouchableOpacity
                          style={[
                            styles.filterChip,
                            studentAttemptFilter === 'all' && styles.filterChipActive,
                          ]}
                          onPress={() => setStudentAttemptFilter('all')}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              studentAttemptFilter === 'all' && styles.filterChipTextActive,
                            ]}
                          >
                            All ({studentQuizAttempts.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.filterChip,
                            studentAttemptFilter === 'passed' && styles.filterChipActive,
                          ]}
                          onPress={() => setStudentAttemptFilter('passed')}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={studentAttemptFilter === 'passed' ? '#059669' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.filterChipText,
                              studentAttemptFilter === 'passed' && styles.filterChipTextActive,
                            ]}
                          >
                            Passed ({studentQuizAttempts.filter((a: any) => a.passed).length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.filterChip,
                            studentAttemptFilter === 'review' && styles.filterChipActive,
                          ]}
                          onPress={() => setStudentAttemptFilter('review')}
                        >
                          <Ionicons
                            name="alert-circle"
                            size={13}
                            color={studentAttemptFilter === 'review' ? '#DC2626' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.filterChipText,
                              studentAttemptFilter === 'review' && styles.filterChipTextActive,
                            ]}
                          >
                            Needs Review ({studentQuizAttempts.filter((a: any) => !a.passed).length})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Attempts List */}
                      {(() => {
                        const filtered = studentQuizAttempts.filter((a: any) => {
                          if (studentAttemptFilter === 'passed') return a.passed;
                          if (studentAttemptFilter === 'review') return !a.passed;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <View style={styles.directoryEmptyBox}>
                              <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
                              <Text style={styles.emptyText}>No quiz attempts found under this filter.</Text>
                            </View>
                          );
                        }

                        return filtered.map((attempt: any) => {
                          const diff = (attempt.difficulty || 'easy').toLowerCase();
                          const diffColor =
                            diff === 'hard' ? '#7C3AED' : diff === 'medium' ? '#2563EB' : '#059669';
                          const diffBg =
                            diff === 'hard' ? '#F5F3FF' : diff === 'medium' ? '#EFF6FF' : '#ECFDF5';

                          return (
                            <View key={attempt.attempt_id} style={styles.attemptCard}>
                              <View style={styles.attemptCardTop}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={styles.attemptQuizTitle}>{attempt.quiz_title || 'Untitled Quiz'}</Text>
                                  <Text style={styles.attemptTopicText}>
                                    Topic: {attempt.topic_id || 'General'}
                                  </Text>
                                </View>

                                <View style={[styles.diffBadge, { backgroundColor: diffBg, borderColor: diffColor }]}>
                                  <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                                    {diff.toUpperCase()}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.attemptCardBottom}>
                                <View style={styles.attemptScoreGroup}>
                                  <Text style={styles.attemptScoreText}>
                                    Score: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{attempt.score}/{attempt.total_questions}</Text>
                                  </Text>
                                  <Text style={styles.attemptAccPercent}>
                                    ({Math.round(attempt.accuracy_pct || 0)}%)
                                  </Text>
                                </View>

                                <View
                                  style={[
                                    styles.attemptStatusPill,
                                    attempt.passed ? styles.attemptStatusPassed : styles.attemptStatusFailed,
                                  ]}
                                >
                                  <Ionicons
                                    name={attempt.passed ? 'checkmark-circle' : 'alert-circle'}
                                    size={14}
                                    color={attempt.passed ? '#059669' : '#DC2626'}
                                  />
                                  <Text
                                    style={[
                                      styles.attemptStatusText,
                                      { color: attempt.passed ? '#059669' : '#DC2626' },
                                    ]}
                                  >
                                    {attempt.passed ? 'PASSED (>=70%)' : 'NEEDS PRACTICE'}
                                  </Text>
                                </View>
                              </View>

                              {Boolean(attempt.completed_at || attempt.time_spent_seconds) && (
                                <View style={styles.attemptMetaRow}>
                                  {Boolean(attempt.time_spent_seconds) && (
                                    <View style={styles.attemptMetaItem}>
                                      <Ionicons name="time-outline" size={12} color="#94A3B8" />
                                      <Text style={styles.attemptMetaText}>{attempt.time_spent_seconds}s</Text>
                                    </View>
                                  )}
                                  {Boolean(attempt.completed_at) && (
                                    <View style={styles.attemptMetaItem}>
                                      <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                                      <Text style={styles.attemptMetaText}>
                                        {new Date(attempt.completed_at).toLocaleDateString()} {new Date(attempt.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        });
                      })()}
                    </View>
                  ) : studentDossierTab === 'mastery' ? (
                    /* ── TAB 2: pyBKT COGNITIVE MASTERY BREAKDOWN ── */
                    <View style={styles.dossierTabContent}>
                      {/* Explanatory Banner */}
                      <View style={styles.bktBanner}>
                        <View style={styles.bktBannerIcon}>
                          <Ionicons name="hardware-chip-outline" size={20} color="#4F46E5" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bktBannerTitle}>
                            Bayesian Knowledge Tracing (pyBKT) Model
                          </Text>
                          <Text style={styles.bktBannerDesc}>
                            Estimates the student's latent mastery probability P(L) based on sequential quiz interactions, accounting for slip and guess probabilities.
                          </Text>
                        </View>
                      </View>

                      {/* Mastery Summary Stat Tally */}
                      {(() => {
                        const mastered = studentKcMastery.filter((k: any) => (k.p_mastery ?? 0) >= 0.70).length;
                        const developing = studentKcMastery.filter((k: any) => (k.p_mastery ?? 0) >= 0.30 && (k.p_mastery ?? 0) < 0.70).length;
                        const struggling = studentKcMastery.filter((k: any) => (k.p_mastery ?? 0) < 0.30 && (k.total_opportunities || 0) > 0).length;

                        return (
                          <View style={styles.bktSummaryRow}>
                            <View style={[styles.bktSummaryCard, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }]}>
                              <Text style={[styles.bktSummaryValue, { color: '#059669' }]}>{mastered}</Text>
                              <Text style={styles.bktSummaryLabel}>Mastered (&gt;=70%)</Text>
                            </View>
                            <View style={[styles.bktSummaryCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                              <Text style={[styles.bktSummaryValue, { color: '#D97706' }]}>{developing}</Text>
                              <Text style={styles.bktSummaryLabel}>Developing (30-69%)</Text>
                            </View>
                            <View style={[styles.bktSummaryCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                              <Text style={[styles.bktSummaryValue, { color: '#DC2626' }]}>{struggling}</Text>
                              <Text style={styles.bktSummaryLabel}>Struggling (&lt;30%)</Text>
                            </View>
                          </View>
                        );
                      })()}

                      {/* KC Mastery List */}
                      {studentKcMastery.length === 0 ? (
                        <View style={styles.directoryEmptyBox}>
                          <Ionicons name="hardware-chip-outline" size={32} color="#CBD5E1" />
                          <Text style={styles.emptyText}>No knowledge components tracked yet.</Text>
                        </View>
                      ) : (
                        studentKcMastery.map((kc: any) => {
                          const pMastery = kc.p_mastery ?? 0;
                          const pct = Math.round(kc.p_mastery_pct ?? (pMastery * 100));
                          const isMastered = pMastery >= 0.70;
                          const isDeveloping = pMastery >= 0.30 && pMastery < 0.70;
                          const statusColor = isMastered ? '#059669' : isDeveloping ? '#D97706' : '#DC2626';
                          const statusBg = isMastered ? '#ECFDF5' : isDeveloping ? '#FFFBEB' : '#FEF2F2';
                          const statusLabel = isMastered ? 'Mastered' : isDeveloping ? 'Developing' : 'Struggling';

                          return (
                            <View key={kc.kc_name} style={styles.kcCard}>
                              <View style={styles.kcCardHeader}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={styles.kcTitle}>{kc.display_name || kc.kc_name}</Text>
                                  <Text style={styles.kcTopic}>{kc.topic_id || 'General'}</Text>
                                </View>

                                <View style={[styles.kcStatusPill, { backgroundColor: statusBg }]}>
                                  <Text style={[styles.kcStatusPillText, { color: statusColor }]}>
                                    {statusLabel}
                                  </Text>
                                </View>
                              </View>

                              {/* Mastery Progress Bar */}
                              <View style={styles.kcProgressBarTrack}>
                                <View
                                  style={[
                                    styles.kcProgressBarFill,
                                    { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: statusColor },
                                  ]}
                                />
                              </View>

                              {/* Metrics Details */}
                              <View style={styles.kcFooterRow}>
                                <Text style={styles.kcMasteryPercent}>
                                  P(Mastery): <Text style={{ color: statusColor, fontWeight: '700' }}>{pct}%</Text>
                                </Text>
                                <Text style={styles.kcCountsText}>
                                  {kc.correct_count || 0} Correct • {kc.wrong_count || 0} Wrong • {kc.total_opportunities || 0} Opportunities
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : (
                    /* ── TAB 3: MILESTONE ACHIEVEMENTS & BADGES ── */
                    <View style={styles.dossierTabContent}>
                      <View style={styles.badgesSummaryBanner}>
                        <Ionicons name="trophy" size={20} color="#D97706" />
                        <Text style={styles.badgesSummaryBannerText}>
                          {studentBadges.filter((b: any) => b.unlocked).length} of {studentBadges.length} Milestone Badges Unlocked
                        </Text>
                      </View>

                      <View style={styles.badgesGrid}>
                        {studentBadges.map((badge: any) => (
                          <View
                            key={badge.id}
                            style={[
                              styles.badgeCard,
                              !badge.unlocked && styles.badgeCardLocked,
                            ]}
                          >
                            <View
                              style={[
                                styles.badgeIconCircle,
                                { backgroundColor: badge.unlocked ? (badge.color ? `${badge.color}20` : '#EEF2FF') : '#F1F5F9' },
                              ]}
                            >
                              <Ionicons
                                name={(badge.icon as any) || 'trophy-outline'}
                                size={22}
                                color={badge.unlocked ? (badge.color || '#4F46E5') : '#94A3B8'}
                              />
                            </View>

                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                <Text
                                  style={[
                                    styles.badgeTitle,
                                    !badge.unlocked && styles.badgeTitleLocked,
                                  ]}
                                >
                                  {badge.title}
                                </Text>

                                <View
                                  style={[
                                    styles.badgeStatusPill,
                                    badge.unlocked ? styles.badgeStatusPillUnlocked : styles.badgeStatusPillLocked,
                                  ]}
                                >
                                  <Ionicons
                                    name={badge.unlocked ? 'checkmark-circle' : 'lock-closed-outline'}
                                    size={11}
                                    color={badge.unlocked ? '#059669' : '#64748B'}
                                  />
                                  <Text
                                    style={[
                                      styles.badgeStatusText,
                                      badge.unlocked ? styles.badgeStatusTextUnlocked : styles.badgeStatusTextLocked,
                                    ]}
                                  >
                                    {badge.unlocked ? 'Earned' : 'Locked'}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.badgeDescription}>{badge.description}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 1. SLIDE EDITOR MODAL */}
      <Modal
        visible={editingLesson !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingLesson(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, showModalStudentPreview && isDesktop && styles.modalContainerWide]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Lesson Slides</Text>
                <Text style={styles.modalSubtitle}>
                  {editingLesson?.groupTitle} ({editingLesson?.difficulty?.toUpperCase()})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.previewToggleBtn, showModalStudentPreview && styles.previewToggleBtnActive]}
                  onPress={() => setShowModalStudentPreview(!showModalStudentPreview)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showModalStudentPreview ? "phone-portrait" : "phone-portrait-outline"}
                    size={14}
                    color={showModalStudentPreview ? "#4F46E5" : "#64748B"}
                  />
                  <Text style={[styles.previewToggleBtnText, showModalStudentPreview && styles.previewToggleBtnTextActive]}>
                    {showModalStudentPreview ? "Hide Preview" : "Android Preview"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setEditingLesson(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.editorLayoutRow, (!isDesktop || !showModalStudentPreview) && styles.editorLayoutRowMobile]}>
                <View style={[styles.editorLayoutColumn, (!showModalStudentPreview || !isDesktop) && { minWidth: '100%' }]}>
                  {/* Visual Storyboard Filmstrip & Slide Deck Builder */}
                  <View style={styles.storyboardFilmstripWrapper}>
                    <View style={styles.filmstripHeaderRow}>
                      <Text style={styles.filmstripHeaderLabel}>
                        Lesson Storyboard Deck ({editSlides.length} {editSlides.length === 1 ? 'Slide' : 'Slides'})
                      </Text>
                      <Text style={styles.filmstripHeaderHint}>
                        Tap a slide card to edit
                      </Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmstripScroll}>
                      {editSlides.map((slide, sIdx) => {
                        const isSelected = (activeEditSlideIndex === sIdx);
                        return (
                          <TouchableOpacity
                            key={sIdx}
                            style={[styles.filmstripCard, isSelected && styles.filmstripCardActive]}
                            onPress={() => setActiveEditSlideIndex(sIdx)}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.filmstripBadge, isSelected && styles.filmstripBadgeActive]}>
                              <Text style={[styles.filmstripBadgeText, isSelected && styles.filmstripBadgeTextActive]}>
                                Slide {sIdx + 1}
                              </Text>
                            </View>

                            {slide.image_url ? (
                              <Image source={{ uri: resolveImageUrl(slide.image_url) }} style={styles.filmstripThumb} resizeMode="cover" />
                            ) : (
                              <View style={styles.filmstripPlaceholderThumb}>
                                <Ionicons name="image-outline" size={18} color={isSelected ? '#4F46E5' : '#94A3B8'} />
                              </View>
                            )}

                            <Text style={[styles.filmstripExcerpt, isSelected && styles.filmstripExcerptActive]} numberOfLines={2}>
                              {slide.description_text.trim() || '(No reading text)'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      <TouchableOpacity
                        style={styles.filmstripAddCard}
                        onPress={() => {
                          const nextLen = editSlides.length;
                          setEditSlides([...editSlides, { description_text: '', image_url: '' }]);
                          setActiveEditSlideIndex(nextLen);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filmstripAddIconBox}>
                          <Ionicons name="add" size={20} color="#4F46E5" />
                        </View>
                        <Text style={styles.filmstripAddText}>+ Add Slide</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  {/* Active Edit Slide Canvas */}
                  {editSlides[Math.min(activeEditSlideIndex, editSlides.length - 1)] && (() => {
                    const currentIdx = Math.min(activeEditSlideIndex, editSlides.length - 1);
                    const currentSlide = editSlides[currentIdx];
                    return (
                      <View style={styles.activeSlideCanvas}>
                        <View style={styles.activeSlideToolbar}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.activeSlideNumberPill}>
                              <Text style={styles.activeSlideNumberPillText}>
                                Slide {currentIdx + 1} of {editSlides.length}
                              </Text>
                            </View>
                            <Text style={styles.activeSlideHelpText}>Active Slide Editor</Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={[styles.slideNavBtn, currentIdx === 0 && styles.slideNavBtnDisabled]}
                              onPress={() => setActiveEditSlideIndex(Math.max(0, currentIdx - 1))}
                              disabled={currentIdx === 0}
                            >
                              <Ionicons name="chevron-back" size={16} color={currentIdx === 0 ? '#94A3B8' : '#4F46E5'} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.slideNavBtn, currentIdx === editSlides.length - 1 && styles.slideNavBtnDisabled]}
                              onPress={() => setActiveEditSlideIndex(Math.min(editSlides.length - 1, currentIdx + 1))}
                              disabled={currentIdx === editSlides.length - 1}
                            >
                              <Ionicons name="chevron-forward" size={16} color={currentIdx === editSlides.length - 1 ? '#94A3B8' : '#4F46E5'} />
                            </TouchableOpacity>

                            {editSlides.length > 1 && (
                              <TouchableOpacity
                                style={styles.slideDeleteBtn}
                                onPress={() => {
                                  const updated = editSlides.filter((_, i) => i !== currentIdx);
                                  setEditSlides(updated);
                                  setActiveEditSlideIndex(Math.max(0, currentIdx - 1));
                                }}
                              >
                                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <Text style={styles.canvasFieldLabel}>Slide Reading & Narration Text</Text>
                        <TextInput
                          style={[styles.input, styles.canvasTextArea]}
                          placeholder="Enter slide story or reading passage for Deaf students..."
                          value={currentSlide.description_text}
                          onChangeText={(txt) => {
                            const updated = [...editSlides];
                            updated[currentIdx].description_text = txt;
                            setEditSlides(updated);
                          }}
                          multiline
                        />

                        <Text style={[styles.canvasFieldLabel, { marginTop: 8 }]}>ASL Sign / Visual Story Illustration</Text>
                        {currentSlide.image_url ? (
                          <View style={styles.canvasImagePreviewContainer}>
                            <Image
                              source={{ uri: resolveImageUrl(currentSlide.image_url) }}
                              style={styles.canvasSlidePreviewImg}
                              resizeMode="cover"
                            />
                            <View style={styles.canvasImageActionsRow}>
                              <TouchableOpacity
                                style={styles.canvasChangeImgBtn}
                                onPress={() =>
                                  pickAndUploadImage((url) => {
                                    const updated = [...editSlides];
                                    updated[currentIdx].image_url = url;
                                    setEditSlides(updated);
                                  })
                                }
                              >
                                <Ionicons name="swap-horizontal" size={15} color="#4F46E5" />
                                <Text style={styles.canvasChangeImgText}>Replace Image</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.canvasRemoveImgBtn}
                                onPress={() => {
                                  const updated = [...editSlides];
                                  updated[currentIdx].image_url = '';
                                  setEditSlides(updated);
                                }}
                              >
                                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                <Text style={styles.canvasRemoveImgText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.canvasUploadDropzone}
                            onPress={() =>
                              pickAndUploadImage((url) => {
                                const updated = [...editSlides];
                                updated[currentIdx].image_url = url;
                                setEditSlides(updated);
                              })
                            }
                          >
                            <View style={styles.canvasUploadIconCircle}>
                              <Ionicons name="cloud-upload-outline" size={24} color="#4F46E5" />
                            </View>
                            <Text style={styles.canvasUploadTitle}>Upload ASL Illustration or Gesture Sign</Text>
                            <Text style={styles.canvasUploadSubtitle}>PNG, JPG, or GIF image for students</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* Right Column: Live Student Phone Mockup */}
                {showModalStudentPreview && (
                  <View style={[styles.phoneSimulatorColumn, !isDesktop && styles.phoneSimulatorColumnMobile]}>
                    <View style={styles.phoneSimulatorCard}>
                      <View style={styles.previewPanelHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.phoneSimulatorLiveDot} />
                          <Text style={styles.previewPanelTitle}>Live Student Preview</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.previewPanelCloseBtn}
                          onPress={() => setShowModalStudentPreview(false)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.previewPanelSubtitle}>
                        Real-time Android view for {editingLesson?.groupTitle} ({editingLesson?.difficulty?.toUpperCase()})
                      </Text>
                      {renderStudentPhoneMockup(
                        editSlides,
                        activeEditSlideIndex,
                        editingLesson?.groupTitle || '',
                        editingLesson?.difficulty || 'easy',
                        setActiveEditSlideIndex
                      )}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingLesson(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingEditSlides && styles.primaryBtnDisabled]}
                onPress={handleSaveEditSlides}
                disabled={savingEditSlides}
              >
                {savingEditSlides ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Slide Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. QUIZ EDITOR MODAL */}
      <Modal
        visible={editingQuiz !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingQuiz(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Quiz Questions</Text>
                <Text style={styles.modalSubtitle}>{editingQuiz?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingQuiz(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingQuizQuestions ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading questions...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {editQuizQuestions.map((q, qIdx) => (
                  <View key={qIdx} style={styles.questionBox}>
                    <View style={styles.questionBoxHeader}>
                      <Text style={styles.slideNumber}>Question {qIdx + 1}</Text>
                      {editQuizQuestions.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setEditQuizQuestions(editQuizQuestions.filter((_, i) => i !== qIdx))}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Question Type Toggle */}
                    <View style={styles.typeToggleRow}>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type !== 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...editQuizQuestions];
                          updated[qIdx].question_type = 'descriptive';
                          setEditQuizQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type !== 'matching' && styles.typeBtnTextActive]}>
                          Multiple Choice
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type === 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...editQuizQuestions];
                          updated[qIdx].question_type = 'matching';
                          if (!updated[qIdx].matching_pairs || updated[qIdx].matching_pairs!.length === 0) {
                            updated[qIdx].matching_pairs = [{ left: '', right: '' }];
                          }
                          setEditQuizQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type === 'matching' && styles.typeBtnTextActive]}>
                          Matching Pairs
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Type question statement here..."
                      value={q.question_text}
                      onChangeText={(txt) => {
                        const updated = [...editQuizQuestions];
                        updated[qIdx].question_text = txt;
                        setEditQuizQuestions(updated);
                      }}
                      multiline
                    />

                    {/* Options or Matching */}
                    {q.question_type !== 'matching' ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Choices (Select radio button for the correct answer):</Text>
                        {(q.options || ['', '', '', '']).map((opt, optIdx) => (
                          <View key={optIdx} style={styles.optionRow}>
                            <TouchableOpacity
                              style={[styles.radio, q.correct_option_index === optIdx && styles.radioActive]}
                              onPress={() => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].correct_option_index = optIdx;
                                setEditQuizQuestions(updated);
                              }}
                            >
                              {q.correct_option_index === optIdx && <View style={styles.radioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={opt}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                if (!updated[qIdx].options) updated[qIdx].options = ['', '', '', ''];
                                updated[qIdx].options[optIdx] = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Matching Pairs:</Text>
                        {(q.matching_pairs || []).map((pair, pIdx) => (
                          <View key={pIdx} style={styles.matchingRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Left ${pIdx + 1}`}
                              value={pair.left}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].matching_pairs![pIdx].left = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                            <Ionicons name="arrow-forward" size={16} color="#64748B" style={{ marginHorizontal: 6 }} />
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Right ${pIdx + 1}`}
                              value={pair.right}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].matching_pairs![pIdx].right = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                            {(q.matching_pairs || []).length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = [...editQuizQuestions];
                                  updated[qIdx].matching_pairs = updated[qIdx].matching_pairs!.filter((_, i) => i !== pIdx);
                                  setEditQuizQuestions(updated);
                                }}
                                style={{ marginLeft: 6 }}
                              >
                                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addPairBtn}
                          onPress={() => {
                            const updated = [...editQuizQuestions];
                            updated[qIdx].matching_pairs = [...(updated[qIdx].matching_pairs || []), { left: '', right: '' }];
                            setEditQuizQuestions(updated);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#4F46E5" />
                          <Text style={styles.addPairBtnText}>Add Matching Pair</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>Visual Hint / Explanation (Optional):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Look at the dog's collar in slide 2"
                      value={q.hint || ''}
                      onChangeText={(txt) => {
                        const updated = [...editQuizQuestions];
                        updated[qIdx].hint = txt;
                        setEditQuizQuestions(updated);
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSlideBtn}
                  onPress={() =>
                    setEditQuizQuestions([
                      ...editQuizQuestions,
                      {
                        question_text: '',
                        question_type: 'descriptive',
                        image_url: '',
                        options: ['', '', '', ''],
                        correct_option_index: 0,
                        matching_pairs: [{ left: '', right: '' }],
                        hint: '',
                      },
                    ])
                  }
                >
                  <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
                  <Text style={styles.addSlideBtnText}>Add Question</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingQuiz(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingEditQuiz && styles.primaryBtnDisabled]}
                onPress={handleSaveEditQuiz}
                disabled={savingEditQuiz || loadingQuizQuestions}
              >
                {savingEditQuiz ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Quiz Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. TRASH BIN MODAL */}
      <Modal
        visible={showTrashModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrashModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="trash-bin" size={20} color="#DC2626" />
                  <Text style={styles.modalTitle}>Trash Bin ({trashCount})</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Restore accidentally deleted items or permanently remove them.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrashModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingTrash ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading trash items...</Text>
              </View>
            ) : trashItems.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="trash-outline" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyStateTitle}>Trash Bin is Empty</Text>
                <Text style={styles.emptyStateText}>No soft-deleted lessons or quizzes at this time.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {trashItems.map((item, idx) => {
                  const typeLabel =
                    item.item_type === 'lesson_group'
                      ? 'Story Group'
                      : item.item_type === 'lesson'
                      ? 'Lesson Tier'
                      : 'Quiz';
                  const dateStr = item.deleted_at
                    ? new Date(item.deleted_at).toLocaleString()
                    : 'Recently deleted';

                  return (
                    <View key={`${item.item_type}-${item.id}-${idx}`} style={styles.trashItemCard}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View
                            style={[
                              styles.itemTypeBadge,
                              item.item_type === 'lesson_group' && styles.itemTypeBadgeGroup,
                              item.item_type === 'lesson' && styles.itemTypeBadgeLesson,
                              item.item_type === 'quiz' && styles.itemTypeBadgeQuiz,
                            ]}
                          >
                            <Text style={styles.itemTypeBadgeText}>{typeLabel}</Text>
                          </View>
                          {item.difficulty && (
                            <View style={styles.trashTierBadge}>
                              <Text style={styles.trashTierBadgeText}>{item.difficulty.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.trashItemTitle}>{item.title}</Text>
                        <Text style={styles.trashItemSub}>
                          Deleted: {dateStr} {item.deleted_by ? `by ${item.deleted_by}` : ''}
                        </Text>
                      </View>

                      {/* Restore & Permanent Delete Actions */}
                      <View style={styles.trashActionsRow}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => handleRestoreItem(item.item_type, item.id)}
                        >
                          <Ionicons name="refresh-outline" size={14} color="#059669" />
                          <Text style={styles.restoreBtnText}>Restore</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.permanentDeleteBtn}
                          onPress={() => handlePermanentDeleteItem(item.item_type, item.id, item.title)}
                        >
                          <Ionicons name="trash" size={14} color="#DC2626" />
                          <Text style={styles.permanentDeleteBtnText}>Delete Forever</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { flex: 1 }]}
                onPress={() => setShowTrashModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. TEACHER HISTORY MODAL */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time" size={20} color="#4F46E5" />
                  <Text style={styles.modalTitle}>Teacher Activity History</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Audit log of content updates, deletions, and restorations.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingHistory ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading activity logs...</Text>
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="time-outline" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyStateTitle}>No History Recorded</Text>
                <Text style={styles.emptyStateText}>Teacher actions will be recorded here automatically.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {historyItems.map((log) => {
                  const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : '';
                  const actionType = log.action_type || 'action';

                  return (
                    <View key={log.id} style={styles.historyCard}>
                      <View style={styles.historyHeaderRow}>
                        <View
                          style={[
                            styles.historyActionBadge,
                            actionType === 'create' && styles.historyBadgeCreate,
                            actionType === 'update' && styles.historyBadgeUpdate,
                            (actionType === 'soft_delete' || actionType === 'trash') && styles.historyBadgeDelete,
                            actionType === 'restore' && styles.historyBadgeRestore,
                            actionType === 'permanent_delete' && styles.historyBadgePermanent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyActionBadgeText,
                              actionType === 'create' && styles.historyBadgeTextCreate,
                              actionType === 'update' && styles.historyBadgeTextUpdate,
                              (actionType === 'soft_delete' || actionType === 'trash') && styles.historyBadgeTextDelete,
                              actionType === 'restore' && styles.historyBadgeTextRestore,
                              actionType === 'permanent_delete' && styles.historyBadgeTextPermanent,
                            ]}
                          >
                            {actionType.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.historyTimestamp}>{dateStr}</Text>
                      </View>

                      <Text style={styles.historyDesc}>{log.description}</Text>

                      <View style={styles.historyMetaRow}>
                        <Text style={styles.historyMetaText}>
                          Teacher: <Text style={{ fontWeight: '600', color: '#334155' }}>{log.teacher_name}</Text>
                        </Text>
                        {log.target_type && (
                          <Text style={styles.historyMetaText}>
                            Target: <Text style={{ fontWeight: '600', color: '#334155' }}>{log.target_type}</Text>
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { flex: 1 }]}
                onPress={() => setShowHistoryModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  workspaceBody: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  sidebarExpanded: {
    width: 185,
  },
  sidebarCollapsed: {
    width: 54,
  },
  sidebarBrandHeader: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#312E81',
  },
  sidebarBrandHeaderCollapsed: {
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#312E81',
  },
  sidebarBrandTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sidebarBrandSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  sidebarToggleBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggleBtnCollapsed: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavList: {
    flex: 1,
    paddingVertical: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  sidebarItemCollapsed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginVertical: 3,
    borderRadius: 8,
  },
  sidebarItemCollapsedActive: {
    backgroundColor: '#EEF2FF',
  },
  sidebarItemIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarItemIconBoxActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sidebarItemText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 8,
  },
  sidebarItemTextActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  sidebarFooterCollapsed: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  sidebarLogoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  sidebarLogoutBtnCollapsed: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainHeaderStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mainSubjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mainSubjectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  subjectBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.5,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  topicChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  topicChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  topicChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  lessonGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  lessonGroupChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  lessonGroupChipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  lessonGroupChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tierCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  tierCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tierCountText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  tierCountTextActive: {
    color: '#FFFFFF',
  },
  tierSelectionContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  quizTierBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTierBtnActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  quizTierBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  quizTierBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  quizTierBtnTextActive: {
    color: '#FFFFFF',
  },
  quizTierBtnTextDisabled: {
    color: '#94A3B8',
  },
  quizTierSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  quizTierSubtextActive: {
    color: '#C7D2FE',
  },
  quizTierSubtextDisabled: {
    color: '#94A3B8',
  },
  quizTierBtnHasQuiz: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  quizTierBtnHasQuizActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  quizTierBtnTextHasQuiz: {
    color: '#92400E',
  },
  quizTierBtnTextHasQuizActive: {
    color: '#FFFFFF',
  },
  quizTierSubtextHasQuiz: {
    color: '#B45309',
  },
  quizTierSubtextHasQuizActive: {
    color: '#FEF3C7',
  },
  quizExistsAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  quizExistsAlertTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  quizExistsAlertText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#4F46E5',
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
  },
  tabLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardHelp: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tierBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tierBtnActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  tierBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tierBtnTextActive: {
    color: '#FFFFFF',
  },
  // Visual Storyboard Filmstrip & Slide Deck Styles
  storyboardFilmstripWrapper: {
    marginBottom: 16,
  },
  filmstripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  filmstripHeaderLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  filmstripHeaderHint: {
    fontSize: 11,
    color: '#64748B',
  },
  filmstripScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  filmstripCard: {
    width: 120,
    height: 130,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginRight: 10,
    justifyContent: 'space-between',
  },
  filmstripCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  filmstripBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  filmstripBadgeActive: {
    backgroundColor: '#4F46E5',
  },
  filmstripBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filmstripBadgeTextActive: {
    color: '#FFFFFF',
  },
  filmstripThumb: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  filmstripPlaceholderThumb: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  filmstripExcerpt: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 14,
  },
  filmstripExcerptActive: {
    color: '#312E81',
    fontWeight: '600',
  },
  filmstripAddCard: {
    width: 100,
    height: 130,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    gap: 6,
  },
  filmstripAddIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmstripAddText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  activeSlideCanvas: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 6,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activeSlideToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  activeSlideNumberPill: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeSlideNumberPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  activeSlideHelpText: {
    fontSize: 12,
    color: '#64748B',
  },
  slideNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.5,
  },
  slideDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasFieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  canvasTextArea: {
    minHeight: 85,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 13.5,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  canvasImagePreviewContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'center',
  },
  canvasSlidePreviewImg: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  canvasImageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  canvasChangeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  canvasChangeImgText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4F46E5',
  },
  canvasRemoveImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  canvasRemoveImgText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#DC2626',
  },
  canvasUploadDropzone: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasUploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  canvasUploadTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  canvasUploadSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  slideBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  slideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slideNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginTop: 6,
  },
  slidePreviewImg: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  removeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  removeImgText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  addSlideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 6,
  },
  addSlideBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  primaryBtnQuizExists: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  primaryBtnQuizExistsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  groupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tierChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  tierStatusActive: {
    backgroundColor: '#ECFDF5',
  },
  tierStatusMissing: {
    backgroundColor: '#F1F5F9',
  },
  tierStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tierStatusTextActive: {
    color: '#059669',
  },
  tierStatusTextMissing: {
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  questionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  questionBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#4F46E5',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F46E5',
  },
  matchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  addPairBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  quizCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizDeleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
  quizTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  quizSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  analyticsLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  analyticsLoadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  analyticsSectionHeader: {
    marginBottom: 14,
  },
  analyticsSectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  curriculumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  curriculumSubjectCard: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  curriculumIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curriculumSubjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  curriculumSubjectStats: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  directoryControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  directorySearchInputWrap: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  directorySearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  sortPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sortPillTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  directoryEmptyBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  studentDirectoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  studentAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  studentUsername: {
    fontSize: 12,
    color: '#64748B',
  },
  studentMetricsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  studentPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  studentPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  inspectStudentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  inspectStudentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  studentSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  starBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },

  /* Option A Dossier Styles */
  dossierContainer: {
    marginBottom: 20,
  },
  dossierBreadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dossierBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dossierBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  dossierHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dossierHeaderBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  dossierProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dossierProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dossierAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dossierAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },
  dossierStudentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dossierStudentUser: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  dossierQuickStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dossierQuickStatCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'center',
  },
  dossierQuickStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dossierQuickStatLabel: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
  },
  dossierSegmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  dossierSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  dossierSegmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  dossierSegmentTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  dossierSegmentTabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  dossierTabContent: {
    gap: 10,
  },
  attemptsFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  attemptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
  },
  attemptCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  attemptQuizTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  attemptTopicText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  diffBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  attemptCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  attemptScoreGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attemptScoreText: {
    fontSize: 13,
    color: '#475569',
  },
  attemptAccPercent: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  attemptStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  attemptStatusPassed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  attemptStatusFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  attemptStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  attemptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  attemptMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attemptMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  bktBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 14,
    marginBottom: 6,
  },
  bktBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bktBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3730A3',
  },
  bktBannerDesc: {
    fontSize: 11.5,
    color: '#4338CA',
    marginTop: 2,
    lineHeight: 16,
  },
  bktSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bktSummaryCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  bktSummaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  bktSummaryLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  kcCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
  },
  kcCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kcTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  kcTopic: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  kcStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  kcStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kcProgressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  kcProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  kcFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  kcMasteryPercent: {
    fontSize: 12,
    color: '#334155',
  },
  kcCountsText: {
    fontSize: 11,
    color: '#64748B',
  },
  badgesSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 6,
  },
  badgesSummaryBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  badgesGrid: {
    gap: 8,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
  },
  badgeCardLocked: {
    backgroundColor: '#F8FAFC',
    opacity: 0.75,
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeTitleLocked: {
    color: '#64748B',
  },
  badgeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeStatusPillUnlocked: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeStatusPillLocked: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  badgeStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  badgeStatusTextUnlocked: {
    color: '#059669',
  },
  badgeStatusTextLocked: {
    color: '#64748B',
  },
  badgeDescription: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  sidebarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginBottom: 6,
    gap: 6,
  },
  sidebarActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sidebarActionBtnCollapsed: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  sidebarTrashBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTrashBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sidebarTrashBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626',
  },
  sidebarFooterDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  pulseContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  pulseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  pulseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  pulseTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  pulseActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 5,
  },
  pulseActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  pulseActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  pulseSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
  },
  pulseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    gap: 5,
  },
  pulseActionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  pulseActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    gap: 5,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  pulseActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pulseCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pulseCard: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  pulseCardAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pulseCardEmerald: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pulseCardIndigo: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  pulseCardIconAmber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCardIconEmerald: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCardIconIndigo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCardTitleAmber: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  pulseCardTitleEmerald: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#065F46',
  },
  pulseCardTitleIndigo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3730A3',
  },
  pulseCardSubAmber: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  pulseCardSubEmerald: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  pulseCardSubIndigo: {
    fontSize: 11,
    color: '#4338CA',
    marginTop: 2,
  },
  curriculumTopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  curriculumTopTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  curriculumTopSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  curriculumStoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  storyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  storyCardHeaderCollapsed: {
    borderBottomWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  expandChevronBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandChevronBadgeActive: {
    backgroundColor: '#EEF2FF',
  },
  storyCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  storyCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  storyDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  storyDeleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  storyTiersContainer: {
    padding: 12,
    gap: 10,
  },
  tierCardActive: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  tierCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  tierBadgeEasy: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tierBadgeMedium: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tierBadgeHard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tierBadgeTextEasy: {
    color: '#059669',
  },
  tierBadgeTextMedium: {
    color: '#D97706',
  },
  tierBadgeTextHard: {
    color: '#DC2626',
  },
  tierSection: {
    flex: 1,
    minWidth: 140,
  },
  tierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tierInfoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  tierInfoTextSuccess: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  tierInfoTextWarning: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  tierActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  actionBtnSuccessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  actionBtnDangerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionBtnAmberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  tierCardMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
  },
  tierBadgeMissing: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    minWidth: 64,
    alignItems: 'center',
  },
  tierBadgeTextMissing: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tierMissingText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
    marginLeft: 10,
  },
  tierCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  tierCreateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  viewCurriculumLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 12,
  },
  viewCurriculumLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 6,
  },
  modalBody: {
    padding: 16,
    maxHeight: 520,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalEmptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  itemTypeBadgeGroup: {
    backgroundColor: '#EEF2FF',
  },
  itemTypeBadgeLesson: {
    backgroundColor: '#F0FDF4',
  },
  itemTypeBadgeQuiz: {
    backgroundColor: '#FEF3C7',
  },
  itemTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  trashTierBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trashTierBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  trashItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  trashItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  trashActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  permanentDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  permanentDeleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyActionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeCreate: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  historyBadgeUpdate: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  historyBadgeDelete: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  historyBadgeRestore: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  historyBadgePermanent: {
    backgroundColor: '#450A0A',
  },
  historyActionBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  historyBadgeTextCreate: {
    color: '#059669',
  },
  historyBadgeTextUpdate: {
    color: '#4F46E5',
  },
  historyBadgeTextDelete: {
    color: '#DC2626',
  },
  historyBadgeTextRestore: {
    color: '#7C3AED',
  },
  historyBadgeTextPermanent: {
    color: '#FEF2F2',
  },
  historyTimestamp: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyDesc: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    marginBottom: 4,
  },
  historyMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
  },

  // Split Editor & Interactive Student Phone Mockup
  editorTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  previewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewToggleBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  previewToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  previewToggleBtnTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  editorLayoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  editorLayoutRowMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  editorLayoutColumn: {
    flex: 1,
    minWidth: 0,
  },
  phoneSimulatorColumn: {
    width: 320,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      position: 'sticky' as any,
      top: 16,
      alignSelf: 'flex-start',
    } : {}),
  },
  phoneSimulatorColumnMobile: {
    width: '100%',
    marginTop: 16,
  },
  phoneSimulatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  previewPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
  },
  previewPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewPanelCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPanelSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
    width: '100%',
    textAlign: 'left',
  },
  phoneSimulatorSticky: {
    width: '100%',
    alignItems: 'center',
  },
  phoneSimulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  phoneSimulatorLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  phoneSimulatorHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneSimulatorHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalContainerWide: {
    maxWidth: 1040,
  },

  // Android Phone Mockup Hardware & Screen
  phoneMockupFrame: {
    width: 285,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    padding: 7,
    borderWidth: 2.5,
    borderColor: '#334155',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center',
  },
  phoneScreenContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 10,
    paddingBottom: 0,
    minHeight: 460,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  phoneStatusBar: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
    height: 18,
  },
  phoneStatusTime: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
    width: 44,
  },
  phonePunchHoleCameraWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as any,
  },
  phonePunchHoleCamera: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  phoneStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 44,
    justifyContent: 'flex-end',
  },
  phoneStudentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  phoneStoryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  phoneStorySubtitle: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '500',
  },
  phoneTierPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  phoneTierPillEasy: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  phoneTierPillMedium: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  phoneTierPillHard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  phoneTierPillText: {
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  phoneTierPillTextEasy: {
    color: '#059669',
  },
  phoneTierPillTextMedium: {
    color: '#D97706',
  },
  phoneTierPillTextHard: {
    color: '#DC2626',
  },
  phoneProgressContainer: {
    marginBottom: 6,
  },
  phoneProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phoneProgressBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  phoneProgressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  phoneProgressText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  phoneStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  phoneStageBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  phoneSlideImg: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  phoneImgPlaceholder: {
    width: '100%',
    height: 105,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    padding: 8,
  },
  phoneImgPlaceholderText: {
    fontSize: 9.5,
    color: '#6366F1',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  phoneNarrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  phoneNarrationLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  phoneNarrationText: {
    fontSize: 11,
    color: '#1E293B',
    lineHeight: 15,
  },
  phoneBottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 4,
  },
  phoneNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.4,
  },
  phoneNextBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNextBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  androidNavBar: {
    backgroundColor: '#0F172A',
    height: 32,
    marginHorizontal: -10,
    marginBottom: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  androidNavBtn: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
