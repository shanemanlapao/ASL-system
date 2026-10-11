import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../context/theme";

const STORAGE_KEY = "@brightpath_permissions_requested";

interface PermissionModalProps {
  visible?: boolean;
  onDismiss?: () => void;
}

export default function PermissionModal({ onDismiss }: PermissionModalProps) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const alreadyAsked = await AsyncStorage.getItem(STORAGE_KEY);
      if (!alreadyAsked) {
        setShowModal(true);
      }
    } catch {
      // If error reading storage, default to false
    }
  };

  const handleAllowPermissions = async () => {
    try {
      // Request media library permission
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch (err) {
      console.log("Permission request error:", err);
    } finally {
      await markCompleted();
    }
  };

  const handleSkip = async () => {
    await markCompleted();
  };

  const markCompleted = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setShowModal(false);
    if (onDismiss) onDismiss();
  };

  if (!showModal) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={showModal}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={36} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Welcome to BrightPath!</Text>
          <Text style={styles.subtitle}>
            To give you the best interactive learning experience, BrightPath works best with these permissions:
          </Text>

          {/* Permission item 1 */}
          <View style={styles.itemRow}>
            <View style={styles.itemIconBadge}>
              <Ionicons name="images-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Photo Library & Files</Text>
              <Text style={styles.itemDesc}>
                Allows you to pick and set your personal student profile picture.
              </Text>
            </View>
          </View>

          {/* Permission item 2 */}
          <View style={styles.itemRow}>
            <View style={styles.itemIconBadge}>
              <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Haptic & Vibration</Text>
              <Text style={styles.itemDesc}>
                Gives tactile vibration feedback when you answer quiz questions.
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAllowPermissions}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Allow Permissions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    width: "100%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  skipButtonText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
});
