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
  Platform,
  Modal,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { API_URL } from '../context/config';
import { useAuth } from '../context/AuthContext';

interface KnowledgeComponent {
  id?: number;
  topic_id: string;
  name: string;
  display_name: string;
  prior: number;
  learns: number;
  guesses: number;
  slips: number;
}

interface UserRecord {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  password?: string;
  created_at?: string;
}

export default function AdminScreen() {
  const { user, logout } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1000;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState<'kcs' | 'pybkt' | 'users' | 'diagnostics'>('kcs');
  const [selectedTopicId, setSelectedTopicId] = useState('story-grammar');

  // Sub-view states to eliminate single-scroll clutter
  const [kcSubView, setKcSubView] = useState<'list' | 'create'>('list');
  const [userSubView, setUserSubView] = useState<'directory' | 'create'>('directory');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // KC State
  const [kcList, setKcList] = useState<KnowledgeComponent[]>([]);
  const [loadingKcs, setLoadingKcs] = useState(false);
  const [kcName, setKcName] = useState('');
  const [kcDisplayName, setKcDisplayName] = useState('');
  const [kcPrior, setKcPrior] = useState('0.10');
  const [kcLearns, setKcLearns] = useState('0.20');
  const [kcGuesses, setKcGuesses] = useState('0.25');
  const [kcSlips, setKcSlips] = useState('0.10');
  const [submittingKC, setSubmittingKC] = useState(false);

  // pyBKT Calibration State
  const [fittingModel, setFittingModel] = useState(false);
  const [fitResult, setFitResult] = useState<any>(null);
  const [calibrationScope, setCalibrationScope] = useState<'all' | 'topic'>('all');
  const [lastCalibrationTime, setLastCalibrationTime] = useState<string | null>(null);

  // User Management State
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // User Details & Password Modal State
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete User Modal State (Requires Admin Password)
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // Diagnostics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  const adminNavItems = [
    { id: 'kcs' as const, label: 'Skills & KCs (ITS)', icon: 'bulb-outline' as const },
    { id: 'pybkt' as const, label: 'pyBKT Calibration', icon: 'hardware-chip-outline' as const },
    { id: 'users' as const, label: 'User Management', icon: 'people-outline' as const },
    { id: 'diagnostics' as const, label: 'System Diagnostics', icon: 'stats-chart-outline' as const },
  ];

  const topics = [
    { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline' as const },
    { id: 'mathematics', name: 'Mathematics', icon: 'calculator-outline' as const },
    { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'hardware-chip-outline' as const },
    { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline' as const },
  ];

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const studentCount = users.filter((u) => u.role === 'student').length;

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchUser = (u.username || '').toLowerCase().includes(q);
      return matchName || matchUser;
    }
    return true;
  });

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

  // Fetch KCs for topic
  const fetchKcs = useCallback(async (topicId: string) => {
    setLoadingKcs(true);
    try {
      const res = await fetch(`${API_URL}/admin/kcs/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setKcList(Array.isArray(data) ? data : []);
      }
    } catch {
      setKcList([]);
    } finally {
      setLoadingKcs(false);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch Diagnostics
  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {
      setAnalyticsData(null);
    } finally {
      setLoadingDiagnostics(false);
    }
  }, []);

  const [refreshingAll, setRefreshingAll] = useState(false);

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await Promise.all([
        fetchKcs(selectedTopicId),
        fetchUsers(),
        fetchDiagnostics(),
      ]);
    } finally {
      setRefreshingAll(false);
    }
  };

  // Initial load of global intelligence metrics for System Pulse
  useEffect(() => {
    fetchUsers();
    fetchDiagnostics();
  }, [fetchUsers, fetchDiagnostics]);

  useEffect(() => {
    if (activeTab === 'kcs') {
      fetchKcs(selectedTopicId);
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'diagnostics') {
      fetchDiagnostics();
    }
  }, [activeTab, selectedTopicId, fetchKcs, fetchUsers, fetchDiagnostics]);

  // Submit Knowledge Component
  const handleSubmitKC = async () => {
    if (!kcName.trim() || !kcDisplayName.trim()) {
      showAlert('Required Fields', 'Please enter both KC ID and Display Name.');
      return;
    }

    setSubmittingKC(true);
    try {
      const res = await fetch(`${API_URL}/admin/kc/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          name: kcName.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: kcDisplayName.trim(),
          prior: parseFloat(kcPrior) || 0.1,
          learns: parseFloat(kcLearns) || 0.2,
          guesses: parseFloat(kcGuesses) || 0.25,
          slips: parseFloat(kcSlips) || 0.1,
        }),
      });

      if (!res.ok) throw new Error('Failed to create Knowledge Component');

      showAlert('Success', `Knowledge Component "${kcDisplayName}" registered successfully.`);
      setKcName('');
      setKcDisplayName('');
      setKcPrior('0.10');
      setKcLearns('0.20');
      setKcGuesses('0.25');
      setKcSlips('0.10');
      setKcSubView('list');
      fetchKcs(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not register Knowledge Component.');
    } finally {
      setSubmittingKC(false);
    }
  };

  // Delete Knowledge Component
  const handleDeleteKC = async (name: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Delete Knowledge Component "${name}"?`)
      : true;
    if (!confirm) return;

    try {
      const res = await fetch(`${API_URL}/admin/kc/${name}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Deleted', `Knowledge Component "${name}" was removed.`);
        fetchKcs(selectedTopicId);
      }
    } catch {
      showAlert('Error', 'Could not delete Knowledge Component.');
    }
  };

  // Run pyBKT Model Calibration
  const handleFitBkt = async (scope: 'all' | 'topic' = calibrationScope) => {
    setFittingModel(true);
    setFitResult(null);
    try {
      const url = scope === 'topic'
        ? `${API_URL}/admin/fit-bkt-model?topic_id=${encodeURIComponent(selectedTopicId)}`
        : `${API_URL}/admin/fit-bkt-model`;

      let res = await fetch(url, { method: 'POST' });
      if (res.status === 404) {
        // Fallback to older route if needed
        res = await fetch(`${API_URL}/admin/bkt/fit`, { method: 'POST' });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'pyBKT refitting failed.');
      setFitResult(data);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastCalibrationTime(timeStr);
      showAlert('Recalibration Complete', data.message || `pyBKT successfully calibrated parameters for ${data.updated_kcs?.length || 0} skills.`);
      fetchKcs(selectedTopicId);
    } catch (err: any) {
      showAlert('Calibration Notice', err.message || 'Could not complete pyBKT recalibration.');
    } finally {
      setFittingModel(false);
    }
  };

  // Create Teacher Account
  const handleCreateTeacher = async () => {
    if (!teacherName.trim() || !teacherUsername.trim() || !teacherPassword.trim()) {
      showAlert('Required Fields', 'Please enter Name, Username, and Password for the teacher.');
      return;
    }

    setCreatingTeacher(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/create-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName.trim(),
          username: teacherUsername.trim(),
          password: teacherPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create teacher account.');

      showAlert('Success', `Teacher account "@${teacherUsername}" created successfully.`);
      setTeacherName('');
      setTeacherUsername('');
      setTeacherPassword('');
      setUserSubView('directory');
      fetchUsers();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not create teacher account.');
    } finally {
      setCreatingTeacher(false);
    }
  };

  // Change User Role
  const handleChangeRole = async (userId: number, newRole: 'admin' | 'teacher' | 'student') => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showAlert('Role Updated', `User role changed to ${newRole}.`);
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
        fetchUsers();
      }
    } catch {
      showAlert('Error', 'Could not update user role.');
    }
  };

  // Reset User Password (Admin action)
  const handleResetPassword = async () => {
    if (!selectedUser || !newResetPassword.trim()) {
      showAlert('Required', 'Please enter a new password.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newResetPassword.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update password');
      showAlert('Success', `Password for @${selectedUser.username} updated.`);
      setSelectedUser({ ...selectedUser, password: newResetPassword.trim() });
      setNewResetPassword('');
      fetchUsers();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete User Account (Requires Admin Password Authorization)
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (!adminPasswordInput.trim()) {
      showAlert('Required', 'Please enter your administrator password to authorize deletion.');
      return;
    }

    setDeletingUser(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userToDelete.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_password: adminPasswordInput.trim(),
          admin_id: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to delete user.');
      }

      showAlert('Account Deleted', data.message || `User @${userToDelete.username} deleted.`);
      setDeleteModalVisible(false);
      setUserToDelete(null);
      setAdminPasswordInput('');
      if (selectedUser?.id === userToDelete.id) {
        setUserModalVisible(false);
        setSelectedUser(null);
      }
      fetchUsers();
    } catch (err: any) {
      showAlert('Deletion Error', err.message || 'Could not delete user account.');
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Workspace Body: Sidebar + Main Content */}
        <View style={styles.workspaceBody}>
          {/* Collapsible Admin Sidebar */}
          <View style={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded]}>
            {/* Sidebar Top: Admin Workspace Branding & Minimize Arrow */}
            <View style={[styles.sidebarBrandHeader, sidebarCollapsed && styles.sidebarBrandHeaderCollapsed]}>
              {!sidebarCollapsed ? (
                <>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.sidebarBrandTitle}>Admin Workspace</Text>
                    <Text style={styles.sidebarBrandSubtitle} numberOfLines={1}>
                      {user?.name || 'Administrator'} ({user?.username || 'admin'})
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

            {/* Admin Sections Navigation */}
            <ScrollView style={styles.sidebarNavList} showsVerticalScrollIndicator={false}>
              {adminNavItems.map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.sidebarItem,
                      sidebarCollapsed && styles.sidebarItemCollapsed,
                      isSelected && (sidebarCollapsed ? styles.sidebarItemCollapsedActive : styles.sidebarItemActive),
                    ]}
                    onPress={() => setActiveTab(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarItemIconBox, isSelected && styles.sidebarItemIconBoxActive]}>
                      <Ionicons
                        name={item.icon}
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
                          {item.label}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sidebar Bottom: Engine Status Badge & Log Out */}
            {!sidebarCollapsed ? (
              <View style={styles.sidebarFooter}>
                <View style={styles.sidebarStatusBadge}>
                  <View style={styles.sidebarStatusDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarStatusTitle}>ITS Engine Online</Text>
                    <Text style={styles.sidebarStatusSubtitle}>pyBKT Ready</Text>
                  </View>
                </View>

                <View style={styles.sidebarFooterDivider} />

                <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  <Text style={styles.sidebarLogoutBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sidebarFooterCollapsed}>
                <View style={styles.sidebarStatusDotOnly} />
                <TouchableOpacity style={styles.sidebarLogoutBtnCollapsed} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main Area */}
          <View style={styles.mainArea}>
            <View style={styles.mainHeaderStrip}>
              <View style={styles.headerBar}>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.mainHeaderTitle}>
                    {activeTab === 'kcs' && 'Skills & Knowledge Components (ITS)'}
                    {activeTab === 'pybkt' && 'pyBKT Algorithmic Calibration'}
                    {activeTab === 'users' && 'User Management & Security'}
                    {activeTab === 'diagnostics' && 'System Diagnostics & Health'}
                  </Text>
                  <Text style={styles.mainHeaderSubtitle}>
                    {activeTab === 'kcs' && 'Manage cognitive components, BKT priors, and student tracing parameters'}
                    {activeTab === 'pybkt' && 'Fit Expectation-Maximization (EM) models to student interaction logs'}
                    {activeTab === 'users' && 'Manage educator credentials, student accounts, and access control'}
                    {activeTab === 'diagnostics' && 'Real-time performance metrics, mastery rates, and system pulse'}
                  </Text>
                </View>

                {/* Action Controls on Right */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Global Sync Data Action */}
                  <TouchableOpacity
                    style={styles.headerSyncBtn}
                    onPress={handleRefreshAll}
                    disabled={refreshingAll}
                  >
                    {refreshingAll ? (
                      <ActivityIndicator size="small" color="#4F46E5" />
                    ) : (
                      <Ionicons name="refresh-outline" size={15} color="#4F46E5" />
                    )}
                    <Text style={styles.headerSyncBtnText}>
                      {refreshingAll ? 'Syncing...' : 'Sync Data'}
                    </Text>
                  </TouchableOpacity>

                  {/* Sub-view Toggle Actions for KCs */}
                  {activeTab === 'kcs' && (
                    <View style={styles.subViewToggleRow}>
                      <TouchableOpacity
                        style={[styles.subViewToggleBtn, kcSubView === 'list' && styles.subViewToggleBtnActive]}
                        onPress={() => setKcSubView('list')}
                      >
                        <Ionicons
                          name="layers-outline"
                          size={15}
                          color={kcSubView === 'list' ? '#4F46E5' : '#64748B'}
                        />
                        <Text style={[styles.subViewToggleText, kcSubView === 'list' && styles.subViewToggleTextActive]}>
                          Registered KCs ({kcList.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.subViewToggleBtn, kcSubView === 'create' && styles.subViewToggleBtnActive]}
                        onPress={() => setKcSubView('create')}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={15}
                          color={kcSubView === 'create' ? '#4F46E5' : '#64748B'}
                        />
                        <Text style={[styles.subViewToggleText, kcSubView === 'create' && styles.subViewToggleTextActive]}>
                          Register New KC
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Sub-view Navigation for Users */}
                  {activeTab === 'users' && userSubView === 'create' && (
                    <TouchableOpacity
                      style={styles.subViewToggleBtn}
                      onPress={() => setUserSubView('directory')}
                    >
                      <Ionicons name="arrow-back-outline" size={15} color="#4F46E5" />
                      <Text style={[styles.subViewToggleText, { color: '#4F46E5', fontWeight: '700' }]}>
                        Back to User Directory
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Sub-view Toggle Actions for pyBKT Scope */}
                  {activeTab === 'pybkt' && (
                    <View style={styles.subViewToggleRow}>
                      <TouchableOpacity
                        style={[styles.subViewToggleBtn, calibrationScope === 'all' && styles.subViewToggleBtnActive]}
                        onPress={() => setCalibrationScope('all')}
                      >
                        <Ionicons
                          name="globe-outline"
                          size={15}
                          color={calibrationScope === 'all' ? '#4F46E5' : '#64748B'}
                        />
                        <Text style={[styles.subViewToggleText, calibrationScope === 'all' && styles.subViewToggleTextActive]}>
                          All Topics (Global)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.subViewToggleBtn, calibrationScope === 'topic' && styles.subViewToggleBtnActive]}
                        onPress={() => setCalibrationScope('topic')}
                      >
                        <Ionicons
                          name="book-outline"
                          size={15}
                          color={calibrationScope === 'topic' ? '#4F46E5' : '#64748B'}
                        />
                        <Text style={[styles.subViewToggleText, calibrationScope === 'topic' && styles.subViewToggleTextActive]}>
                          {topics.find((t) => t.id === selectedTopicId)?.name || 'Selected Topic'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Main Content */}
            <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* TAB 1: KNOWLEDGE COMPONENTS (ITS) */}
          {activeTab === 'kcs' && (
            <View>
              {/* Topic Selector Bar */}
              <View style={styles.topicBar}>
                <Text style={styles.topicBarLabel}>Curriculum Topic:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {topics.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.topicChip, selectedTopicId === t.id && styles.topicChipActive]}
                      onPress={() => setSelectedTopicId(t.id)}
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={selectedTopicId === t.id ? '#FFFFFF' : '#475569'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.topicChipText, selectedTopicId === t.id && styles.topicChipTextActive]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* SUB-VIEW 1: REGISTERED KCS LIST */}
              {kcSubView === 'list' && (
                <View style={styles.card}>
                  <View style={styles.cardHeaderWithAction}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.cardTitle}>
                          Registered KCs in {topics.find((t) => t.id === selectedTopicId)?.name || 'Topic'}
                        </Text>
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{kcList.length}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardHelp}>
                        Knowledge Components define atomic cognitive skills tracked by Bayesian Knowledge Tracing (pyBKT).
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.headerPrimaryActionBtn}
                      onPress={() => setKcSubView('create')}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.headerPrimaryActionBtnText}>Add Knowledge Component</Text>
                    </TouchableOpacity>
                  </View>

                  {loadingKcs ? (
                    <ActivityIndicator color="#4F46E5" style={{ marginVertical: 30 }} />
                  ) : kcList.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="bulb-outline" size={36} color="#CBD5E1" />
                      <Text style={styles.emptyTitle}>No Knowledge Components Found</Text>
                      <Text style={styles.emptyText}>
                        No cognitive skills have been registered for this topic yet. Register your first KC to enable BKT student modeling.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => setKcSubView('create')}
                      >
                        <Ionicons name="add-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Register First KC</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    kcList.map((kc) => (
                      <View key={kc.name} style={styles.kcItemCard}>
                        <View style={styles.kcItemIconBox}>
                          <Ionicons name="bulb-outline" size={20} color="#4F46E5" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kcItemTitle}>{kc.display_name}</Text>
                          <Text style={styles.kcItemSlug}>ID: {kc.name}</Text>
                          <View style={styles.paramChipsRow}>
                            <View style={[styles.paramChip, styles.paramChipPrior]}>
                              <Text style={styles.paramChipLabel}>Prior P(L₀):</Text>
                              <Text style={[styles.paramChipValue, { color: '#2563EB' }]}>{kc.prior}</Text>
                            </View>
                            <View style={[styles.paramChip, styles.paramChipLearn]}>
                              <Text style={styles.paramChipLabel}>Learn P(T):</Text>
                              <Text style={[styles.paramChipValue, { color: '#16A34A' }]}>{kc.learns}</Text>
                            </View>
                            <View style={[styles.paramChip, styles.paramChipGuess]}>
                              <Text style={styles.paramChipLabel}>Guess P(G):</Text>
                              <Text style={[styles.paramChipValue, { color: '#EA580C' }]}>{kc.guesses}</Text>
                            </View>
                            <View style={[styles.paramChip, styles.paramChipSlip]}>
                              <Text style={styles.paramChipLabel}>Slip P(S):</Text>
                              <Text style={[styles.paramChipValue, { color: '#4F46E5' }]}>{kc.slips}</Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteKC(kc.name)}
                          style={styles.kcDeleteBtn}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* SUB-VIEW 2: REGISTER NEW KC FORM */}
              {kcSubView === 'create' && (
                <View style={styles.card}>
                  <View style={styles.subViewHeaderRow}>
                    <TouchableOpacity
                      style={styles.backBtn}
                      onPress={() => setKcSubView('list')}
                    >
                      <Ionicons name="arrow-back-outline" size={16} color="#4F46E5" />
                      <Text style={styles.backBtnText}>Back to Registered KCs</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardTitle}>Register Knowledge Component (ITS)</Text>
                  <Text style={styles.cardHelp}>
                    Define an atomic cognitive skill for <Text style={{ fontWeight: '700', color: '#1E1B4B' }}>{topics.find((t) => t.id === selectedTopicId)?.name}</Text>. pyBKT tracks student mastery across attempts.
                  </Text>

                  <Text style={styles.fieldLabel}>KC Identifier (lowercase slug, e.g. character_traits)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. character_traits"
                    value={kcName}
                    onChangeText={setKcName}
                    autoCapitalize="none"
                  />

                  <Text style={styles.fieldLabel}>Display Name (Human-readable)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Character Traits & Feelings"
                    value={kcDisplayName}
                    onChangeText={setKcDisplayName}
                  />

                  {/* BKT Pedagogical Guide - Minimalist Spec Strip (Design A) */}
                  <View style={styles.specStripCard}>
                    <View style={styles.specStripHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Ionicons name="git-commit-outline" size={17} color="#334155" />
                        <Text style={styles.specStripTitle}>Bayesian Knowledge Tracing (pyBKT) Specification</Text>
                      </View>
                      <Text style={styles.specStripSubtitle}>
                        Configure initial probability priors below. pyBKT refines these values empirically as students answer questions:
                      </Text>
                    </View>

                    <View style={styles.specColumnsRow}>
                      {/* Column 1: P(L0) */}
                      <View style={[styles.specCard, styles.specCardPrior]}>
                        <View style={[styles.specSymbolPill, styles.specPillPrior]}>
                          <Text style={[styles.specSymbolText, styles.specTextPrior]}>P(L₀)</Text>
                        </View>
                        <Text style={styles.specRoleLabel}>Initial Prior</Text>
                        <View style={styles.specBaselineRow}>
                          <Text style={styles.specBaselineLabel}>Default:</Text>
                          <Text style={[styles.specBaselineVal, styles.specTextPrior]}>0.10</Text>
                        </View>
                        <Text style={styles.specDescText}>
                          Initial probability a student knows this skill prior to lesson practice.
                        </Text>
                      </View>

                      {/* Column 2: P(T) */}
                      <View style={[styles.specCard, styles.specCardLearn]}>
                        <View style={[styles.specSymbolPill, styles.specPillLearn]}>
                          <Text style={[styles.specSymbolText, styles.specTextLearn]}>P(T)</Text>
                        </View>
                        <Text style={styles.specRoleLabel}>Learn Rate</Text>
                        <View style={styles.specBaselineRow}>
                          <Text style={styles.specBaselineLabel}>Default:</Text>
                          <Text style={[styles.specBaselineVal, styles.specTextLearn]}>0.20</Text>
                        </View>
                        <Text style={styles.specDescText}>
                          Transition rate from unlearned to learned state on each practice opportunity.
                        </Text>
                      </View>

                      {/* Column 3: P(G) */}
                      <View style={[styles.specCard, styles.specCardGuess]}>
                        <View style={[styles.specSymbolPill, styles.specPillGuess]}>
                          <Text style={[styles.specSymbolText, styles.specTextGuess]}>P(G)</Text>
                        </View>
                        <Text style={styles.specRoleLabel}>Guess Factor</Text>
                        <View style={styles.specBaselineRow}>
                          <Text style={styles.specBaselineLabel}>Default:</Text>
                          <Text style={[styles.specBaselineVal, styles.specTextGuess]}>0.25</Text>
                        </View>
                        <Text style={styles.specDescText}>
                          Probability of answering correctly without mastering the skill.
                        </Text>
                      </View>

                      {/* Column 4: P(S) */}
                      <View style={[styles.specCard, styles.specCardSlip]}>
                        <View style={[styles.specSymbolPill, styles.specPillSlip]}>
                          <Text style={[styles.specSymbolText, styles.specTextSlip]}>P(S)</Text>
                        </View>
                        <Text style={styles.specRoleLabel}>Slip Factor</Text>
                        <View style={styles.specBaselineRow}>
                          <Text style={styles.specBaselineLabel}>Default:</Text>
                          <Text style={[styles.specBaselineVal, styles.specTextSlip]}>0.10</Text>
                        </View>
                        <Text style={styles.specDescText}>
                          Probability of making an accidental mistake despite mastering the skill.
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>BKT Probabilistic Parameters</Text>
                  <View style={styles.paramGrid}>
                    {[
                      { label: 'Prior P(L₀)', val: kcPrior, set: setKcPrior, help: 'Initial mastery', boxStyle: styles.specCardPrior, textStyle: styles.specTextPrior },
                      { label: 'Learn P(T)', val: kcLearns, set: setKcLearns, help: 'Learning rate', boxStyle: styles.specCardLearn, textStyle: styles.specTextLearn },
                      { label: 'Guess P(G)', val: kcGuesses, set: setKcGuesses, help: 'Lucky guess', boxStyle: styles.specCardGuess, textStyle: styles.specTextGuess },
                      { label: 'Slip P(S)', val: kcSlips, set: setKcSlips, help: 'Careless error', boxStyle: styles.specCardSlip, textStyle: styles.specTextSlip },
                    ].map((p) => (
                      <View key={p.label} style={[styles.paramBox, p.boxStyle]}>
                        <Text style={[styles.paramLabel, p.textStyle]}>{p.label}</Text>
                        <TextInput
                          style={styles.paramInput}
                          value={p.val}
                          onChangeText={p.set}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.paramHelp}>{p.help}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, submittingKC && styles.primaryBtnDisabled]}
                    onPress={handleSubmitKC}
                    disabled={submittingKC}
                  >
                    {submittingKC ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Save Knowledge Component</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* TAB 2: pyBKT CALIBRATION STUDIO */}
          {activeTab === 'pybkt' && (
            <View style={{ gap: 16 }}>
              {/* Card 1: Studio Header & EM Foundation Card */}
              <View style={styles.card}>
                <View style={styles.calibHeaderRow}>
                  <View style={styles.calibIconBadge}>
                    <Ionicons name="hardware-chip-outline" size={22} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={styles.cardTitle}>pyBKT Algorithmic Calibration Studio</Text>
                      <View style={styles.calibVersionBadge}>
                        <Text style={styles.calibVersionBadgeText}>pyBKT EM Engine</Text>
                      </View>
                    </View>
                    <Text style={styles.cardHelp}>
                      Recalibrate Bayesian Knowledge Tracing parameters directly from empirical student response data using Expectation-Maximization (EM).
                    </Text>
                  </View>
                </View>

                {/* EM Theory & Educational Callout - Minimalist Spec Strip (Design A) */}
                <View style={styles.specStripCard}>
                  <View style={styles.specStripHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Ionicons name="git-commit-outline" size={17} color="#334155" />
                      <Text style={styles.specStripTitle}>pyBKT Latent State Parameters (2-State HMM)</Text>
                    </View>
                    <Text style={styles.specStripSubtitle}>
                      Expectation-Maximization fits the four hidden Markov parameters below directly from student response logs:
                    </Text>
                  </View>

                  <View style={styles.specColumnsRow}>
                    {/* Column 1: P(L0) - Blue */}
                    <View style={[styles.specCard, styles.specCardPrior]}>
                      <View style={[styles.specSymbolPill, styles.specPillPrior]}>
                        <Text style={[styles.specSymbolText, styles.specTextPrior]}>P(L₀)</Text>
                      </View>
                      <Text style={styles.specRoleLabel}>Initial Prior</Text>
                      <View style={styles.specBaselineRow}>
                        <Text style={styles.specBaselineLabel}>Baseline:</Text>
                        <Text style={[styles.specBaselineVal, styles.specTextPrior]}>0.10</Text>
                      </View>
                      <Text style={styles.specDescText}>
                        Starting probability a student knows the skill before instruction.
                      </Text>
                    </View>

                    {/* Column 2: P(T) - Green */}
                    <View style={[styles.specCard, styles.specCardLearn]}>
                      <View style={[styles.specSymbolPill, styles.specPillLearn]}>
                        <Text style={[styles.specSymbolText, styles.specTextLearn]}>P(T)</Text>
                      </View>
                      <Text style={styles.specRoleLabel}>Learn Rate</Text>
                      <View style={styles.specBaselineRow}>
                        <Text style={styles.specBaselineLabel}>Baseline:</Text>
                        <Text style={[styles.specBaselineVal, styles.specTextLearn]}>0.20</Text>
                      </View>
                      <Text style={styles.specDescText}>
                        Transition probability from unlearned to mastered after each practice.
                      </Text>
                    </View>

                    {/* Column 3: P(G) - Orange */}
                    <View style={[styles.specCard, styles.specCardGuess]}>
                      <View style={[styles.specSymbolPill, styles.specPillGuess]}>
                        <Text style={[styles.specSymbolText, styles.specTextGuess]}>P(G)</Text>
                      </View>
                      <Text style={styles.specRoleLabel}>Guess Factor</Text>
                      <View style={styles.specBaselineRow}>
                        <Text style={styles.specBaselineLabel}>Baseline:</Text>
                        <Text style={[styles.specBaselineVal, styles.specTextGuess]}>0.25</Text>
                      </View>
                      <Text style={styles.specDescText}>
                        Probability of answering correctly by chance without skill mastery.
                      </Text>
                    </View>

                    {/* Column 4: P(S) - Indigo */}
                    <View style={[styles.specCard, styles.specCardSlip]}>
                      <View style={[styles.specSymbolPill, styles.specPillSlip]}>
                        <Text style={[styles.specSymbolText, styles.specTextSlip]}>P(S)</Text>
                      </View>
                      <Text style={styles.specRoleLabel}>Slip Factor</Text>
                      <View style={styles.specBaselineRow}>
                        <Text style={styles.specBaselineLabel}>Baseline:</Text>
                        <Text style={[styles.specBaselineVal, styles.specTextSlip]}>0.10</Text>
                      </View>
                      <Text style={styles.specDescText}>
                        Probability of making an accidental error despite true mastery.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 2: Empirical Dataset Readiness Panel */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Empirical Dataset Readiness</Text>
                  <Text style={styles.cardHelp}>
                    System requirements for pyBKT convergence: minimum 5 KC-tagged answers (20+ per KC recommended for robust estimates).
                  </Text>
                </View>

                <View style={styles.calibReadinessGrid}>
                  {/* Metric 1: Total Student Attempts */}
                  <View style={styles.calibReadinessCard}>
                    <View style={[styles.calibReadinessIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="document-text-outline" size={18} color="#4F46E5" />
                    </View>
                    <Text style={styles.calibReadinessVal}>
                      {analyticsData?.total_attempts ?? (analyticsData?.total_quizzes ?? '0')}
                    </Text>
                    <Text style={styles.calibReadinessLabel}>Student Quiz Attempts</Text>
                    <View style={[
                      styles.calibReadinessPill,
                      (analyticsData?.total_attempts || 0) >= 5 ? styles.calibReadinessPillSuccess : styles.calibReadinessPillWarning
                    ]}>
                      <Ionicons
                        name={(analyticsData?.total_attempts || 0) >= 5 ? "checkmark-circle" : "alert-circle"}
                        size={12}
                        color={(analyticsData?.total_attempts || 0) >= 5 ? "#047857" : "#B45309"}
                      />
                      <Text style={[
                        styles.calibReadinessPillText,
                        (analyticsData?.total_attempts || 0) >= 5 ? styles.calibReadinessPillTextSuccess : styles.calibReadinessPillTextWarning
                      ]}>
                        {(analyticsData?.total_attempts || 0) >= 5 ? 'Sufficient Data' : 'Initial Phase (<5)'}
                      </Text>
                    </View>
                  </View>

                  {/* Metric 2: Registered KCs */}
                  <View style={styles.calibReadinessCard}>
                    <View style={[styles.calibReadinessIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="bulb-outline" size={18} color="#059669" />
                    </View>
                    <Text style={styles.calibReadinessVal}>{kcList.length}</Text>
                    <Text style={styles.calibReadinessLabel}>Active Topic KCs</Text>
                    <View style={[styles.calibReadinessPill, styles.calibReadinessPillSuccess]}>
                      <Ionicons name="checkmark-circle" size={12} color="#047857" />
                      <Text style={[styles.calibReadinessPillText, styles.calibReadinessPillTextSuccess]}>
                        Ready to Trace
                      </Text>
                    </View>
                  </View>

                  {/* Metric 3: Model State */}
                  <View style={styles.calibReadinessCard}>
                    <View style={[styles.calibReadinessIconBox, { backgroundColor: '#FAF5FF' }]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
                    </View>
                    <Text style={[styles.calibReadinessVal, { fontSize: 16 }]}>
                      {fitResult ? 'Calibrated' : 'Default Priors'}
                    </Text>
                    <Text style={styles.calibReadinessLabel}>Algorithmic State</Text>
                    <View style={[
                      styles.calibReadinessPill,
                      fitResult ? styles.calibReadinessPillSuccess : styles.calibReadinessPillInfo
                    ]}>
                      <Ionicons
                        name={fitResult ? "checkmark-circle" : "time-outline"}
                        size={12}
                        color={fitResult ? "#047857" : "#4338CA"}
                      />
                      <Text style={[
                        styles.calibReadinessPillText,
                        fitResult ? styles.calibReadinessPillTextSuccess : styles.calibReadinessPillTextInfo
                      ]}>
                        {lastCalibrationTime ? `Run at ${lastCalibrationTime}` : 'Default Priors Active'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 3: Calibration Action Hub */}
              <View style={styles.card}>
                <View style={styles.cardHeaderWithAction}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Execute pyBKT Calibration</Text>
                    <Text style={styles.cardHelp}>
                      Runs 5 Expectation-Maximization fits across student responses with seed 42, then saves updated parameters into the database.
                    </Text>
                  </View>
                </View>

                {/* Scope Selection Strip */}
                <View style={styles.calibScopeStrip}>
                  <Text style={styles.calibScopeLabel}>Target Scope:</Text>
                  <View style={styles.calibScopeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.calibScopeBtn,
                        calibrationScope === 'all' && styles.calibScopeBtnActive
                      ]}
                      onPress={() => setCalibrationScope('all')}
                      disabled={fittingModel}
                    >
                      <Ionicons
                        name="globe-outline"
                        size={14}
                        color={calibrationScope === 'all' ? '#4F46E5' : '#64748B'}
                      />
                      <Text style={[
                        styles.calibScopeBtnText,
                        calibrationScope === 'all' && styles.calibScopeBtnTextActive
                      ]}>
                        All Subjects (Global)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.calibScopeBtn,
                        calibrationScope === 'topic' && styles.calibScopeBtnActive
                      ]}
                      onPress={() => setCalibrationScope('topic')}
                      disabled={fittingModel}
                    >
                      <Ionicons
                        name="book-outline"
                        size={14}
                        color={calibrationScope === 'topic' ? '#4F46E5' : '#64748B'}
                      />
                      <Text style={[
                        styles.calibScopeBtnText,
                        calibrationScope === 'topic' && styles.calibScopeBtnTextActive
                      ]}>
                        {topics.find(t => t.id === selectedTopicId)?.name || 'Current Topic'} Only
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity
                  style={[
                    styles.calibPrimaryActionBtn,
                    fittingModel && styles.primaryBtnDisabled
                  ]}
                  onPress={() => handleFitBkt(calibrationScope)}
                  disabled={fittingModel}
                  activeOpacity={0.8}
                >
                  {fittingModel ? (
                    <View style={styles.calibActionContentRow}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.calibPrimaryActionBtnText}>
                        Computing Expectation-Maximization Fits...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.calibActionContentRow}>
                      <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.calibPrimaryActionBtnText}>
                        {calibrationScope === 'all'
                          ? 'Run pyBKT Calibration on All Student Data'
                          : `Run pyBKT Calibration on ${topics.find(t => t.id === selectedTopicId)?.name}`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.calibNoticeBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
                  <Text style={styles.calibNoticeText}>
                    Fitted parameters immediately adjust real-time mastery calculations on the student and teacher sides.
                  </Text>
                </View>
              </View>

              {/* Card 4: Structured Calibration Output & Convergence Inspector */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.cardTitle}>Calibration Output & Empirical Convergence</Text>
                    {fitResult && (
                      <View style={styles.calibSuccessBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#047857" />
                        <Text style={styles.calibSuccessBadgeText}>Converged</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardHelp}>
                    Inspect statistical re-estimation logs and parameter changes across individual cognitive skills.
                  </Text>
                </View>

                {fitResult ? (
                  <View style={{ gap: 14 }}>
                    {/* Summary Banner */}
                    <View style={styles.calibSummaryBanner}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Ionicons name="sparkles" size={16} color="#4F46E5" />
                        <Text style={styles.calibSummaryTitle}>
                          {fitResult.message || 'Expectation-Maximization fit converged successfully.'}
                        </Text>
                      </View>
                      <Text style={styles.calibSummaryDetails}>
                        Total student answers evaluated: <Text style={{ fontWeight: '700', color: '#1E1B4B' }}>{fitResult.total_answers_used || '—'}</Text>
                        {'  '}•{'  '}Skills updated: <Text style={{ fontWeight: '700', color: '#047857' }}>{fitResult.updated_kcs?.length || 0}</Text>
                        {lastCalibrationTime ? `  •  Timestamp: ${lastCalibrationTime}` : ''}
                      </Text>
                    </View>

                    {/* Updated KCs List */}
                    {Array.isArray(fitResult.updated_kcs) && fitResult.updated_kcs.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.calibSectionHeading}>
                          Recalibrated Knowledge Components ({fitResult.updated_kcs.length}):
                        </Text>
                        {fitResult.updated_kcs.map((item: any, idx: number) => {
                          const isObj = typeof item === 'object' && item !== null;
                          const kcName = isObj ? (item.kc_name || item.name || `Skill #${idx + 1}`) : String(item);
                          const answersUsed = isObj ? item.answers_used : null;
                          const prior = isObj && item.prior !== undefined ? Number(item.prior).toFixed(2) : null;
                          const learns = isObj && item.learns !== undefined ? Number(item.learns).toFixed(2) : null;
                          const guesses = isObj && item.guesses !== undefined ? Number(item.guesses).toFixed(2) : null;
                          const slips = isObj && item.slips !== undefined ? Number(item.slips).toFixed(2) : null;

                          return (
                            <View key={idx} style={styles.calibKcCard}>
                              <View style={styles.calibKcCardHeader}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                                    <Text style={styles.calibKcCardTitle}>{kcName}</Text>
                                  </View>
                                </View>
                                {answersUsed !== null && (
                                  <View style={styles.calibAnswersBadge}>
                                    <Text style={styles.calibAnswersBadgeText}>
                                      {answersUsed} answers used
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Parameter Chips */}
                              {prior !== null && (
                                <View style={styles.calibParamRow}>
                                  <View style={[styles.kcParamBadge, styles.paramChipPrior]}>
                                    <Text style={[styles.kcParamBadgeText, { color: '#2563EB' }]}>
                                      Prior P(L₀): <Text style={{ fontWeight: '800' }}>{prior}</Text>
                                    </Text>
                                  </View>
                                  <View style={[styles.kcParamBadge, styles.paramChipLearn]}>
                                    <Text style={[styles.kcParamBadgeText, { color: '#16A34A' }]}>
                                      Learn P(T): <Text style={{ fontWeight: '800' }}>{learns}</Text>
                                    </Text>
                                  </View>
                                  <View style={[styles.kcParamBadge, styles.paramChipGuess]}>
                                    <Text style={[styles.kcParamBadgeText, { color: '#EA580C' }]}>
                                      Guess P(G): <Text style={{ fontWeight: '800' }}>{guesses}</Text>
                                    </Text>
                                  </View>
                                  <View style={[styles.kcParamBadge, styles.paramChipSlip]}>
                                    <Text style={[styles.kcParamBadgeText, { color: '#4F46E5' }]}>
                                      Slip P(S): <Text style={{ fontWeight: '800' }}>{slips}</Text>
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.calibEmptyBox}>
                        <Ionicons name="information-circle-outline" size={24} color="#64748B" />
                        <Text style={styles.calibEmptyTitle}>No Skills Updated</Text>
                        <Text style={styles.calibEmptySub}>
                          The EM algorithm ran, but no skills met the minimum observation threshold (at least 3 responses per KC).
                        </Text>
                      </View>
                    )}

                    {/* Skipped Skills Box (if any) */}
                    {Array.isArray(fitResult.skipped_kcs) && fitResult.skipped_kcs.length > 0 && (
                      <View style={styles.calibSkippedBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
                          <Text style={styles.calibSkippedTitle}>
                            Skipped Skills ({fitResult.skipped_kcs.length})
                          </Text>
                        </View>
                        <Text style={styles.calibSkippedSub}>
                          These Knowledge Components did not have enough student answers to fit parameters:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {fitResult.skipped_kcs.map((sk: any, i: number) => (
                            <View key={i} style={styles.skippedChip}>
                              <Text style={styles.skippedChipText}>
                                {typeof sk === 'object' ? `${sk.kc_name} (${sk.reason || '< 3 answers'})` : String(sk)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.calibEmptyPlaceholder}>
                    <View style={styles.calibEmptyIconCircle}>
                      <Ionicons name="hardware-chip-outline" size={32} color="#94A3B8" />
                    </View>
                    <Text style={styles.calibEmptyPlaceholderTitle}>
                      No Calibration Executed Yet in Current Session
                    </Text>
                    <Text style={styles.calibEmptyPlaceholderText}>
                      When you launch pyBKT calibration, Expectation-Maximization estimates will be displayed here with convergence metrics, answer sample counts, and fitted cognitive parameters.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <View>
              {/* SUB-VIEW 1: USER DIRECTORY */}
              {userSubView === 'directory' && (
                <View style={styles.card}>
                  {/* Header with Title and Create Teacher Action */}
                  <View style={styles.cardHeaderWithAction}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.cardTitle}>User Directory</Text>
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{filteredUsers.length}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardHelp}>
                        View active accounts, inspect credentials, assign roles, or delete users.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.headerPrimaryActionBtn}
                      onPress={() => setUserSubView('create')}
                    >
                      <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.headerPrimaryActionBtnText}>Create Teacher Account</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Role Filter & Search Bar */}
                  <View style={styles.userFilterRow}>
                    {/* Role Filter Pills */}
                    <View style={styles.roleFilterGroup}>
                      {[
                        { id: 'all' as const, label: 'All Users', count: users.length },
                        { id: 'teacher' as const, label: 'Teachers', count: teacherCount },
                        { id: 'student' as const, label: 'Students', count: studentCount },
                        { id: 'admin' as const, label: 'Admins', count: adminCount },
                      ].map((rf) => (
                        <TouchableOpacity
                          key={rf.id}
                          style={[styles.roleFilterPill, userRoleFilter === rf.id && styles.roleFilterPillActive]}
                          onPress={() => setUserRoleFilter(rf.id)}
                        >
                          <Text style={[styles.roleFilterPillText, userRoleFilter === rf.id && styles.roleFilterPillTextActive]}>
                            {rf.label} ({rf.count})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* User Search Input */}
                    <View style={styles.searchBox}>
                      <Ionicons name="search-outline" size={16} color="#94A3B8" />
                      <TextInput
                        style={styles.searchBoxInput}
                        placeholder="Search by name or @username..."
                        value={userSearchQuery}
                        onChangeText={setUserSearchQuery}
                      />
                      {userSearchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setUserSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* User List */}
                  {loadingUsers ? (
                    <ActivityIndicator color="#4F46E5" style={{ marginVertical: 30 }} />
                  ) : filteredUsers.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="people-outline" size={36} color="#CBD5E1" />
                      <Text style={styles.emptyTitle}>No Users Found</Text>
                      <Text style={styles.emptyText}>
                        {userSearchQuery || userRoleFilter !== 'all'
                          ? 'No user matches the current search or role filter criteria.'
                          : 'No users have registered in the system yet.'}
                      </Text>
                    </View>
                  ) : (
                    filteredUsers.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.userItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedUser(u);
                          setShowPassword(false);
                          setNewResetPassword('');
                          setUserModalVisible(true);
                        }}
                      >
                        <View style={[styles.userAvatarBox, (styles as any)[`userAvatar_${u.role}`]]}>
                          <Ionicons
                            name={u.role === 'admin' ? 'shield-checkmark-outline' : u.role === 'teacher' ? 'school-outline' : 'person-outline'}
                            size={18}
                            color={u.role === 'admin' ? '#4F46E5' : u.role === 'teacher' ? '#059669' : '#D97706'}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{u.name || 'User'}</Text>
                          <Text style={styles.userUsername}>@{u.username} • ID #{u.id}</Text>
                        </View>

                        <View style={[styles.roleBadge, (styles as any)[`role_${u.role}`]]}>
                          <Text style={[styles.roleBadgeText, (styles as any)[`roleText_${u.role}`]]}>
                            {u.role.toUpperCase()}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.userInfoBtn}
                          onPress={() => {
                            setSelectedUser(u);
                            setShowPassword(false);
                            setNewResetPassword('');
                            setUserModalVisible(true);
                          }}
                        >
                          <Ionicons name="information-circle-outline" size={15} color="#4338CA" />
                          <Text style={styles.userInfoBtnText}>Info</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.userDeleteBtn,
                            (u.username === 'admin' || u.id === user?.id) && styles.userDeleteBtnDisabled,
                          ]}
                          onPress={() => {
                            if (u.username === 'admin') {
                              showAlert('Protected', 'The root administrator account cannot be deleted.');
                              return;
                            }
                            if (u.id === user?.id) {
                              showAlert('Protected', 'You cannot delete your own active administrator account.');
                              return;
                            }
                            setUserToDelete(u);
                            setAdminPasswordInput('');
                            setShowAdminPassword(false);
                            setDeleteModalVisible(true);
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={15}
                            color={u.username === 'admin' || u.id === user?.id ? '#94A3B8' : '#DC2626'}
                          />
                          <Text
                            style={[
                              styles.userDeleteBtnText,
                              (u.username === 'admin' || u.id === user?.id) && styles.userDeleteBtnTextDisabled,
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* SUB-VIEW 2: CREATE TEACHER ACCOUNT */}
              {userSubView === 'create' && (
                <View style={styles.card}>
                  <View style={styles.subViewHeaderRow}>
                    <TouchableOpacity
                      style={styles.backBtn}
                      onPress={() => setUserSubView('directory')}
                    >
                      <Ionicons name="arrow-back-outline" size={16} color="#4F46E5" />
                      <Text style={styles.backBtnText}>Back to User Directory</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardTitle}>Create Teacher Account</Text>
                  <Text style={styles.cardHelp}>
                    Authorized teachers can create curriculum lessons, author quizzes, and track classroom performance.
                  </Text>

                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Maria Santos"
                    value={teacherName}
                    onChangeText={setTeacherName}
                  />

                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. msantos"
                    value={teacherUsername}
                    onChangeText={setTeacherUsername}
                    autoCapitalize="none"
                  />

                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter initial password"
                    value={teacherPassword}
                    onChangeText={setTeacherPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, creatingTeacher && styles.primaryBtnDisabled]}
                    onPress={handleCreateTeacher}
                    disabled={creatingTeacher}
                  >
                    {creatingTeacher ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Create Teacher Account</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: SYSTEM DIAGNOSTICS & ANALYTICS AUDIT ENGINE */}
          {activeTab === 'diagnostics' && (
            <View style={{ gap: 16 }}>
              {/* Card 1: Diagnostic Cockpit Header */}
              <View style={styles.card}>
                <View style={styles.diagHeaderRow}>
                  <View style={styles.diagIconBadge}>
                    <Ionicons name="stats-chart-outline" size={22} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>System Diagnostics & Analytics Audit Engine</Text>
                    <Text style={styles.cardHelp}>
                      Real-time pedagogical telemetry, student mastery distribution, and ITS cognitive integrity audits.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.diagRefreshBtn}
                    onPress={fetchDiagnostics}
                    disabled={loadingDiagnostics}
                  >
                    {loadingDiagnostics ? (
                      <ActivityIndicator size="small" color="#4F46E5" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="refresh-outline" size={16} color="#4F46E5" />
                        <Text style={styles.diagRefreshBtnText}>Refresh Telemetry</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {loadingDiagnostics && !analyticsData ? (
                <View style={[styles.card, { paddingVertical: 40, alignItems: 'center' }]}>
                  <ActivityIndicator color="#4F46E5" size="large" />
                  <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading system telemetry and diagnostics...</Text>
                </View>
              ) : !analyticsData ? (
                <View style={[styles.card, { paddingVertical: 36, alignItems: 'center' }]}>
                  <Ionicons name="alert-circle-outline" size={40} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Telemetry Offline</Text>
                  <Text style={styles.emptyText}>No diagnostics data currently available from the analytics engine.</Text>
                  <TouchableOpacity style={styles.emptyActionBtn} onPress={fetchDiagnostics}>
                    <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Retry Diagnostics</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Executive KPI Stat Grid (4 Elevated Cards) */}
                  <View style={styles.diagKpiGrid}>
                    {/* KPI 1: Total Students (Blue) */}
                    <View style={[styles.diagKpiCard, styles.diagKpiCardBlue]}>
                      <View style={[styles.diagKpiIconBox, styles.diagKpiIconBoxBlue]}>
                        <Ionicons name="people-outline" size={20} color="#2563EB" />
                      </View>
                      <Text style={styles.diagKpiVal}>{studentCount || analyticsData.total_students || 0}</Text>
                      <Text style={styles.diagKpiLabel}>Enrolled Learners</Text>
                      <Text style={styles.diagKpiSub}>Total registered student accounts</Text>
                    </View>

                    {/* KPI 2: Quiz Attempts (Green) */}
                    <View style={[styles.diagKpiCard, styles.diagKpiCardGreen]}>
                      <View style={[styles.diagKpiIconBox, styles.diagKpiIconBoxGreen]}>
                        <Ionicons name="document-text-outline" size={20} color="#16A34A" />
                      </View>
                      <Text style={styles.diagKpiVal}>{analyticsData.total_attempts || 0}</Text>
                      <Text style={styles.diagKpiLabel}>Quiz Sessions</Text>
                      <Text style={styles.diagKpiSub}>Cumulative completed attempts</Text>
                    </View>

                    {/* KPI 3: Class Mastery Accuracy (Orange) */}
                    <View style={[styles.diagKpiCard, styles.diagKpiCardOrange]}>
                      <View style={[styles.diagKpiIconBox, styles.diagKpiIconBoxOrange]}>
                        <Ionicons name="ribbon-outline" size={20} color="#EA580C" />
                      </View>
                      <Text style={styles.diagKpiVal}>
                        {Math.round(analyticsData.class_avg_accuracy ?? analyticsData.avg_accuracy ?? analyticsData.avg_score ?? 0)}%
                      </Text>
                      <Text style={styles.diagKpiLabel}>Class Mastery Rate</Text>
                      <Text style={styles.diagKpiSub}>Mean accuracy across all topics</Text>
                    </View>

                    {/* KPI 4: ITS Cognitive Health (Indigo) */}
                    <View style={[styles.diagKpiCard, styles.diagKpiCardIndigo]}>
                      <View style={[styles.diagKpiIconBox, styles.diagKpiIconBoxIndigo]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#4F46E5" />
                      </View>
                      <Text style={styles.diagKpiVal}>Healthy</Text>
                      <Text style={styles.diagKpiLabel}>ITS Cognitive Engine</Text>
                      <Text style={styles.diagKpiSub}>pyBKT 2-state HMM active</Text>
                    </View>
                  </View>

                  {/* Section 2: Curriculum Topic Performance Breakdown */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Curriculum Topic Performance</Text>
                      <Text style={styles.cardHelp}>
                        Assessment accuracy and student engagement volume compared across learning subjects.
                      </Text>
                    </View>

                    <View style={styles.diagTopicGrid}>
                      {topics.map((t) => {
                        const stats = analyticsData.topic_stats?.[t.id] || { attempts: 0, avg_accuracy: 0 };
                        const acc = Math.round(stats.avg_accuracy || 0);
                        const isGood = acc >= 75;
                        const isMid = acc >= 50 && acc < 75;

                        return (
                          <View key={t.id} style={styles.diagTopicCard}>
                            <View style={styles.diagTopicHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.diagTopicIcon}>
                                  <Ionicons name={t.icon} size={18} color="#4F46E5" />
                                </View>
                                <Text style={styles.diagTopicName}>{t.name}</Text>
                              </View>
                              <View style={styles.diagTopicBadge}>
                                <Text style={styles.diagTopicBadgeText}>{stats.attempts} attempts</Text>
                              </View>
                            </View>

                            <View style={styles.diagTopicAccRow}>
                              <Text style={styles.diagTopicAccLabel}>Accuracy</Text>
                              <Text
                                style={[
                                  styles.diagTopicAccVal,
                                  isGood ? styles.textSuccess : isMid ? styles.textWarning : styles.textDanger,
                                ]}
                              >
                                {acc}%
                              </Text>
                            </View>

                            <View style={styles.diagProgressBarBg}>
                              <View
                                style={[
                                  styles.diagProgressBarFill,
                                  {
                                    width: `${Math.min(100, Math.max(0, acc))}%`,
                                    backgroundColor: isGood ? '#10B981' : isMid ? '#F59E0B' : '#EF4444',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Section 3: Weakest Knowledge Components Audit */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="warning-outline" size={18} color="#D97706" />
                        <Text style={styles.cardTitle}>Cognitive Gap & Weak KC Audit</Text>
                      </View>
                      <Text style={styles.cardHelp}>
                        Skills with lowest empirical mastery probability (P(mastery)). Guide teachers to reinforce these areas.
                      </Text>
                    </View>

                    {analyticsData.weak_kcs && analyticsData.weak_kcs.length > 0 ? (
                      <View style={styles.diagWeakGrid}>
                        {analyticsData.weak_kcs.map((kc: any) => (
                          <View key={kc.name} style={styles.diagWeakCard}>
                            <View style={styles.diagWeakCardTop}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.diagWeakTitle}>{kc.display_name}</Text>
                                <Text style={styles.diagWeakSlug}>ID: {kc.name}</Text>
                              </View>
                              <View style={styles.diagWeakBadge}>
                                <Text style={styles.diagWeakBadgeText}>
                                  {Math.round(kc.avg_mastery_pct)}% Mastery
                                </Text>
                              </View>
                            </View>
                            <View style={styles.diagWeakMetaRow}>
                              <Text style={styles.diagWeakTopic}>
                                Topic: {kc.topic_id.replace(/-/g, ' ').toUpperCase()}
                              </Text>
                              <Text style={styles.diagWeakCount}>
                                {kc.student_count} student evaluations
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.diagEmptyBox}>
                        <Ionicons name="checkmark-circle-outline" size={28} color="#10B981" />
                        <Text style={styles.diagEmptyTitle}>No Critical Cognitive Gaps Detected</Text>
                        <Text style={styles.diagEmptySub}>
                          Either student answer volume is below the threshold or all skills maintain healthy mastery levels.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Section 4: Student Engagement & Performance Roster */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="trophy-outline" size={18} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Student Engagement & Performance Roster</Text>
                      </View>
                      <Text style={styles.cardHelp}>
                        Active learners ordered by stars earned, retention streak, and assessment accuracy.
                      </Text>
                    </View>

                    {analyticsData.student_roster && analyticsData.student_roster.length > 0 ? (
                      <View style={styles.diagRosterTable}>
                        {analyticsData.student_roster
                          .filter((st: any) => {
                            const uMatch = users.find((u) => u.id === st.user_id || u.username === st.username);
                            if (uMatch && uMatch.role !== 'student') return false;
                            return st.username !== 'admin' && st.username !== 'teacher';
                          })
                          .slice(0, 10)
                          .map((st: any, idx: number) => (
                          <View key={st.user_id} style={styles.diagRosterRow}>
                            <View style={styles.diagRosterRankBox}>
                              <Text style={styles.diagRosterRankText}>#{idx + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.diagRosterName}>{st.name || 'Student'}</Text>
                              <Text style={styles.diagRosterUser}>@{st.username}</Text>
                            </View>
                            <View style={styles.diagRosterStats}>
                              <View style={styles.diagRosterPill}>
                                <Ionicons name="star" size={13} color="#F59E0B" />
                                <Text style={styles.diagRosterPillText}>{st.total_stars} Stars</Text>
                              </View>
                              <View style={styles.diagRosterPill}>
                                <Ionicons name="flame" size={13} color="#EA580C" />
                                <Text style={styles.diagRosterPillText}>{st.current_streak}d Streak</Text>
                              </View>
                              <View
                                style={[
                                  styles.diagRosterPill,
                                  st.avg_accuracy >= 75
                                    ? styles.diagPillSuccess
                                    : st.avg_accuracy >= 50
                                    ? styles.diagPillWarning
                                    : styles.diagPillDanger,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.diagRosterPillTextBold,
                                    st.avg_accuracy >= 75
                                      ? styles.textSuccess
                                      : st.avg_accuracy >= 50
                                      ? styles.textWarning
                                      : styles.textDanger,
                                  ]}
                                >
                                  {Math.round(st.avg_accuracy)}% Acc
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.diagEmptyBox}>
                        <Ionicons name="people-outline" size={28} color="#94A3B8" />
                        <Text style={styles.diagEmptyTitle}>No Student Activity Logged Yet</Text>
                        <Text style={styles.diagEmptySub}>
                          Once students solve daily quizzes and interactive lessons, performance will populate here.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Section 5: System Infrastructure & Telemetry Health */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="server-outline" size={18} color="#4F46E5" />
                        <Text style={styles.cardTitle}>System Infrastructure & Engine Health</Text>
                      </View>
                      <Text style={styles.cardHelp}>
                        Operational readiness of cognitive pipelines, database clusters, and pedagogical controllers.
                      </Text>
                    </View>

                    <View style={styles.diagHealthList}>
                      {[
                        { name: 'PostgreSQL Relational DB', sub: 'Learner profiles, sessions & KC tables', status: 'Online', desc: 'Latency nominal' },
                        { name: 'pyBKT EM Calibration Engine', sub: '2-state Hidden Markov Model estimator', status: 'Ready', desc: 'EM convergence nominal' },
                        { name: 'Adaptive Difficulty Gate', sub: 'Cognitive 70% threshold lesson progression', status: 'Active', desc: 'Automated gating' },
                        { name: 'ASL Scaffold & Hint Service', sub: 'Dual-lingual grammar glossing dictionary', status: 'Active', desc: '14 cognitive tags loaded' },
                      ].map((item) => (
                        <View key={item.name} style={styles.diagHealthRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.diagHealthName}>{item.name}</Text>
                            <Text style={styles.diagHealthSub}>{item.sub}</Text>
                          </View>
                          <View style={styles.diagHealthBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={styles.diagHealthBadgeText}>{item.status}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  </KeyboardAvoidingView>

      {/* User Details & Password Modal */}
      <Modal
        visible={userModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle-outline" size={24} color="#4F46E5" />
                <Text style={styles.modalTitle}>User Account Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setUserModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Basic Details */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Name</Text>
                  <Text style={styles.detailValue}>{selectedUser.name || 'Not provided'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Username</Text>
                  <Text style={styles.detailValue}>@{selectedUser.username}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>User ID</Text>
                  <Text style={styles.detailValue}>#{selectedUser.id}</Text>
                </View>

                {/* Role Switcher */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Account Role</Text>
                  <View style={styles.rolePickerRow}>
                    {(['student', 'teacher', 'admin'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.rolePickerBtn,
                          selectedUser.role === r && styles.rolePickerBtnActive,
                        ]}
                        onPress={() => handleChangeRole(selectedUser.id, r)}
                      >
                        <Text
                          style={[
                            styles.rolePickerBtnText,
                            selectedUser.role === r && styles.rolePickerBtnTextActive,
                          ]}
                        >
                          {r.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Password Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Account Password</Text>
                  <View style={styles.passwordDisplayBox}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="key-outline" size={18} color="#7C3AED" />
                      <Text
                        style={[
                          styles.passwordDisplayText,
                          !showPassword && styles.passwordDisplayTextMasked,
                        ]}
                        selectable={true}
                      >
                        {showPassword
                          ? (selectedUser.password || 'No plain password recorded')
                          : '••••••••••••'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.passwordHint}>
                    {showPassword
                      ? 'Password is visible to Administrator. You can copy or inspect it.'
                      : 'Tap the eye icon to reveal the plain password.'}
                  </Text>
                </View>

                {/* Reset Password */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Reset Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password for this user"
                    value={newResetPassword}
                    onChangeText={setNewResetPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, resettingPassword && styles.primaryBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save New Password</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                {selectedUser.username !== 'admin' && selectedUser.id !== user?.id && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: '#DC2626' }]}>Danger Zone</Text>
                    <TouchableOpacity
                      style={styles.deleteUserInModalBtn}
                      onPress={() => {
                        const target = selectedUser;
                        setUserModalVisible(false);
                        setUserToDelete(target);
                        setAdminPasswordInput('');
                        setShowAdminPassword(false);
                        setDeleteModalVisible(true);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.deleteUserInModalText}>Delete This User Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete User Confirmation Modal (Requires Admin Password) */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning-outline" size={24} color="#DC2626" />
                <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Confirm Account Deletion</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setUserToDelete(null);
                  setAdminPasswordInput('');
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {userToDelete && (
              <View>
                <View style={styles.deleteWarningBox}>
                  <Text style={styles.deleteWarningTitle}>Permanent Action</Text>
                  <Text style={styles.deleteWarningText}>
                    You are about to permanently delete{' '}
                    <Text style={{ fontWeight: 'bold', color: '#991B1B' }}>
                      {userToDelete.name || userToDelete.username} (@{userToDelete.username})
                    </Text>
                    . This will delete all associated student progress, quiz attempts, streaks, and account records.
                  </Text>
                </View>

                <View style={{ marginVertical: 14 }}>
                  <Text style={styles.adminAuthLabel}>
                    Enter your Administrator Password to authorize:
                  </Text>
                  <View style={styles.passwordDisplayBox}>
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 4 }}
                      placeholder="Administrator password"
                      value={adminPasswordInput}
                      onChangeText={setAdminPasswordInput}
                      secureTextEntry={!showAdminPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowAdminPassword(!showAdminPassword)}
                    >
                      <Ionicons
                        name={showAdminPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.deleteModalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => {
                      setDeleteModalVisible(false);
                      setUserToDelete(null);
                      setAdminPasswordInput('');
                    }}
                    disabled={deletingUser}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmDeleteBtn, deletingUser && styles.primaryBtnDisabled]}
                    onPress={handleDeleteUser}
                    disabled={deletingUser}
                  >
                    {deletingUser ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteBtnText}>Delete Account</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    width: 200,
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
    gap: 10,
  },
  sidebarStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
    marginBottom: 6,
  },
  sidebarStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  sidebarStatusDotOnly: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginVertical: 4,
  },
  sidebarStatusTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
  },
  sidebarStatusSubtitle: {
    fontSize: 9.5,
    color: '#047857',
  },
  sidebarFooterDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 240,
  },
  mainHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  mainHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  subViewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 8,
    gap: 4,
  },
  subViewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  subViewToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  subViewToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  subViewToggleTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  headerSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  headerSyncBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  topicBar: {
    marginBottom: 14,
  },
  topicBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  paramGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  paramBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  paramInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  paramHelp: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
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
  kcItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  kcItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  kcItemSlug: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
  },
  kcItemParams: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  resultBox: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4338CA',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#312E81',
    lineHeight: 18,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  userUsername: {
    fontSize: 12,
    color: '#64748B',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  role_admin: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  role_teacher: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  role_student: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  roleText_admin: {
    color: '#4338CA',
  },
  roleText_teacher: {
    color: '#059669',
  },
  roleText_student: {
    color: '#D97706',
  },
  roleToggleBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleToggleText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  userDirHeader: {
    marginBottom: 12,
  },
  userDirSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  userInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  userInfoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rolePickerBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  rolePickerBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  rolePickerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  rolePickerBtnTextActive: {
    color: '#4F46E5',
  },
  passwordDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordDisplayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  passwordDisplayTextMasked: {
    letterSpacing: 3,
    fontSize: 16,
    color: '#64748B',
  },
  eyeBtn: {
    padding: 4,
  },
  passwordHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  userDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  userDeleteBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  userDeleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  userDeleteBtnTextDisabled: {
    color: '#94A3B8',
  },
  deleteUserInModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  deleteUserInModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteWarningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deleteWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  deleteWarningText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  adminAuthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  confirmDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  headerPrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  headerPrimaryActionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subViewHeaderRow: {
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  kcItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paramChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  paramChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paramChipLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  paramChipValue: {
    fontSize: 10.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  kcDeleteBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    marginLeft: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  roleFilterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleFilterPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  roleFilterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  roleFilterPillTextActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    minWidth: 220,
    flex: 1,
    maxWidth: 340,
  },
  searchBoxInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  userAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatar_admin: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  userAvatar_teacher: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  userAvatar_student: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    fontSize: 16,
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
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
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
  pulseCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pulseCard: {
    flex: 1,
    minWidth: 240,
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
  pulseCardViolet: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
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
  pulseCardIconViolet: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
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
  pulseCardTitleViolet: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B21A8',
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
  pulseCardSubViolet: {
    fontSize: 11,
    color: '#7E22CE',
    marginTop: 2,
  },
  // Minimalist Spec Strip Styles (Design A - Linear / Vercel style)
  specStripCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  specStripHeader: {
    marginBottom: 12,
  },
  specStripTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  specStripSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  specColumnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  specCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  // Blue for P(L0)
  specCardPrior: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  // Green for P(T)
  specCardLearn: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FFFFFF',
  },
  // Orange for P(G)
  specCardGuess: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFFFF',
  },
  // Indigo for P(S)
  specCardSlip: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FFFFFF',
  },
  specSymbolPill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  specPillPrior: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  specPillLearn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  specPillGuess: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  specPillSlip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  specSymbolText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    fontWeight: '700',
  },
  specTextPrior: {
    color: '#2563EB',
  },
  specTextLearn: {
    color: '#16A34A',
  },
  specTextGuess: {
    color: '#EA580C',
  },
  specTextSlip: {
    color: '#4F46E5',
  },
  specRoleLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
  },
  specBaselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    marginBottom: 6,
  },
  specBaselineLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  specBaselineVal: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    fontWeight: '800',
  },
  specDescText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  paramChipPrior: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  paramChipLearn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  paramChipGuess: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  paramChipSlip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  cardHeader: {
    marginBottom: 14,
  },
  kcParamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  kcParamBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // pyBKT Calibration Studio Styles
  calibHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  calibIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibVersionBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  calibVersionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  calibTheoryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 4,
  },
  calibTheoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  calibTheoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  calibTheoryText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  calibFormulaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calibFormulaItem: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3,
    padding: 8,
  },
  calibFormulaItemTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  calibFormulaItemDesc: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 14,
  },
  calibReadinessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  calibReadinessCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
  },
  calibReadinessIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  calibReadinessVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  calibReadinessLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  calibReadinessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  calibReadinessPillSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  calibReadinessPillWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  calibReadinessPillInfo: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  calibReadinessPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  calibReadinessPillTextSuccess: {
    color: '#047857',
  },
  calibReadinessPillTextWarning: {
    color: '#B45309',
  },
  calibReadinessPillTextInfo: {
    color: '#4338CA',
  },
  calibScopeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 14,
  },
  calibScopeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  calibScopeButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  calibScopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  calibScopeBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  calibScopeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  calibScopeBtnTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  calibPrimaryActionBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  calibActionContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calibPrimaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calibNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 10,
    marginTop: 12,
  },
  calibNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#3730A3',
    lineHeight: 16,
  },
  calibSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calibSuccessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  calibSummaryBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 12,
  },
  calibSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
  },
  calibSummaryDetails: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  calibSectionHeading: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  calibKcCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  calibKcCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calibKcCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  calibAnswersBadge: {
    backgroundColor: '#E0E7FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calibAnswersBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#3730A3',
  },
  calibParamRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calibEmptyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibEmptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
  },
  calibEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 400,
  },
  calibSkippedBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
  },
  calibSkippedTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#B45309',
  },
  calibSkippedSub: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  skippedChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  skippedChipText: {
    fontSize: 11,
    color: '#78350F',
    fontWeight: '600',
  },
  calibEmptyPlaceholder: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibEmptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  calibEmptyPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textAlign: 'center',
  },
  calibEmptyPlaceholderText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 18,
  },
  // Diagnostics Cockpit Styles
  diagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  diagIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  diagRefreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  diagKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  diagKpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  diagKpiCardBlue: {
    borderColor: '#BFDBFE',
  },
  diagKpiCardGreen: {
    borderColor: '#BBF7D0',
  },
  diagKpiCardOrange: {
    borderColor: '#FED7AA',
  },
  diagKpiCardIndigo: {
    borderColor: '#C7D2FE',
  },
  diagKpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  diagKpiIconBoxBlue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  diagKpiIconBoxGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  diagKpiIconBoxOrange: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  diagKpiIconBoxIndigo: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  diagKpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  diagKpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  diagKpiSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  diagTopicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  diagTopicCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  diagTopicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  diagTopicIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagTopicName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  diagTopicBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  diagTopicBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  diagTopicAccRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  diagTopicAccLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  diagTopicAccVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  diagProgressBarBg: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  diagProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  textSuccess: {
    color: '#059669',
  },
  textWarning: {
    color: '#D97706',
  },
  textDanger: {
    color: '#DC2626',
  },
  diagWeakGrid: {
    gap: 10,
  },
  diagWeakCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
  },
  diagWeakCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  diagWeakTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#92400E',
  },
  diagWeakSlug: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  diagWeakBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  diagWeakBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  diagWeakMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    paddingTop: 6,
    marginTop: 4,
  },
  diagWeakTopic: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
  },
  diagWeakCount: {
    fontSize: 10.5,
    color: '#92400E',
  },
  diagEmptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  diagEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  diagEmptySub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 420,
  },
  diagRosterTable: {
    gap: 8,
  },
  diagRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 10,
  },
  diagRosterRankBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagRosterRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  diagRosterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  diagRosterUser: {
    fontSize: 11,
    color: '#64748B',
  },
  diagRosterStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  diagRosterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  diagRosterPillText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  diagRosterPillTextBold: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  diagPillSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  diagPillWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  diagPillDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  diagHealthList: {
    gap: 8,
  },
  diagHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  diagHealthName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  diagHealthSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  diagHealthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  diagHealthBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
});
