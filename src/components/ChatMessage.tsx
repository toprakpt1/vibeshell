import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage as ChatMessageType } from '../agent/types';
import { ToolCallCard } from './ToolCallCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { theme } from '../theme';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Ionicons name="information-circle" size={16} color={theme.colors.semantic.info} />
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color={theme.colors.brand.primary} />
        </View>
      )}
      
      <View style={[styles.contentBubble, isUser && styles.userBubble]}>
        {message.content ? (
          isUser ? (
            <Text style={styles.userText}>{message.content}</Text>
          ) : (
            <MarkdownRenderer content={message.content} />
          )
        ) : null}

        {message.toolCalls?.map((tc) => (
          <View key={tc.id} style={styles.toolCallWrapper}>
            <ToolCallCard
              name={tc.name}
              input={tc.input}
              result={tc.result}
              isError={tc.isError}
              isRunning={tc.isRunning}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaces.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    marginTop: 2,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
  },
  contentBubble: {
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: theme.colors.brand.primaryMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.sm,
  },
  userText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse, // Light blue primary bg needs lighter text
  },
  toolCallWrapper: {
    marginTop: theme.spacing.sm,
  },
  systemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  systemText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.text.muted,
    textAlign: 'center',
  },
});
