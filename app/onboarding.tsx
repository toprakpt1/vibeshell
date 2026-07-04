import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { theme } from '../src/theme';

const INSTALL_COMMAND = 'curl -sL https://raw.githubusercontent.com/toprakpt1/vibeshell/master/bridge/install.sh | bash';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setBridgeToken, setOnboardingSeen } = useSettings();
  const { connect, connectionState } = useBridgeStore();
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openFDroid = () => {
    Linking.openURL('https://f-droid.org/en/packages/com.termux/');
  };

  const handleCheckConnection = async () => {
    if (!token.trim()) return;
    setChecking(true);
    await setBridgeToken(token.trim());
    connect('ws://127.0.0.1:8765', token.trim());
    setTimeout(() => setChecking(false), 3000);
  };

  const handleDone = async () => {
    if (token.trim()) {
      await setBridgeToken(token.trim());
    }
    await setOnboardingSeen();
    router.replace('/');
  };

  const handleSkip = async () => {
    await setOnboardingSeen();
    router.replace('/');
  };

  const isConnected = connectionState === 'connected';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <Text style={styles.stepTitle}>Install Termux</Text>
        </View>
        <Text style={styles.stepDesc}>
          Install Termux from F-Droid. The Play Store version is deprecated and will not work.
        </Text>
        <TouchableOpacity style={styles.linkButton} onPress={openFDroid}>
          <Ionicons name="download-outline" size={20} color={theme.colors.brand.primary} />
          <Text style={styles.linkText}>Get Termux on F-Droid</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
          <Text style={styles.stepTitle}>Run Install Script</Text>
        </View>
        <Text style={styles.stepDesc}>
          Open Termux and paste this command. It installs Node.js and sets up the bridge server:
        </Text>

        <View style={styles.codeBlock}>
          <Text style={styles.codeText} selectable>{INSTALL_COMMAND}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={theme.colors.text.inverse} />
            <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
          <Text style={styles.stepTitle}>Enter Your Token</Text>
        </View>
        <Text style={styles.stepDesc}>
          The script prints an auth token at the end. Paste it below to connect.
        </Text>

        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Paste your auth token"
          placeholderTextColor={theme.colors.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.checkButton, (!token.trim() || checking) && styles.checkButtonDisabled]}
          onPress={handleCheckConnection}
          disabled={!token.trim() || checking}
        >
          {checking ? (
            <Ionicons name="sync" size={16} color={theme.colors.text.inverse} />
          ) : isConnected ? (
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.text.inverse} />
          ) : (
            <Ionicons name="wifi" size={16} color={theme.colors.text.inverse} />
          )}
          <Text style={styles.checkButtonText}>
            {checking ? 'Checking...' : isConnected ? 'Connected' : 'Check Connection'}
          </Text>
        </TouchableOpacity>

        {isConnected && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.semantic.success} />
            <Text style={styles.successText}>Bridge connected successfully</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip — set up later</Text>
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
  step: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  stepNumberText: {
    ...theme.typography.textStyles.bodyBold,
    color: theme.colors.brand.primary,
  },
  stepTitle: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
  },
  stepDesc: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand.primaryMuted,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    gap: theme.spacing.sm,
  },
  linkText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.brand.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  codeBlock: {
    backgroundColor: theme.colors.backgrounds.elevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
  },
  codeText: {
    ...theme.typography.textStyles.code,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.sm,
  },
  copyButtonText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
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
    fontFamily: theme.typography.fontFamilies.mono,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
  checkButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.semantic.successMuted,
    borderRadius: theme.borderRadius.sm,
  },
  successText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.semantic.success,
  },
  actions: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  doneButton: {
    backgroundColor: theme.colors.brand.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
  },
  skipButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
  },
});
