import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSettings } from '../store/useSettings';
import { theme } from '../theme';

interface TerminalPanelProps {
  visible?: boolean;
}

export function TerminalPanel({ visible = true }: TerminalPanelProps) {
  const { bridgeUrl, bridgeToken } = useSettings();

  const injectedJS = `
    window.setConfig('${bridgeUrl}', '${bridgeToken}');
    true;
  `;

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={require('../../assets/terminal.html')}
        style={styles.webview}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled={false}
        startInLoadingState={false}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  webview: {
    flex: 1,
  },
});
