import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, AVAILABLE_MODELS, ModelId } from '../src/store/useSettings';
import { theme } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [bridgeToken, setBridgeToken] = useState(settings.bridgeToken);
  const [bridgeUrl, setBridgeUrl] = useState(settings.bridgeUrl);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  
  const [showModels, setShowModels] = useState(false);

  const handleSave = async () => {
    await settings.setApiKey(apiKey);
    await settings.setBridgeToken(bridgeToken);
    settings.setBridgeUrl(bridgeUrl);
    settings.setSystemPrompt(systemPrompt);
    router.back();
  };

  const currentModel = AVAILABLE_MODELS.find(m => m.id === settings.model);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Provider (OpenRouter)</Text>
        
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-or-v1-..."
          placeholderTextColor={theme.colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>Model</Text>
        <TouchableOpacity 
          style={styles.modelSelect} 
          onPress={() => setShowModels(!showModels)}
        >
          <Text style={styles.modelSelectText}>{currentModel?.name || 'Select Model'}</Text>
          <Ionicons name={showModels ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.text.muted} />
        </TouchableOpacity>

        {showModels && (
          <View style={styles.modelsList}>
            {AVAILABLE_MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modelItem,
                  settings.model === m.id && styles.modelItemSelected
                ]}
                onPress={() => {
                  settings.setModel(m.id as ModelId);
                  setShowModels(false);
                }}
              >
                <Text style={[
                  styles.modelItemText,
                  settings.model === m.id && styles.modelItemTextSelected
                ]}>
                  {m.name}
                </Text>
                {settings.model === m.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.brand.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Termux Bridge</Text>
        
        <Text style={styles.label}>WebSocket URL</Text>
        <TextInput
          style={styles.input}
          value={bridgeUrl}
          onChangeText={setBridgeUrl}
          placeholder="ws://127.0.0.1:8765"
          placeholderTextColor={theme.colors.text.muted}
          autoCapitalize="none"
          keyboardType="url"
        />
        
        <Text style={styles.label}>Auth Token</Text>
        <TextInput
          style={styles.input}
          value={bridgeToken}
          onChangeText={setBridgeToken}
          placeholder="Token from termux install script"
          placeholderTextColor={theme.colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Prompt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  section: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  sectionTitle: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.textStyles.label,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surfaces.surface,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  textArea: {
    minHeight: 150,
  },
  modelSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaces.surface,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modelSelectText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
  },
  modelsList: {
    backgroundColor: theme.colors.surfaces.surface,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  modelItemSelected: {
    backgroundColor: theme.colors.brand.primaryMuted,
  },
  modelItemText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
  },
  modelItemTextSelected: {
    color: theme.colors.brand.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  actions: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  saveButton: {
    backgroundColor: theme.colors.brand.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
  },
});
