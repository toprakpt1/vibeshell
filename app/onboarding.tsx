import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/bridge';
import { theme } from '../src/theme';

const { ProotModule } = NativeModules;

type SetupStep = 'download' | 'extract' | 'battery' | 'start' | 'done';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingSeen } = useSettings();
  const { connect, connectionState } = useBridgeStore();

  const [currentStep, setCurrentStep] = useState<SetupStep>('download');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Preparing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startSetup();
  }, []);

  const startSetup = async () => {
    try {
      // Step 1: Check if already installed
      setCurrentStep('download');
      setStatusMessage('Checking environment...');

      const isInstalled = await ProotModule?.isProotInstalled();
      if (isInstalled) {
        setStatusMessage('Already installed, starting...');
        setDownloadProgress(100);
        setCurrentStep('start');
        await startBridge();
        return;
      }

      // Step 2: Download + extract (foreground service handles both)
      setStatusMessage('Downloading Linux environment...');
      setDownloadProgress(10);

      await ProotModule?.startBridgeService();

      // Poll progress until bridge is ready
      await pollInstallProgress();

      // Step 3: Battery optimization
      setCurrentStep('battery');
      setStatusMessage('Requesting battery permission...');
      setDownloadProgress(80);

      try {
        await ProotModule?.requestBatteryOptimizationExemption();
      } catch {
        // Continue even if user denies
      }

      // Step 4: Start bridge
      setCurrentStep('start');
      setStatusMessage('Starting bridge...');
      setDownloadProgress(90);

      await startBridge();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
  };

  const pollInstallProgress = async () => {
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await ProotModule?.getBridgeStatus();
      const installed = status?.prootInstalled ?? false;
      const running = status?.serviceRunning ?? false;

      if (installed && running) {
        setDownloadProgress(70);
        setStatusMessage('Environment ready');
        return;
      }

      if (installed) {
        setDownloadProgress(60);
        setStatusMessage('Starting services...');
        return;
      }

      // Increment progress visually
      const progress = Math.min(50, 10 + attempts * 2);
      setDownloadProgress(progress);

      if (progress < 25) {
        setStatusMessage('Downloading proot binary...');
      } else if (progress < 40) {
        setStatusMessage('Downloading Debian rootfs...');
      } else {
        setStatusMessage('Installing Node.js...');
      }

      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    throw new Error('Installation timed out');
  };

  const startBridge = async () => {
    try {
      await ProotModule?.startBridgeService();

      // Wait for bridge to be reachable
      let attempts = 0;
      while (attempts < 30) {
        const running = await ProotModule?.isBridgeRunning();
        if (running) break;
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
      }

      connect('ws://127.0.0.1:8765', '');
      setDownloadProgress(100);
      setCurrentStep('done');
      setStatusMessage('Ready!');
    } catch (err) {
      setError('Failed to start bridge service');
    }
  };

  const handleDone = async () => {
    await setOnboardingSeen();
    router.replace('/');
  };

  const isConnected = connectionState === 'connected';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Setting up VibeShell</Text>
        <Text style={styles.subtitle}>
          {statusMessage}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Download Step */}
        <View style={[styles.step, currentStep === 'download' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'download' ? (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            ) : downloadProgress === 100 ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Downloading Linux environment</Text>
            <Text style={styles.stepDesc}>Alpine Linux + Node.js runtime</Text>
            {currentStep === 'download' && (
              <>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{downloadProgress}%</Text>
              </>
            )}
          </View>
        </View>

        {/* Extract Step */}
        <View style={[styles.step, currentStep === 'extract' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'extract' ? (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            ) : (currentStep === 'battery' || currentStep === 'start' || currentStep === 'done') ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Preparing environment</Text>
            <Text style={styles.stepDesc}>Extracting files and setting up proot</Text>
          </View>
        </View>

        {/* Battery Optimization Step */}
        <View style={[styles.step, currentStep === 'battery' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'battery' ? (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            ) : (currentStep === 'start' || currentStep === 'done') ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Battery optimization</Text>
            <Text style={styles.stepDesc}>
              Allow VibeShell to run in background
            </Text>
          </View>
        </View>

        {/* Start Bridge Step */}
        <View style={[styles.step, currentStep === 'start' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'start' ? (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            ) : currentStep === 'done' ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Starting bridge service</Text>
            <Text style={styles.stepDesc}>Connecting to local environment</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Done */}
        {currentStep === 'done' && isConnected && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.semantic.success} />
            <Text style={styles.successText}>VibeShell is ready</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {currentStep === 'done' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  title: {
    ...theme.typography.textStyles.heading,
    fontSize: 20,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
    opacity: 0.5,
  },
  stepActive: {
    opacity: 1,
  },
  stepIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaces.surface,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeights.medium,
    marginBottom: theme.spacing.xs,
  },
  stepDesc: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.secondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: 2,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.brand.primary,
  },
  progressText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.semantic.errorMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.semantic.error,
  },
  errorText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.semantic.error,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.semantic.successMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.semantic.success,
  },
  successText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.semantic.success,
    fontWeight: theme.typography.fontWeights.medium,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borders.default,
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
});
