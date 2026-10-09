import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";

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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>

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
            <View style={styles.logoContainer}>
              <Ionicons name="book" size={40} color="white" />
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
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  headerContainer: { alignItems: "center", marginBottom: 40 },
  logoContainer: {
    width: 80, height: 80, backgroundColor: "#12B3C9",
    borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#1F2937", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#4B5563", textAlign: "center", paddingHorizontal: 20 },
  card: {
    backgroundColor: "white", borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 15, elevation: 3,
  },
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: "#1F2937", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 16, height: 50,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 14, color: "#1F2937" },
  loginButton: {
    backgroundColor: "#12B3C9", borderRadius: 12, height: 50,
    justifyContent: "center", alignItems: "center", marginTop: 10, marginBottom: 16,
  },
  loginButtonDisabled: { backgroundColor: "#93C5D4" },
  loginButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: "#6B7280" },
  registerLink: { fontSize: 14, color: "#12B3C9", fontWeight: "600" },
  successBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5",
    borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, gap: 8,
  },
  successBannerText: { color: "#059669", fontSize: 13, flex: 1, fontWeight: "500" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, gap: 8,
  },
  errorBannerText: { color: "#EF4444", fontSize: 13, flex: 1 },
});
