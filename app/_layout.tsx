import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../src/store/useSettings';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { theme } from '../src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootLayout() {
  const { loadSettings, isLoaded, bridgeUrl, bridgeToken } = useSettings();
  const { connect } = useBridgeStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isLoaded && bridgeUrl) {
      connect(bridgeUrl, bridgeToken);
    }
  }, [isLoaded, bridgeUrl, bridgeToken, connect]);

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
          headerStyle: {
            backgroundColor: theme.colors.backgrounds.base,
          },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            ...theme.typography.textStyles.title,
            color: theme.colors.text.primary,
          },
          contentStyle: {
            backgroundColor: theme.colors.backgrounds.base,
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'VibeSHell',
            headerLargeTitle: true,
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Settings',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            title: 'Setup Termux',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="chat/[workspaceId]" 
          options={{ 
            title: 'Workspace',
            headerBackTitle: 'Back',
          }} 
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
