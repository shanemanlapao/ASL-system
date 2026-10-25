import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCESSIBILITY_STORAGE_KEYS = {
  HAPTICS: '@dhh_haptics_enabled',
  HIGH_CONTRAST: '@dhh_high_contrast',
};

interface AccessibilityContextType {
  hapticsEnabled: boolean;
  highContrast: boolean;
  setHapticsEnabled: (val: boolean) => Promise<void>;
  setHighContrast: (val: boolean) => Promise<void>;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  hapticsEnabled: false,
  highContrast: false,
  setHapticsEnabled: async () => {},
  setHighContrast: async () => {},
});

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(false);
  const [highContrast, setHighContrastState] = useState<boolean>(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedHaptics, savedContrast] = await Promise.all([
          AsyncStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.HAPTICS),
          AsyncStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.HIGH_CONTRAST),
        ]);
        // If haptics was never configured, default to FALSE so users who reject/skip don't vibrate
        if (savedHaptics !== null) {
          setHapticsEnabledState(savedHaptics === 'true');
        } else {
          setHapticsEnabledState(false);
        }
        if (savedContrast !== null) setHighContrastState(savedContrast === 'true');
      } catch (e) {
        console.log('Error loading accessibility settings:', e);
      }
    };
    loadSettings();
  }, []);

  const setHapticsEnabled = async (val: boolean) => {
    setHapticsEnabledState(val);
    try {
      await AsyncStorage.setItem(ACCESSIBILITY_STORAGE_KEYS.HAPTICS, String(val));
    } catch {}
  };

  const setHighContrast = async (val: boolean) => {
    setHighContrastState(val);
    try {
      await AsyncStorage.setItem(ACCESSIBILITY_STORAGE_KEYS.HIGH_CONTRAST, String(val));
    } catch {}
  };

  return (
    <AccessibilityContext.Provider
      value={{
        hapticsEnabled,
        highContrast,
        setHapticsEnabled,
        setHighContrast,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
