import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const TOOL_ICONS: Record<string, string> = {
  run_command: '⚙️',
  read_file: '📖',
  write_file: '✏️',
  list_dir: '📂',
  apply_patch: '🩹',
  git_diff: '🔍',
  git_commit: '💾',
  bash: '⚙️',
  file_write: '✏️',
  file_rewrite: '🩹',
  file_delete: '🗑️',
  shell_exec: '⚙️',
  question: '❓',
};

const TOOL_LABELS: Record<string, string> = {
  run_command: 'Komut calistiriliyor',
  read_file: 'Dosya okunuyor',
  write_file: 'Dosya yaziliyor',
  list_dir: 'Dizin listeleniyor',
  apply_patch: 'Yama uygulanıyor',
  git_diff: 'Git diff alınıyor',
  git_commit: 'Git commit yapılıyor',
  bash: 'Komut calistiriliyor',
  file_write: 'Dosya yaziliyor',
  file_rewrite: 'Dosya guncelleniyor',
  file_delete: 'Dosya siliniyor',
  shell_exec: 'Komut calistiriliyor',
  question: 'Soru',
};

interface ToolCallCardProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
}

export function ToolCallCard({ name, input, result, isError, isRunning }: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  const icon = TOOL_ICONS[name] || '🔧';
  const label = TOOL_LABELS[name] || name;

  let detail = '';
  if (name === 'run_command' || name === 'bash' || name === 'shell_exec') {
    detail = String(input.command || '');
  } else if (name === 'read_file' || name === 'write_file' || name === 'file_write' || name === 'file_rewrite') {
    detail = String(input.path || '').split('/').pop() || String(input.path || '');
  } else if (name === 'list_dir') {
    detail = String(input.path || '');
  } else if (name === 'git_commit') {
    detail = String(input.message || '');
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.label}>{label}</Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1} ellipsizeMode="middle">
              {detail}
            </Text>
          ) : null}
        </View>
        <View style={styles.statusRow}>
          {isRunning ? (
            <ActivityIndicator size="small" color={theme.colors.brand.primary} />
          ) : isError ? (
            <Ionicons name="close-circle" size={16} color={theme.colors.semantic.error} />
          ) : (
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.semantic.success} />
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.text.muted}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Input:</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>
              {JSON.stringify(input, null, 2)}
            </Text>
          </View>

          {result && (
            <>
              <Text style={styles.sectionTitle}>Result:</Text>
              <View style={[styles.codeBlock, isError && styles.errorBlock]}>
                <Text style={[styles.codeText, isError && styles.errorText]}>
                  {result}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaces.surface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.xs,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  detail: {
    ...theme.typography.textStyles.codeSmall,
    color: theme.colors.text.muted,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borders.default,
    backgroundColor: theme.colors.backgrounds.base,
  },
  sectionTitle: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.xs,
  },
  codeBlock: {
    backgroundColor: theme.colors.backgrounds.elevated,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  errorBlock: {
    backgroundColor: theme.colors.semantic.errorMuted,
  },
  codeText: {
    ...theme.typography.textStyles.codeSmall,
    color: theme.colors.text.primary,
  },
  errorText: {
    color: theme.colors.semantic.error,
  },
});
