import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Animated,
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

export default function RegisterScreen() {
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inline error states per field
  const [nameError, setNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [termsError, setTermsError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const clearErrors = () => {
    setNameError("");
    setUsernameError("");
    setPasswordError("");
    setConfirmError("");
    setTermsError("");
    setGlobalError("");
  };

  const validate = () => {
    let valid = true;
    clearErrors();
    if (!name.trim()) { setNameError("Full name is required."); valid = false; }
    if (!username.trim()) { setUsernameError("Username is required."); valid = false; }
    if (!password.trim()) { setPasswordError("Password is required."); valid = false; }
    else if (password.length < 6) { setPasswordError("Password must be at least 6 characters."); valid = false; }
    if (password !== confirmPassword) { setConfirmError("Passwords do not match."); valid = false; }
    if (!agreedToTerms) { setTermsError("Please agree to the Terms of Service & Privacy Policy."); valid = false; }
    return valid;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.detail?.toLowerCase().includes("username")) {
          setUsernameError(data.detail || "Username already taken.");
        } else {
          setGlobalError(data.detail || "Could not create account.");
        }
        return;
      }

      // ✅ Success — redirect to login with success banner param
      router.replace(`/?registered=1&registeredName=${encodeURIComponent(data.user.name)}` as any);
    } catch {
      setGlobalError("Cannot reach the server. Make sure it is running.");
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
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Ionicons name="person-add" size={36} color="white" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join BrightPath and start learning today</Text>
          </View>

          {/* Global error banner */}
          {globalError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>{globalError}</Text>
            </View>
          ) : null}

          {/* Register Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign Up</Text>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputContainer, nameError ? styles.inputError : null]}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(""); }}
                />
              </View>
              {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={[styles.inputContainer, usernameError ? styles.inputError : null]}>
                <Ionicons name="at-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Choose a username"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={(t) => { setUsername(t); setUsernameError(""); }}
                />
              </View>
              {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Create a password (min 6 chars)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordError(""); }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[
                styles.inputContainer,
                confirmError ? styles.inputError :
                  confirmPassword.length > 0 ? (confirmPassword === password ? styles.inputSuccess : styles.inputError) : null
              ]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repeat your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setConfirmError(""); }}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={confirmPassword === password ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={confirmPassword === password ? "#10B981" : "#EF4444"}
                  />
                )}
              </View>
              {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
            </View>

            {/* Terms & Privacy Consent Checkbox */}
            <View style={{ marginVertical: 12 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
                activeOpacity={0.8}
                onPress={() => { setAgreedToTerms(!agreedToTerms); setTermsError(""); }}
              >
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: agreedToTerms ? '#7C3AED' : '#94A3B8',
                  backgroundColor: agreedToTerms ? '#7C3AED' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2
                }}>
                  {agreedToTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: '#475569', lineHeight: 20 }}>
                  I agree to the{' '}
                  <Text
                    style={{ color: '#7C3AED', fontWeight: '700', textDecorationLine: 'underline' }}
                    onPress={() => router.push('/legal?tab=terms' as any)}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={{ color: '#7C3AED', fontWeight: '700', textDecorationLine: 'underline' }}
                    onPress={() => router.push('/legal?tab=privacy' as any)}
                  >
                    Privacy Policy
                  </Text>.
                </Text>
              </TouchableOpacity>
              {termsError ? <Text style={styles.fieldError}>{termsError}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.registerButton, (!agreedToTerms || loading) && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={!agreedToTerms || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    ...(Platform.OS === "web" ? { alignItems: "center" } : {}),
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 24,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 460, alignSelf: "center" } : {}),
  },
  logoContainer: {
    width: 80, height: 80, backgroundColor: "#FF8A65",
    borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#1F2937", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#4B5563", textAlign: "center", paddingHorizontal: 20 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, gap: 8,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 460, alignSelf: "center" } : {}),
  },
  errorBannerText: { color: "#EF4444", fontSize: 13, flex: 1 },
  card: {
    backgroundColor: "white", borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 15, elevation: 3,
    ...(Platform.OS === "web" ? { width: "100%", maxWidth: 460, alignSelf: "center" } : {}),
  },
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, color: "#1F2937", marginBottom: 6 },
  inputContainer: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 16, height: 50,
  },
  inputError: { borderColor: "#EF4444" },
  inputSuccess: { borderColor: "#10B981" },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  fieldError: { color: "#EF4444", fontSize: 12, marginTop: 4, marginLeft: 4 },
  registerButton: {
    backgroundColor: "#FF8A65", borderRadius: 12, height: 50,
    justifyContent: "center", alignItems: "center", marginTop: 8, marginBottom: 16,
  },
  registerButtonDisabled: { backgroundColor: "#FDBA8C" },
  registerButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { fontSize: 14, color: "#6B7280" },
  loginLink: { fontSize: 14, color: "#7C3AED", fontWeight: "700" },
});
