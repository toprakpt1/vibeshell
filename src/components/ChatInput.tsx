import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isRunning?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, isRunning, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled && !isRunning) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            editable={!disabled}
          />
          
          {isRunning ? (
            <TouchableOpacity 
              style={styles.stopButton} 
              onPress={onStop}
              activeOpacity={0.7}
            >
              <Ionicons name="stop" size={16} color={theme.colors.text.inverse} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!text.trim() || disabled) && styles.sendButtonDisabled
              ]} 
              onPress={handleSend}
              disabled={!text.trim() || disabled}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="arrow-up" 
                size={20} 
                color={!text.trim() || disabled ? theme.colors.text.muted : theme.colors.text.inverse} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgrounds.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borders.default,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  input: {
    flex: 1,
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
    maxHeight: 120,
    minHeight: 24,
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.surfaces.pressed,
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
});
