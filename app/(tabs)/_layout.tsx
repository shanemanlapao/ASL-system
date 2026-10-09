import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { COLORS } from "../../context/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card, // Clean White
          borderTopWidth: 1,
          borderTopColor: COLORS.border, // Subtle Slate-200 border
          elevation: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: -2,
        },
        tabBarActiveTintColor: COLORS.primary,     // Deep Violet (#7C3AED)
        tabBarInactiveTintColor: COLORS.textMuted, // Soft Slate (#94A3B8)
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size + 1}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="quest"
        options={{
          title: "Quest",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "trophy" : "trophy-outline"}
              size={size + 1}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="translate"
        options={{
          title: "Translate",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "hand-left" : "hand-left-outline"}
              size={size + 1}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={size + 1}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
