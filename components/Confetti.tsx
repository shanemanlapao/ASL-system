import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#7C3AED', // Deep Violet (Story Grammar)
  '#2563EB', // Royal Blue (Math)
  '#10B981', // Emerald Green (Araling Panlipunan / Success)
  '#D97706', // Warm Amber (TLE)
  '#F59E0B', // Amber Gold
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#FBBF24', // Gold
  '#EC4899', // Pink
];

interface ConfettiPieceProps {
  index: number;
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ index }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  // Random layout properties per particle
  const startX = useRef(Math.random() * SCREEN_WIDTH).current;
  const driftX = useRef((Math.random() - 0.5) * 140).current;
  const color = useRef(CONFETTI_COLORS[index % CONFETTI_COLORS.length]).current;
  const size = useRef(8 + Math.random() * 8).current;
  const isCircle = useRef(index % 3 === 0).current;
  const rotationDegrees = useRef((Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720)).current;
  const delay = useRef((index * 40) + Math.random() * 150).current;
  const duration = useRef(2400 + Math.random() * 1200).current;

  useEffect(() => {
    const animation = Animated.timing(animValue, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: Platform.OS !== 'web',
    });

    animation.start();

    return () => animation.stop();
  }, [animValue, delay, duration]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, SCREEN_HEIGHT + 50],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [startX, startX + driftX, startX + driftX * 1.4],
  });

  const rotate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${rotationDegrees}deg`],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 0.9, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.3, 1, 0.75],
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: isCircle ? size : size * 1.5,
          borderRadius: isCircle ? size / 2 : 2,
          backgroundColor: color,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
          opacity,
        },
      ]}
    />
  );
};

interface ConfettiProps {
  count?: number;
}

export default function Confetti({ count = 50 }: ConfettiProps) {
  useEffect(() => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Haptics fallback for web or unsupported devices
    }
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
