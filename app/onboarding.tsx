import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';

export default function OnboardingScreen() {
  const installCommand = 'curl -sL https://raw.githubusercontent.com/vibeshell/vibeshell/main/bridge/install.sh | bash';

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(installCommand);
    // Could add a toast here
  };

  const openFDroid = () => {
    Linking.openURL('https://f-droid.org/en/packages/com.termux/');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="terminal" size={48} color={theme.colors.brand.primary} />
        <Text style={styles.title}>Setup Termux Bridge</Text>
        <Text style={styles.subtitle}>
          VibeSHell needs a local background service in Termux to execute commands and access your files.
        </Text>
      </View>

      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <Text style={styles.stepTitle}>Install Termux</Text>
        </View>
        <Text style={styles.stepDesc}>
          If you don't have it, install Termux from F-Droid (Play Store version is deprecated).
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
          Open Termux and paste this command to install Node.js and setup the bridge server:
        </Text>
        
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{installCommand}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Ionicons name="copy-outline" size={20} color={theme.colors.text.inverse} />
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
          <Text style={styles.stepTitle}>Save Your Token</Text>
        </View>
        <Text style={styles.stepDesc}>
          The script will print an Auth Token at the end. Copy it and paste it in the VibeSHell Settings page to secure the connection.
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  header: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  title: {
    ...theme.typography.textStyles.title,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
    textAlign: 'center',
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
    borderRadius: 14,
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
});
