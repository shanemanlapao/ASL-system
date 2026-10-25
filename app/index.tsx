import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";
import { COLORS } from "../context/theme";

export default function LoginScreen() {
  const { setUser } = useAuth();
  const params = useLocalSearchParams<{ registered?: string; registeredName?: string }>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(!!params.registered);
  const successName = params.registeredName ? decodeURIComponent(params.registeredName) : "";

  useEffect(() => {
    if (params.registered) {
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  const [loginError, setLoginError] = useState("");

  const handleLogin = async () => {
    setLoginError("");
    if (!username.trim() || !password.trim()) {
      setLoginError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || "Invalid username or password.");
        return;
      }
      // In production, teacher and admin access is restricted to Web Portal.
      // During local development (__DEV__), allow logging in on any platform for testing before deployment.
      if (!__DEV__ && Platform.OS !== "web" && (data.user?.role === "teacher" || data.user?.role === "admin")) {
        setLoginError("Teacher & Admin access is restricted to the Web Portal. Please log in using a web browser.");
        setLoading(false);
        return;
      }

      setUser(data.user);
      if (data.user?.role === "admin") {
        router.replace("/admin" as any);
      } else if (data.user?.role === "teacher") {
        router.replace("/teacher" as any);
      } else {
        router.replace("/(tabs)/home");
      }
    } catch {
      setLoginError("Cannot reach the server. Make sure it is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="height"
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ✅ Success banner from register */}
          {showSuccess && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.successBannerText}>
                Account created{successName ? ` for ${successName}` : ""}! Please sign in.
              </Text>
              <TouchableOpacity onPress={() => setShowSuccess(false)}>
                <Ionicons name="close" size={16} color="#10B981" />
              </TouchableOpacity>
            </View>
          )}

          {/* Logo and Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("../assets/images/brightpath-logo.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.title}>BrightPath</Text>
            <Text style={styles.subtitle}>
              Empowering deaf students through interactive learning
            </Text>
          </View>

          {/* Login Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>

            {/* Login error inline */}
            {loginError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorBannerText}>{loginError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your username"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Legal compliance text */}
            <TouchableOpacity
              style={{ marginTop: 16, alignItems: "center" }}
              onPress={() => router.push("/legal?tab=terms" as any)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center" }}>
                By continuing, you agree to our{" "}
                <Text style={{ color: "#7C3AED", fontWeight: "600", textDecorationLine: "underline" }}>
                  Terms of Service & Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    ...(Platform.OS === "web" ? { alignItems: "center" } : {}),
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 440, alignSelf: "center" } : {}),
  },
  logoWrapper: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  title: { fontSize: 30, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 440, alignSelf: "center" } : {}),
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 20 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary, marginBottom: 6 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: "#FFFFFF",
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: { backgroundColor: "#C4B5FD", shadowOpacity: 0 },
  loginButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: COLORS.textSecondary },
  registerLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 440, alignSelf: "center" } : {}),
  },
  successBannerText: { color: COLORS.success, fontSize: 13, flex: 1, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: { color: COLORS.error, fontSize: 13, flex: 1, fontWeight: "500" },
});
