import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface PermissionModalProps {
  visible: boolean;
  title: string;
  description: string;
  onAllow: (response: 'once' | 'always') => void;
  onDeny: () => void;
}

export function PermissionModal({
  visible,
  title,
  description,
  onAllow,
  onDeny,
}: PermissionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={32} color={theme.colors.brand.primary} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.denyButton} onPress={onDeny}>
              <Text style={styles.denyText}>Reddet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.allowButton}
              onPress={() => onAllow('once')}
            >
              <Text style={styles.allowText}>Izin Ver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.allowAlwaysButton}
              onPress={() => onAllow('always')}
            >
              <Text style={styles.allowAlwaysText}>Her Zaman Izin Ver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.backgrounds.base,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  actions: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  denyButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    alignItems: 'center',
  },
  denyText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
  },
  allowButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
  },
  allowText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
  },
  allowAlwaysButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaces.surface,
    alignItems: 'center',
  },
  allowAlwaysText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.brand.primary,
  },
});
