import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";
import { COLORS } from "../../context/theme";

const STORAGE_KEYS = {
  ASL_DEFAULT: "@dhh_asl_default",
  HAPTICS: "@dhh_haptics_enabled",
  HIGH_CONTRAST: "@dhh_high_contrast",
};

export default function SettingsScreen() {
  const { user, setUser, logout } = useAuth();
  const userId = user?.id || 1;

  // Avatar State & 24h Cooldown
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<any>(null);

  // DHH Accessibility Preference Toggles
  const [aslDefault, setAslDefault] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  // Profile Edit Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Help & Legal Modals State
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedAsl, savedHaptics, savedContrast] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ASL_DEFAULT),
          AsyncStorage.getItem(STORAGE_KEYS.HAPTICS),
          AsyncStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST),
        ]);
        if (savedAsl !== null) setAslDefault(savedAsl === "true");
        if (savedHaptics !== null) setHapticsEnabled(savedHaptics === "true");
        if (savedContrast !== null) setHighContrast(savedContrast === "true");
      } catch (err) {
        console.log("Could not load preferences:", err);
      }
    };
    loadPreferences();
    fetchAvatarStatus();
  }, [userId]);

  const fetchAvatarStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/avatar-status`);
      if (res.ok) {
        const data = await res.json();
        setAvatarStatus(data);
        if (data.avatar_url && data.avatar_url !== user?.avatar_url && user) {
          setUser({
            ...user,
            avatar_url: data.avatar_url,
            last_avatar_changed_at: data.last_avatar_changed_at,
          });
        }
      }
    } catch (err) {
      console.log("Error fetching avatar status:", err);
    }
  };

  const triggerHaptic = () => {
    if (hapticsEnabled) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    }
  };

  const handleToggleAsl = async (val: boolean) => {
    triggerHaptic();
    setAslDefault(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ASL_DEFAULT, String(val));
    } catch {}
  };

  const handleToggleHaptics = async (val: boolean) => {
    if (val) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {}
    }
    setHapticsEnabled(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAPTICS, String(val));
    } catch {}
  };

  const handleToggleContrast = async (val: boolean) => {
    triggerHaptic();
    setHighContrast(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(val));
    } catch {}
  };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  // Avatar Picker & Upload with 24-hour rate limit check
  const handlePickAvatar = async () => {
    // 1. Check 24-hour cooldown
    if (avatarStatus && !avatarStatus.can_change) {
      const remainingSec = avatarStatus.remaining_seconds || 0;
      const hours = Math.floor(remainingSec / 3600);
      const minutes = Math.floor((remainingSec % 3600) / 60);
      showAlert(
        "Picture Locked (24-Hour Cooldown)",
        `You can only change your profile picture once every 24 hours to prevent frequent updates.\n\nYou can change it again in ${hours > 0 ? `${hours}h ` : ""}${minutes}m.`
      );
      return;
    }

    // 2. Request permission
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Permission Required",
          "Please grant camera roll permissions to select a profile picture."
        );
        return;
      }

      // 3. Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setUploadingAvatar(true);

      const fetchRes = await fetch(asset.uri);
      const blob = await fetchRes.blob();
      const filename = asset.fileName || asset.uri.split("/").pop() || "avatar.jpg";

      const formData = new FormData();
      formData.append("file", blob, filename);

      const res = await fetch(`${API_URL}/student/${userId}/upload-avatar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      if (user) {
        setUser({
          ...user,
          avatar_url: data.avatar_url,
          last_avatar_changed_at: data.last_avatar_changed_at,
        });
      }

      showAlert(
        "Profile Picture Updated!",
        "Your new picture is now visible on your Home screen, and to your Teacher and Admin.\n\nNote: It is now set for 24 hours."
      );
      fetchAvatarStatus();
    } catch (err: any) {
      showAlert("Upload Error", err.message || "Could not upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) {
      showAlert("Error", "Please enter a valid display name.");
      return;
    }
    setUpdatingProfile(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/update-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed.");
      showAlert("Success", "Your profile name has been updated!");
      if (user) {
        setUser({ ...user, name: newName.trim() });
      }
      setProfileModalVisible(false);
    } catch (err: any) {
      showAlert("Error", err.message || "Could not update profile.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      showAlert("Error", "New password must be at least 4 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password change failed.");
      showAlert("Success", "Your password has been changed successfully!");
      setPasswordModalVisible(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showAlert("Error", err.message || "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmLogout = window.confirm("Are you sure you want to log out?");
      if (confirmLogout) {
        logout().then(() => {
          router.replace("/");
        });
      }
    } else {
      Alert.alert(
        "Log Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log Out",
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/");
            },
          },
        ]
      );
    }
  };

  type SettingItemProps = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    color: string;
    bgColor: string;
    isLast?: boolean;
    onPress?: () => void;
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    color,
    bgColor,
    isLast = false,
    onPress = () => {},
  }: SettingItemProps) => (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );

  const displayAvatarUri = user?.avatar_url || avatarStatus?.avatar_url;
  const isCooldownActive = avatarStatus && !avatarStatus.can_change;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your learning experience</Text>
        </View>

        {/* Student Profile Card with Editable Avatar */}
        <View style={styles.profileCard}>
          {/* Avatar with Camera badge */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            <View style={styles.avatarCircle}>
              {uploadingAvatar ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : displayAvatarUri ? (
                <Image source={{ uri: displayAvatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarLetter}>
                  {(user?.name || "Student").charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            {/* Small camera/lock badge on avatar */}
            <View
              style={[
                styles.cameraBadge,
                isCooldownActive ? styles.cameraBadgeLocked : styles.cameraBadgeActive,
              ]}
            >
              <Ionicons
                name={isCooldownActive ? "lock-closed" : "camera"}
                size={11}
                color="#FFFFFF"
              />
            </View>
          </TouchableOpacity>

          {/* Profile Name */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name || "Student"}
            </Text>
            <Text style={styles.profileHandle}>
              @{user?.username || "student"}
            </Text>
          </View>
        </View>

        {/* Sign Language & Visual Preferences */}
        <Text style={styles.sectionTitle}>SIGN LANGUAGE & DISPLAY</Text>
        <View style={styles.sectionCard}>
          {/* ASL Default Toggle */}
          <View style={[styles.settingItem, styles.settingItemBorder]}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="hand-left" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Use Sign Language First</Text>
              <Text style={styles.settingSubtitle}>
                Show quiz questions in Sign Language order
              </Text>
            </View>
            <Switch
              value={aslDefault}
              onValueChange={handleToggleAsl}
              trackColor={{ false: "#E2E8F0", true: COLORS.primaryBorder }}
              thumbColor={aslDefault ? COLORS.primary : "#FFFFFF"}
            />
          </View>

          {/* Haptic Vibration Toggle */}
          <View style={[styles.settingItem, styles.settingItemBorder]}>
            <View style={[styles.iconContainer, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="phone-portrait-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Vibrate on Tap</Text>
              <Text style={styles.settingSubtitle}>
                Feel a buzz when tapping quiz answers
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: "#E2E8F0", true: COLORS.primaryBorder }}
              thumbColor={hapticsEnabled ? COLORS.primary : "#FFFFFF"}
            />
          </View>

          {/* High Contrast Mode Toggle */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="contrast-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Bold & High Contrast</Text>
              <Text style={styles.settingSubtitle}>
                Darker text and sharper borders
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={handleToggleContrast}
              trackColor={{ false: "#E2E8F0", true: COLORS.primaryBorder }}
              thumbColor={highContrast ? COLORS.primary : "#FFFFFF"}
            />
          </View>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>MY ACCOUNT</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="person-outline"
            title="Edit Profile Name"
            subtitle="Change your student display name"
            color={COLORS.primary}
            bgColor={COLORS.primaryLight}
            onPress={() => {
              setNewName(user?.name || "");
              setProfileModalVisible(true);
            }}
          />
          <SettingItem
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your login password"
            color={COLORS.primary}
            bgColor={COLORS.primaryLight}
            isLast
            onPress={() => setPasswordModalVisible(true)}
          />
        </View>

        {/* Gamification & Competition */}
        <Text style={styles.sectionTitle}>BADGES & LEADERBOARD</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="trophy-outline"
            title="Trophies & Badges"
            subtitle="See badges you have unlocked"
            color="#D97706"
            bgColor="#FEF3C7"
            onPress={() => router.push("/badges")}
          />
          <SettingItem
            icon="flame-outline"
            title="Class Leaderboard"
            subtitle="See class rankings and scores"
            color={COLORS.streak}
            bgColor={COLORS.streakBg}
            isLast
            onPress={() => router.push("/leaderboard")}
          />
        </View>

        {/* Reports Section */}
        <Text style={styles.sectionTitle}>PROGRESS REPORTS</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="document-text-outline"
            title="Learning Report"
            subtitle="Check your quiz scores and time"
            color={COLORS.aslTeal}
            bgColor={COLORS.aslTealBg}
            onPress={() => router.push("/report")}
          />
          <SettingItem
            icon="documents-outline"
            title="Past Quiz History"
            subtitle="Review all your past quiz tries"
            color="#6366F1"
            bgColor="#EEF2FF"
            isLast
            onPress={() => router.push("/past-reports")}
          />
        </View>

        {/* Preferences & Help */}
        <Text style={styles.sectionTitle}>HELP & GUIDES</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="help-circle-outline"
            title="How to Use This App"
            subtitle="Guides for ASL Helper, Hints, and Streaks"
            color={COLORS.primary}
            bgColor={COLORS.primaryLight}
            isLast
            onPress={() => setHelpModalVisible(true)}
          />
        </View>

        {/* Legal & Privacy Section */}
        <Text style={styles.sectionTitle}>LEGAL & PRIVACY</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Student code of conduct & rules"
            color="#0284C7"
            bgColor="#E0F2FE"
            onPress={() => router.push("/legal?tab=terms" as any)}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="Data protection under RA 10173"
            color="#059669"
            bgColor="#ECFDF5"
            onPress={() => router.push("/legal?tab=privacy" as any)}
          />
          <SettingItem
            icon="key-outline"
            title="App Permissions & Data"
            subtitle="View Android storage, camera & vibration usage"
            color="#7C3AED"
            bgColor="#F3E8FF"
            isLast
            onPress={() => setPermissionModalVisible(true)}
          />
        </View>

        {/* Account Actions Section */}
        <Text style={styles.sectionTitle}>SESSION</Text>
        <View style={[styles.sectionCard, styles.logoutCard]}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: "#EF4444" }]}>Log Out</Text>
              <Text style={styles.settingSubtitle}>Sign out of this student account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>BrightPath DHH Learning App</Text>
          <Text style={styles.versionSubtext}>Version 1.2.0 • Offline Ready</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Name</Text>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Username (Account ID)</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>@{user?.username || "student"}</Text>
            </View>

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>Your Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity
              style={[styles.modalActionBtn, updatingProfile && { opacity: 0.6 }]}
              onPress={handleUpdateProfile}
              disabled={updatingProfile}
              activeOpacity={0.85}
            >
              {updatingProfile ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalActionBtnText}>Save Name</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Current Password</Text>
            <TextInput
              style={styles.modalInput}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter current password"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 4 characters"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Type new password again"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.modalActionBtn, changingPassword && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
              activeOpacity={0.85}
            >
              {changingPassword ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalActionBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help & Support FAQ Modal */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "82%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="help-circle" size={22} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Help & Quick Guide</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHelpModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.faqCard}>
                <View style={styles.faqQRow}>
                  <Ionicons name="hand-left-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.faqQ}>What is the ASL Helper?</Text>
                </View>
                <Text style={styles.faqA}>
                  Tap the floating purple hand icon during any lesson or quiz to see the Sign Language translation right away.
                </Text>
              </View>

              <View style={styles.faqCard}>
                <View style={styles.faqQRow}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.faqQ}>How do Hints work?</Text>
                </View>
                <Text style={styles.faqA}>
                  Using a Hint costs 5 Stars. It gives you an easy visual clue and removes one wrong answer.
                </Text>
              </View>

              <View style={styles.faqCard}>
                <View style={styles.faqQRow}>
                  <Ionicons name="flame-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.faqQ}>How do I keep my Streak?</Text>
                </View>
                <Text style={styles.faqA}>
                  Complete at least one quiz every day. If your streak breaks, you can use 30 Stars on the Daily Quiz screen to fix it!
                </Text>
              </View>

              <View style={styles.faqCard}>
                <View style={styles.faqQRow}>
                  <Ionicons name="options-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.faqQ}>What is Sign Language Mode?</Text>
                </View>
                <Text style={styles.faqA}>
                  It changes the words in quiz questions to match Sign Language grammar, making it easier to read and understand.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* App Permissions Explainer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={permissionModalVisible}
        onRequestClose={() => setPermissionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
              <Text style={styles.modalTitle}>Android Permissions</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 18 }}>
              This application requests the following Android system permissions to deliver an accessible sign language learning experience:
            </Text>

            <View style={{ gap: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="images-outline" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>Photos & Media Library</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 16 }}>Used solely when you pick a profile picture for your avatar. Your photos are never sold or shared.</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="phone-portrait-outline" size={20} color={COLORS.aslTeal} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>Vibration Control</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 16 }}>Provides tactile haptic buzz feedback during quiz taps for Deaf/Hard-of-Hearing accessibility.</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="wifi-outline" size={20} color="#0284C7" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>Internet & Network State</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 16 }}>Communicates securely with the server and syncs offline quiz attempts automatically.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => setPermissionModalVisible(false)}
            >
              <Text style={styles.modalActionBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // Anti-glare Slate-50 canvas
  },
  container: {
    padding: 16,
    paddingTop: Platform.OS === "android" ? 16 : 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  // Profile Banner Card
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 14,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  cameraBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  cameraBadgeLocked: {
    backgroundColor: "#D97706",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  profileHandle: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
    fontWeight: "600",
  },
  // Section Headers
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  settingSubtitle: {
    fontSize: 13,
    color: "#475569", // Slate-600 for sharp, high-contrast readability
    marginTop: 3,
    lineHeight: 18,
    fontWeight: "500",
  },
  logoutCard: {
    borderColor: "#FECACA",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  versionSubtext: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: "#F8FAFC",
  },
  readOnlyInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  readOnlyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  modalActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  modalActionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  faqCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  faqQRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    flex: 1,
  },
  faqA: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});
