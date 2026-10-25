import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { Topic } from "../../data/subjects";
import { useSubjects } from "../../context/SubjectsContext";

export default function EnhanceScreen() {
  const { id } = useLocalSearchParams();
  const { subjects } = useSubjects();
  const subject = subjects[id as string];

  if (!subject) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text>Subject not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#0284C7' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Flatten topics from all categories
  const allTopics: Topic[] = [];
  subject.categories.forEach(cat => {
    allTopics.push(...cat.topics);
  });

  // Categorize topics based on progress
  const excellingTopics = allTopics.filter(t => t.progress >= 80);
  const improveTopics = allTopics.filter(t => t.progress < 80);

  // Helper for subtitle texts
  const getSubtitle = (topicId: string, type: 'excelling' | 'improve') => {
    if (topicId === 'addition') return "You're mastering addition! Ready for a challenge?";
    if (topicId === 'multiplication') return "Great work on multiplication tables!";
    if (topicId === 'fractions') return "Let's work on fractions with easier examples";
    if (topicId === 'division') return "Division needs more practice. We'll simplify it!";
    
    if (type === 'excelling') return "You're doing great! Keep it up.";
    return "Let's review this together.";
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0284C7" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Enhance Knowledge</Text>
          <Text style={styles.headerSubtitle}>Personalized learning recommendations</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        
        {/* Excelling Section */}
        {excellingTopics.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>You're Excelling!</Text>
            </View>

            {excellingTopics.map(topic => (
              <View key={topic.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.topicIconContainer, { backgroundColor: topic.bgColor }]}>
                    <Ionicons name={topic.icon as any} size={24} color={topic.iconColor} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTopicName}>{topic.name}</Text>
                      <View style={styles.excellingBadge}>
                        <Ionicons name="checkmark-circle-outline" size={12} color="#16A34A" style={{marginRight: 2}}/>
                        <Text style={styles.excellingBadgeText}>{topic.progress}%</Text>
                      </View>
                    </View>
                    <Text style={styles.cardSubtitle}>{getSubtitle(topic.id, 'excelling')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.excellingButton}>
                  <Ionicons name="chevron-up" size={16} color="white" style={{marginRight: 4}}/>
                  <Text style={styles.buttonText}>Increase Difficulty</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Improve Section */}
        {improveTopics.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.improveIconBg}>
                <Ionicons name="trending-down" size={16} color="#EA580C" />
              </View>
              <Text style={styles.sectionTitle}>Let's Improve Together</Text>
            </View>

            {improveTopics.map(topic => (
              <View key={topic.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.topicIconContainer, { backgroundColor: topic.bgColor }]}>
                    <Ionicons name={topic.icon as any} size={24} color={topic.iconColor} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTopicName}>{topic.name}</Text>
                      <View style={styles.improveBadge}>
                        <Ionicons name="alert-circle-outline" size={12} color="#EA580C" style={{marginRight: 2}}/>
                        <Text style={styles.improveBadgeText}>{topic.progress}%</Text>
                      </View>
                    </View>
                    <Text style={styles.cardSubtitle}>{getSubtitle(topic.id, 'improve')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.improveButton}>
                  <Ionicons name="chevron-down" size={16} color="white" style={{marginRight: 4}}/>
                  <Text style={styles.buttonText}>Get Easier Questions</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0369A1',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  excellingIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  improveIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  topicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTopicName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  excellingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  excellingBadgeText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  improveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  improveBadgeText: {
    fontSize: 12,
    color: '#EA580C',
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  excellingButton: {
    flexDirection: 'row',
    backgroundColor: '#4ADE80', // Exact green from image
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  improveButton: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B', // Exact orange from image
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
