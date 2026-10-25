import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS } from "../context/theme";

export default function LegalScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(
    params.tab === "privacy" ? "privacy" : "terms"
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal & Compliance</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segmented Tab Bar */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "terms" && styles.tabButtonActive]}
          onPress={() => setActiveTab("terms")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={activeTab === "terms" ? COLORS.primary : "#64748B"}
          />
          <Text
            style={[styles.tabText, activeTab === "terms" && styles.tabTextActive]}
          >
            Terms of Service
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "privacy" && styles.tabButtonActive]}
          onPress={() => setActiveTab("privacy")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={activeTab === "privacy" ? COLORS.primary : "#64748B"}
          />
          <Text
            style={[styles.tabText, activeTab === "privacy" && styles.tabTextActive]}
          >
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Scroll View */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "terms" ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Terms of Service</Text>
            <Text style={styles.effectiveDate}>Effective Date: October 2026</Text>

            <Text style={styles.paragraph}>
              Welcome to the <Text style={styles.boldText}>ASL Learning System</Text>. By creating an account or using this mobile application, you agree to comply with and be bound by the following Terms of Service.
            </Text>

            <Text style={styles.subHeading}>1. Purpose of the Platform</Text>
            <Text style={styles.paragraph}>
              This application is designed specifically for Deaf and Hard-of-Hearing (DHH) students, teachers, and administrators to facilitate Sign Language learning, quiz assessments, and intelligent tutoring.
            </Text>

            <Text style={styles.subHeading}>2. Student Account & Academic Integrity</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • You are responsible for keeping your login credentials secure.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Cheating or Scripting</Text>: Using automated scripts, bots, or rate-limit circumvention tools to alter quiz scores or star rewards is strictly prohibited.
              </Text>
              <Text style={styles.bulletItem}>
                • Profile pictures must be respectful and appropriate for an educational environment.
              </Text>
            </View>

            <Text style={styles.subHeading}>3. Rate Limits & Account Security</Text>
            <Text style={styles.paragraph}>
              To ensure system stability for all learners, rate limits are enforced across login attempts, AI translation queries, and quiz submissions. Repeated security violations may result in temporary account lockout.
            </Text>

            <Text style={styles.subHeading}>4. Revisions to Terms</Text>
            <Text style={styles.paragraph}>
              We reserve the right to update these terms to reflect enhancements in educational tools or legal guidelines. Continued use of the app signifies acceptance of updated terms.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Privacy Policy</Text>
            <Text style={styles.effectiveDate}>Philippine Data Privacy Act (RA 10173) Compliant</Text>

            <Text style={styles.paragraph}>
              Your privacy is fundamental to our educational mission. This policy details how student information is collected, protected, and used in accordance with the <Text style={styles.boldText}>Philippine Data Privacy Act of 2012 (RA 10173)</Text>.
            </Text>

            <Text style={styles.subHeading}>1. Information We Collect</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Account Information</Text>: Your display name and username.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Academic & Mastery Data</Text>: Quiz scores, completion timestamps, Bayesian Knowledge Tracing (BKT) mastery rates, and stars earned.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Profile Photo</Text>: Uploaded avatar images used exclusively for in-app identification on Home, Teacher, and Admin dashboards.
              </Text>
            </View>

            <Text style={styles.subHeading}>2. How Your Data is Used</Text>
            <Text style={styles.paragraph}>
              All collected information is used strictly for <Text style={styles.boldText}>educational evaluation, adaptive tutoring, and classroom progress tracking</Text> by authorized teachers and administrators. We <Text style={styles.boldText}>never</Text> sell, monetize, or share your data with third-party advertisers.
            </Text>

            <Text style={styles.subHeading}>3. Device Permissions</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Photo Library / Storage</Text>: Used solely when you choose to pick and upload a profile picture.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Vibration</Text>: Used for tactile haptic feedback during quiz interactions.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Internet & Network State</Text>: Used to communicate securely with the learning server and support offline quiz sync.
              </Text>
            </View>

            <Text style={styles.subHeading}>4. Student Rights under RA 10173</Text>
            <Text style={styles.paragraph}>
              You have the right to inspect your learning progress, request corrections to profile information, or request the deletion of your account through your teacher or system administrator.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tabButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
      },
    }),
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 16,
  },
  subHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
  },
  boldText: {
    fontWeight: "700",
    color: "#0F172A",
  },
  bulletList: {
    marginTop: 4,
    gap: 6,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 22,
    color: "#334155",
  },
});
