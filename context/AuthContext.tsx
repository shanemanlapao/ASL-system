import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = {
  id: number;
  name: string;
  username: string;
  role?: string;
  avatar_url?: string | null;
  last_avatar_changed_at?: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  setUser: () => {},
  logout: async () => {},
});

const USER_KEY = "@brightpath_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app start — check if a session is saved on the phone
  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_KEY);
        if (stored) {
          setUserState(JSON.parse(stored));
        }
      } catch {
        // Storage read failed — just start logged out
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  // Save user to phone storage whenever it changes
  const setUser = async (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
  };

  // Clear everything on logout
  const logout = async () => {
    setUserState(null);
    await AsyncStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
