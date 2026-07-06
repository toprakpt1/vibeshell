import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, NativeModules, NativeEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { useOpenCodeStore } from '../src/store/useOpenCodeStore';
import { theme } from '../src/theme';

const { ProotModule } = NativeModules;
const prootEmitter = new NativeEventEmitter(ProotModule);

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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugScrollRef = useRef<ScrollView>(null);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLogs(prev => [...prev.slice(-80), `[${ts}] ${msg}`]);
  };

  useEffect(() => {
    // Listen for native service events
    const subs = [
      prootEmitter.addListener('SERVICE_ERROR', (data) => {
        addLog(`SERVICE_ERROR: ${data}`);
        setError(`Servis hatasi: ${data}`);
      }),
      prootEmitter.addListener('BRIDGE_STDOUT', (data) => {
        addLog(`BRIDGE: ${data}`);
      }),
      prootEmitter.addListener('BRIDGE_STDERR', (data) => {
        addLog(`BRIDGE ERR: ${data}`);
      }),
      prootEmitter.addListener('BRIDGE_EXIT', (data) => {
        addLog(`BRIDGE EXITED: code=${data}`);
      }),
      prootEmitter.addListener('OPENCODE_STDOUT', (data) => {
        addLog(`OPENCODE: ${data}`);
      }),
      prootEmitter.addListener('OPENCODE_STDERR', (data) => {
        addLog(`OPENCODE ERR: ${data}`);
      }),
      prootEmitter.addListener('OPENCODE_EXIT', (data) => {
        addLog(`OPENCODE EXITED: code=${data}`);
      }),
      prootEmitter.addListener('HEALTH_CHECK', (data) => {
        addLog(`HEALTH: ${data}`);
      }),
    ];

    startSetup();

    return () => subs.forEach(s => s.remove());
  }, []);

  useEffect(() => {
    // Auto-scroll debug panel
    debugScrollRef.current?.scrollToEnd({ animated: false });
  }, [debugLogs]);

  const startSetup = async () => {
    try {
      addLog('=== VibeShell kurulumu basliyor ===');

      // Step 1: Check environment
      setCurrentStep('environment');
      setStatusMessage('Ortam kontrol ediliyor...');

      addLog('Checking bridge status...');
      const status = await ProotModule?.getBridgeStatus();
      addLog(`Initial status: proot=${status?.prootInstalled} rootfs=${status?.rootfsExtracted} service=${status?.serviceRunning} bridge=${status?.bridgeRunning} opencode=${status?.opencodeRunning}`);

      if (status?.serviceRunning && status?.bridgeRunning && status?.opencodeRunning) {
        addLog('All services already running, connecting...');
        setStatusMessage('Tum servisler calisiyor');
        setCurrentStep('connect');
        await connectServices();
        return;
      }

      // Step 2: Start services
      setCurrentStep('services');
      setStatusMessage('Linux ortami hazirlaniyor...');
      addLog('Starting bridge service...');

      await ProotModule?.startBridgeService();
      addLog('startBridgeService called, polling for status...');

      // Poll until both services are up
      await pollServices();

      // Step 3: Battery optimization
      setCurrentStep('battery');
      setStatusMessage('Pil izni isteniyor...');
      addLog('Requesting battery optimization exemption...');
      try {
        await ProotModule?.requestBatteryOptimizationExemption();
        addLog('Battery optimization requested');
      } catch (e) {
        addLog('Battery optimization denied or failed');
      }

      // Step 4: Connect
      setCurrentStep('connect');
      setStatusMessage('Sunuculara baglaniyor...');
      addLog('Connecting to bridge and opencode...');
      await connectServices();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kurulum basarisiz oldu';
      addLog(`SETUP FAILED: ${msg}`);
      console.error('[Onboarding] Setup failed:', err);
      setError(msg);
    }
  };

  const pollServices = async () => {
    const maxAttempts = 120; // 2 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      let status: any = null;
      try {
        status = await ProotModule?.getBridgeStatus();
      } catch (e) {
        addLog(`Poll attempt ${attempts + 1}: getBridgeStatus FAILED - ${e}`);
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
        continue;
      }

      const s = status;
      const statusStr = `proot=${s?.prootInstalled} rootfs=${s?.rootfsExtracted} svc=${s?.serviceRunning} br=${s?.bridgeRunning} oc=${s?.opencodeRunning}`;

      if (attempts % 5 === 0 || s?.bridgeRunning || s?.opencodeRunning) {
        addLog(`Poll #${attempts + 1}: ${statusStr}`);
      }

      if (s?.bridgeRunning) setBridgeRunning(true);
      if (s?.opencodeRunning) setOpencodeRunning(true);

      if (s?.bridgeRunning && s?.opencodeRunning) {
        addLog('Both services UP!');
        setStatusMessage('Tum servisler hazir');
        return;
      }

      if (s?.bridgeRunning && !s?.opencodeRunning) {
        setStatusMessage('OpenCode sunucusu baslatiliyor...');
      } else if (!s?.bridgeRunning) {
        const progress = Math.min(70, 10 + attempts);
        if (progress < 30) {
          setStatusMessage('Proot indiriliyor...');
        } else if (progress < 50) {
          setStatusMessage('Linux ortami kuruluyor...');
        } else {
          setStatusMessage('Servisler baslatiliyor...');
        }
      }

      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    addLog(`TIMEOUT after ${maxAttempts} attempts`);
    throw new Error('Servisler zaman asimina ugradi - loglari kontrol edin');
  };

  const connectServices = async () => {
    try {
      addLog('Connecting to bridge ws://127.0.0.1:8765...');
      connectBridge('ws://127.0.0.1:8765', '');

      addLog('Connecting to opencode http://127.0.0.1:4096...');
      await connectOpenCode('http://127.0.0.1:4096');

      addLog('All connections established!');
      setStatusMessage('Hazar!');
      setCurrentStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sunuculara baglanamadi';
      addLog(`CONNECTION FAILED: ${msg}`);
      console.error('[Onboarding] Connection failed:', err);
      throw new Error(msg);
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
        {/* Steps */}
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
              Bridge ({bridgeRunning ? 'UP' : '...'}) | OpenCode ({opencodeRunning ? 'UP' : '...'})
            </Text>
          </View>
        </View>

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

        {/* DEBUG LOG PANEL */}
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>DEBUG LOGS</Text>
          <ScrollView
            ref={debugScrollRef}
            style={styles.debugScroll}
            showsVerticalScrollIndicator={true}
          >
            {debugLogs.map((log, i) => (
              <Text key={i} style={styles.debugLine}>{log}</Text>
            ))}
          </ScrollView>
        </View>
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
  debugPanel: {
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: '#0D1117',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#30363D',
    maxHeight: 300,
  },
  debugTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#58A6FF',
    marginBottom: theme.spacing.sm,
    fontWeight: 'bold',
  },
  debugScroll: {
    maxHeight: 250,
  },
  debugLine: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#8B949E',
    lineHeight: 14,
    marginBottom: 1,
  },
});
