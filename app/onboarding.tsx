import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/bridge';
import { ProotManager } from '../src/native/ProotModule';
import { theme } from '../src/theme';

type SetupStep = 'download' | 'extract' | 'battery' | 'start' | 'done';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingSeen } = useSettings();
  const { connect, connectionState } = useBridgeStore();
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('download');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const prootManager = ProotManager.getInstance();

  // Start setup when component mounts
  useEffect(() => {
    startSetup();
  }, []);

  const startSetup = async () => {
    try {
      // Step 1: Download rootfs
      setCurrentStep('download');
      await downloadRootfs();

      // Step 2: Extract rootfs
      setCurrentStep('extract');
      await extractRootfs();

      // Step 3: Request battery optimization
      setCurrentStep('battery');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
  };

  const downloadRootfs = async () => {
    // Simulate download (gerçek implementasyonda GitHub API kullan)
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setDownloadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve(true);
        }
      }, 300);
    });
  };

  const extractRootfs = async () => {
    // Simulate extraction
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const handleBatteryOptimization = async () => {
    try {
      await prootManager.ensureBatteryOptimization();
      setCurrentStep('start');
      await startBridge();
    } catch (err) {
      console.error('Battery opt error:', err);
      setCurrentStep('start');
      await startBridge();
    }
  };

  const startBridge = async () => {
    try {
      await prootManager.startBridge();
      connect('ws://127.0.0.1:8765', '');
      setCurrentStep('done');
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
          Installing Linux environment · This will take a few minutes
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
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
              </View>
            )}
            {currentStep === 'download' && (
              <Text style={styles.progressText}>{downloadProgress}% · ~25 MB</Text>
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
            {currentStep === 'battery' && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleBatteryOptimization}
              >
                <Text style={styles.actionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            )}
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
  actionButton: {
    backgroundColor: theme.colors.brand.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
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
