import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  style,
  textStyle,
  icon,
  children
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {icon && <View style={styles.icon}>{icon}</View>}
        {children || (
          <Text style={[
            styles.text,
            styles[`text_${variant}`],
            styles[`textSize_${size}`],
            disabled && styles.disabledText,
            textStyle
          ]}>
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
  },
  // Variants
  default: {
    backgroundColor: '#030213',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  destructive: {
    backgroundColor: '#dc2626',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  link: {
    backgroundColor: 'transparent',
  },
  // Text variants
  text_default: {
    color: '#ffffff',
  },
  text_outline: {
    color: '#030213',
  },
  text_destructive: {
    color: '#ffffff',
  },
  text_ghost: {
    color: '#030213',
  },
  text_link: {
    color: '#030213',
    textDecorationLine: 'underline',
  },
  // Sizes
  size_default: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  size_sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  size_lg: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    minHeight: 40,
  },
  size_icon: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  // Text sizes
  textSize_default: {
    fontSize: 14,
  },
  textSize_sm: {
    fontSize: 12,
  },
  textSize_lg: {
    fontSize: 16,
  },
  textSize_icon: {
    fontSize: 14,
  },
  // Disabled states
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.5,
  },
});