import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { useOpenCodeStore } from '../src/store/useOpenCodeStore';
import { theme } from '../src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootLayout() {
  const { loadSettings, isLoaded, openCodeUrl, openCodePassword, bridgeUrl, bridgeToken, hasSeenOnboarding } = useSettings();
  const { connect: connectBridge } = useBridgeStore();
  const { connect: connectOpenCode } = useOpenCodeStore();
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Connect to OpenCode server
  useEffect(() => {
    if (isLoaded && openCodeUrl) {
      connectOpenCode(openCodeUrl, openCodePassword || undefined);
    }
  }, [isLoaded, openCodeUrl, openCodePassword, connectOpenCode]);

  // Connect to bridge (for terminal)
  useEffect(() => {
    if (isLoaded && bridgeUrl) {
      connectBridge(bridgeUrl, bridgeToken);
    }
  }, [isLoaded, bridgeUrl, bridgeToken, connectBridge]);

  // Redirect to onboarding if not seen
  useEffect(() => {
    if (isLoaded && !hasSeenOnboarding) {
      router.replace('/onboarding');
    }
  }, [isLoaded, hasSeenOnboarding, router]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.backgrounds.base },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            ...theme.typography.textStyles.title,
            color: theme.colors.text.primary,
          },
          contentStyle: { backgroundColor: theme.colors.backgrounds.base },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'VibeSHell', headerLargeTitle: true }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Ayarlar', presentation: 'modal' }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ title: 'Kurulum', presentation: 'modal' }}
        />
        <Stack.Screen
          name="chat/[workspaceId]"
          options={{ title: 'Workspace', headerBackTitle: 'Geri' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
