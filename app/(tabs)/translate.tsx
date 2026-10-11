import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../context/config";
import { COLORS } from "../../context/theme";

const TRANSLATE_URL = `${API_URL}/translate`;

type Direction = "en_to_asl" | "asl_to_en";

export default function TranslateScreen() {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<Direction>("en_to_asl");

  const fromLabel = direction === "en_to_asl" ? "Basic English" : "ASL Gloss";
  const toLabel = direction === "en_to_asl" ? "ASL Gloss" : "Basic English";
  const placeholder =
    direction === "en_to_asl"
      ? "Type in Basic English..."
      : "Type in ASL Gloss (e.g. IX WANT BAKE CAKE)...";

  const handleSwap = () => {
    setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    } else {
      setInputText("");
      setTranslatedText("");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setTranslatedText("");
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, direction }),
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      setTranslatedText(data.result ?? data.error ?? "No result returned.");
    } catch (error: any) {
      console.error("Translation error:", error);
      Alert.alert(
        "Connection Error",
        "Could not reach the translation server. Please check your network connection.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setTranslatedText("");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Translation Tool</Text>
          <Text style={styles.subtitle}>Translate between Basic English and ASL Gloss</Text>
        </View>

        {/* Direction Swap Card */}
        <TouchableOpacity
          style={styles.languageToggleCard}
          onPress={handleSwap}
          activeOpacity={0.85}
        >
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>FROM</Text>
            <Text style={[styles.languageActive, { color: direction === "en_to_asl" ? COLORS.primary : COLORS.aslTeal }]}>
              {fromLabel}
            </Text>
          </View>

          <View style={styles.swapIconContainer}>
            <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>TO</Text>
            <Text style={[styles.languageActive, { color: direction === "en_to_asl" ? COLORS.aslTeal : COLORS.primary }]}>
              {toLabel}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputTitle}>Enter text to translate</Text>
            {inputText.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={inputText}
              onChangeText={setInputText}
            />
          </View>

          <Text style={styles.characterCount}>{inputText.length} characters</Text>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[
            styles.translateButton,
            (loading || !inputText.trim()) && styles.translateButtonDisabled,
          ]}
          onPress={handleTranslate}
          disabled={loading || !inputText.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.translateButtonText}>Translating...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="language" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.translateButtonText}>Translate</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Translation Result Card (Only rendered when there is a result) */}
        {translatedText !== "" && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                <Text style={styles.resultTitle}>{toLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setInputText(translatedText);
                  setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
                  setTranslatedText("");
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text selectable style={styles.resultText}>
              {translatedText}
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
    backgroundColor: COLORS.background, // Anti-glare Slate-50 canvas
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 12,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 3,
  },
  // Language Direction Card
  languageToggleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  languageSection: {
    flex: 1,
    alignItems: "center",
  },
  languageLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  languageActive: {
    fontSize: 15,
    fontWeight: "700",
  },
  swapIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Input Card
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  textInputContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 90,
    lineHeight: 22,
  },
  characterCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "right",
    fontWeight: "500",
  },
  // Translate Button
  translateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  translateButtonDisabled: {
    backgroundColor: "#DDD6FE",
    shadowOpacity: 0,
    elevation: 0,
  },
  translateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Result Card
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resultText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 25,
  },
});
