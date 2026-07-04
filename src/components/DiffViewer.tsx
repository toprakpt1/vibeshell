import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface DiffViewerProps {
  diff: string;
  filePath?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function DiffViewer({ diff, filePath, onApprove, onReject }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <View style={styles.container}>
      {filePath && (
        <View style={styles.header}>
          <Text style={styles.filePath} numberOfLines={1} ellipsizeMode="middle">
            {filePath}
          </Text>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} horizontal={true}>
        <View>
          {lines.map((line, index) => {
            let lineStyle = styles.lineNormal;
            let textStyle = styles.textNormal;
            
            if (line.startsWith('+')) {
              lineStyle = styles.lineAdded;
              textStyle = styles.textAdded;
            } else if (line.startsWith('-')) {
              lineStyle = styles.lineRemoved;
              textStyle = styles.textRemoved;
            } else if (line.startsWith('@')) {
              lineStyle = styles.lineMeta;
              textStyle = styles.textMeta;
            }

            return (
              <View key={index} style={[styles.lineRow, lineStyle]}>
                <Text style={[styles.lineText, textStyle]}>{line}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {(onApprove || onReject) && (
        <View style={styles.actions}>
          {onReject && (
            <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={onReject}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          )}
          {onApprove && (
            <TouchableOpacity style={[styles.button, styles.approveButton]} onPress={onApprove}>
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgrounds.elevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    overflow: 'hidden',
  },
  header: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaces.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  filePath: {
    ...theme.typography.textStyles.codeSmall,
    color: theme.colors.text.primary,
  },
  scrollView: {
    maxHeight: 300,
  },
  lineRow: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: '100%',
  },
  lineText: {
    ...theme.typography.textStyles.codeSmall,
  },
  lineNormal: {},
  textNormal: {
    color: theme.colors.text.primary,
  },
  lineAdded: {
    backgroundColor: theme.colors.diff.addedBg,
  },
  textAdded: {
    color: theme.colors.diff.addedText,
  },
  lineRemoved: {
    backgroundColor: theme.colors.diff.removedBg,
  },
  textRemoved: {
    color: theme.colors.diff.removedText,
  },
  lineMeta: {
    backgroundColor: theme.colors.surfaces.surface,
  },
  textMeta: {
    color: theme.colors.text.muted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borders.default,
    backgroundColor: theme.colors.surfaces.surface,
    gap: theme.spacing.sm,
  },
  button: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: theme.colors.semantic.errorMuted,
  },
  rejectButtonText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.semantic.error,
    fontWeight: theme.typography.fontWeights.medium,
  },
  approveButton: {
    backgroundColor: theme.colors.semantic.successMuted,
  },
  approveButtonText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.semantic.success,
    fontWeight: theme.typography.fontWeights.medium,
  },
});
