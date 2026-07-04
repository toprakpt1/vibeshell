import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBridgeStore } from '../store/useBridgeStore';
import { theme } from '../theme';

export function ConnectionStatus() {
  const { connectionState, errorMessage } = useBridgeStore();

  let bgColor: string = theme.colors.semantic.errorMuted;
  let textColor: string = theme.colors.semantic.error;
  let text = 'Bağlantı Hatası';

  if (connectionState === 'connected') {
    bgColor = theme.colors.semantic.successMuted;
    textColor = theme.colors.semantic.success;
    text = 'Bağlı';
  } else if (connectionState === 'connecting') {
    bgColor = theme.colors.semantic.warningMuted;
    textColor = theme.colors.semantic.warning;
    text = 'Bağlanıyor...';
  } else if (connectionState === 'disconnected') {
    bgColor = theme.colors.semantic.infoMuted;
    textColor = theme.colors.semantic.info;
    text = 'Bağlı Değil';
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: bgColor }]}>
        <View style={[styles.dot, { backgroundColor: textColor }]} />
        <Text style={[styles.text, { color: textColor }]}>{text}</Text>
      </View>
      {errorMessage && (
        <Text style={styles.errorText} numberOfLines={1}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...theme.typography.textStyles.caption,
    fontWeight: theme.typography.fontWeights.medium,
  },
  errorText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.semantic.error,
    flex: 1,
  },
});
