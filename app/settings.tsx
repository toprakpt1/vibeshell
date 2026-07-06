import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../src/store/useSettings';
import { useOpenCodeStore } from '../src/store/useOpenCodeStore';
import { theme } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const { connected, serverVersion } = useOpenCodeStore();

  const [openCodeUrl, setOpenCodeUrl] = useState(settings.openCodeUrl);
  const [openCodePassword, setOpenCodePassword] = useState(settings.openCodePassword);
  const [bridgeToken, setBridgeToken] = useState(settings.bridgeToken);
  const [bridgeUrl, setBridgeUrl] = useState(settings.bridgeUrl);

  const handleSave = async () => {
    await settings.setOpenCodeUrl(openCodeUrl);
    await settings.setOpenCodePassword(openCodePassword);
    await settings.setBridgeToken(bridgeToken);
    settings.setBridgeUrl(bridgeUrl);

    // Reconnect to OpenCode
    if (openCodeUrl) {
      await useOpenCodeStore.getState().connect(openCodeUrl, openCodePassword || undefined);
    }

    router.back();
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OpenCode Server</Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
          <Text style={styles.statusText}>
            {connected ? `Bagli (v${serverVersion || '?'})` : 'Bagli Degil'}
          </Text>
        </View>

        <Text style={styles.label}>Sunucu Adresi</Text>
        <TextInput
          style={styles.input}
          value={openCodeUrl}
          onChangeText={setOpenCodeUrl}
          placeholder="http://127.0.0.1:4096"
          placeholderTextColor={theme.colors.text.muted}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Sifre (opsiyonel)</Text>
        <TextInput
          style={styles.input}
          value={openCodePassword}
          onChangeText={setOpenCodePassword}
          placeholder="OPENCODE_SERVER_PASSWORD"
          placeholderTextColor={theme.colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Terminal Bridge</Text>

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
          placeholder="Token from bridge install script"
          placeholderTextColor={theme.colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Kaydet</Text>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.semantic.error,
  },
  statusDotConnected: {
    backgroundColor: theme.colors.semantic.success,
  },
  statusText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.muted,
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
