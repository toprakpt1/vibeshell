import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Workspace } from '../store/useWorkspaces';
import { theme } from '../theme';

interface WorkspaceCardProps {
  workspace: Workspace;
  onPress: () => void;
  onDelete?: () => void;
}

export function WorkspaceCard({ workspace, onPress, onDelete }: WorkspaceCardProps) {
  const dateStr = new Date(workspace.lastOpenedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="folder-open" size={24} color={theme.colors.brand.primary} />
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>{workspace.name}</Text>
        <Text style={styles.path} numberOfLines={1} ellipsizeMode="middle">
          {workspace.path}
        </Text>
        <Text style={styles.date}>Last opened: {dateStr}</Text>
      </View>

      {onDelete && (
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={onDelete}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.semantic.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xxs,
  },
  path: {
    ...theme.typography.textStyles.codeSmall,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.xs,
  },
  date: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.text.muted,
  },
  deleteButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
});
