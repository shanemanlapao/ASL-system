import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { useAccessibility } from '../context/AccessibilityContext';

interface AnimatedBackgroundProps {
  /** Opacity of the background GIF (default: 0.30 for clear anti-glare contrast) */
  opacity?: number;
  /** Optional custom container style overrides */
  style?: StyleProp<ViewStyle>;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  opacity = 0.30,
  style,
}) => {
  const { highContrast } = useAccessibility();

  // Disable decorative animation in High Contrast mode for maximum visual accessibility
  if (highContrast) {
    return null;
  }

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Image
        source={require('../assets/images/option_a_falling_stars.gif')}
        style={[styles.image, { opacity }]}
        contentFit="cover"
        autoplay={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default AnimatedBackground;
