import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { useOpenCodeStore } from '../src/store/useOpenCodeStore';
import { theme } from '../src/theme';

const { ProotModule } = NativeModules;

type SetupStep = 'environment' | 'services' | 'battery' | 'connect' | 'done';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingSeen } = useSettings();
  const { connect: connectBridge } = useBridgeStore();
  const { connect: connectOpenCode } = useOpenCodeStore();

  const [currentStep, setCurrentStep] = useState<SetupStep>('environment');
  const [statusMessage, setStatusMessage] = useState('Hazirlaniyor...');
  const [error, setError] = useState<string | null>(null);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [opencodeRunning, setOpencodeRunning] = useState(false);

  useEffect(() => {
    startSetup();
  }, []);

  const startSetup = async () => {
    try {
      // Step 1: Check environment
      setCurrentStep('environment');
      setStatusMessage('Ortam kontrol ediliyor...');

      const status = await ProotModule?.getBridgeStatus();

      if (status?.serviceRunning && status?.bridgeRunning && status?.opencodeRunning) {
        setStatusMessage('Tum servisler calisiyor');
        setCurrentStep('connect');
        await connectServices();
        return;
      }

      // Step 2: Start services (foreground service handles extraction + install)
      setCurrentStep('services');
      setStatusMessage('Linux ortami hazirlaniyor...');

      await ProotModule?.startBridgeService();

      // Poll until both services are up
      await pollServices();

      // Step 3: Battery optimization
      setCurrentStep('battery');
      setStatusMessage('Pil izni isteniyor...');
      try {
        await ProotModule?.requestBatteryOptimizationExemption();
      } catch {
        // Continue even if denied
      }

      // Step 4: Connect
      setCurrentStep('connect');
      setStatusMessage('Sunuculara baglaniyor...');
      await connectServices();

    } catch (err) {
      console.error('[Onboarding] Setup failed:', err);
      setError(err instanceof Error ? err.message : 'Kurulum basarisiz oldu');
    }
  };

  const pollServices = async () => {
    const maxAttempts = 120; // 2 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await ProotModule?.getBridgeStatus();

      if (status?.bridgeRunning) setBridgeRunning(true);
      if (status?.opencodeRunning) setOpencodeRunning(true);

      if (status?.bridgeRunning && status?.opencodeRunning) {
        setStatusMessage('Tum servisler hazir');
        return;
      }

      if (status?.bridgeRunning && !status?.opencodeRunning) {
        setStatusMessage('OpenCode sunucusu baslatiliyor...');
      } else if (!status?.bridgeRunning) {
        const progress = Math.min(70, 10 + attempts);
        if (progress < 30) {
          setStatusMessage('Proot indiriliyor...');
        } else if (progress < 50) {
          setStatusMessage('Linux ortami kuruluyor...');
        } else {
          setStatusMessage('Paketler kuruluyor...');
        }
      }

      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    throw new Error('Servisler zaman asimina ugradi');
  };

  const connectServices = async () => {
    try {
      // Connect to bridge
      connectBridge('ws://127.0.0.1:8765', '');

      // Connect to OpenCode
      await connectOpenCode('http://127.0.0.1:4096');

      setStatusMessage('Hazar!');
      setCurrentStep('done');
    } catch (err) {
      console.error('[Onboarding] Connection failed:', err);
      throw new Error('Sunuculara baglanamadi');
    }
  };

  const handleDone = async () => {
    await setOnboardingSeen();
    router.replace('/');
  };

  const isConnected = currentStep === 'done';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VibeShell Kurulumu</Text>
        <Text style={styles.subtitle}>{statusMessage}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Step 1: Environment */}
        <View style={[styles.step, currentStep === 'environment' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep !== 'environment' ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Linux Ortami</Text>
            <Text style={styles.stepDesc}>Proot + Alpine Linux + Node.js + OpenCode</Text>
          </View>
        </View>

        {/* Step 2: Services */}
        <View style={[styles.step, currentStep === 'services' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'services' ? (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            ) : (currentStep === 'battery' || currentStep === 'connect' || currentStep === 'done') ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Servisleri Baslat</Text>
            <Text style={styles.stepDesc}>
              Bridge ({bridgeRunning ? '✓' : '...'}) | OpenCode ({opencodeRunning ? '✓' : '...'})
            </Text>
          </View>
        </View>

        {/* Step 3: Battery */}
        <View style={[styles.step, currentStep === 'battery' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {(currentStep === 'connect' || currentStep === 'done') ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Pil Optimizasyonu</Text>
            <Text style={styles.stepDesc}>Arka planda calismasi icin izin</Text>
          </View>
        </View>

        {/* Step 4: Connect */}
        <View style={[styles.step, currentStep === 'connect' && styles.stepActive]}>
          <View style={styles.stepIcon}>
            {currentStep === 'done' ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.semantic.success} />
            ) : currentStep === 'connect' ? (
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            ) : (
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Baglan</Text>
            <Text style={styles.stepDesc}>Bridge ve OpenCode sunucularina baglan</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success */}
        {currentStep === 'done' && isConnected && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.semantic.success} />
            <Text style={styles.successText}>VibeShell hazir!</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {currentStep === 'done' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Basla</Text>
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
