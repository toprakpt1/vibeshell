import React, { useRef, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../src/store/useChatStore';
import { useWorkspaces } from '../../src/store/useWorkspaces';
import { useOpenCodeStore } from '../../src/store/useOpenCodeStore';
import { ChatMessage, ChatInput, AgentSelector, TerminalPanel, SessionList } from '../../src/components';
import { theme } from '../../src/theme';
import type { UIMessage } from '../../src/opencode/types';

type Panel = 'chat' | 'terminal' | 'split';

export default function ChatScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { workspaces } = useWorkspaces();
  const { messages, sendMessage, stopAgent, isRunning } = useChatStore();
  const { connected } = useOpenCodeStore();
  const flatListRef = useRef<FlatList>(null);
  const [panel, setPanel] = useState<Panel>('chat');
  const [showSessions, setShowSessions] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  if (!workspace) {
    return <View style={styles.container} />;
  }

  const renderPanelToggle = () => (
    <View style={styles.panelToggle}>
      <TouchableOpacity
        style={[styles.panelBtn, panel === 'chat' && styles.panelBtnActive]}
        onPress={() => setPanel('chat')}
      >
        <Ionicons name="chatbubble" size={16} color={panel === 'chat' ? theme.colors.brand.primary : theme.colors.text.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.panelBtn, panel === 'split' && styles.panelBtnActive]}
        onPress={() => setPanel('split')}
      >
        <Ionicons name="expand" size={16} color={panel === 'split' ? theme.colors.brand.primary : theme.colors.text.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.panelBtn, panel === 'terminal' && styles.panelBtnActive]}
        onPress={() => setPanel('terminal')}
      >
        <Ionicons name="terminal" size={16} color={panel === 'terminal' ? theme.colors.brand.primary : theme.colors.text.muted} />
      </TouchableOpacity>
    </View>
  );

  const renderChat = () => (
    <View style={panel === 'split' ? styles.splitChat : styles.fullChat}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <ChatInput
        onSend={sendMessage}
        onStop={stopAgent}
        isRunning={isRunning}
      />
    </View>
  );

  const renderTerminal = () => (
    <View style={panel === 'split' ? styles.splitTerminal : styles.fullTerminal}>
      <TerminalPanel visible={panel === 'terminal' || panel === 'split'} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: workspace.name,
          headerRight: () => (
            <View style={styles.headerRight}>
              <AgentSelector />
              <TouchableOpacity onPress={() => setShowSessions(true)}>
                <Ionicons name="time" size={20} color={theme.colors.text.muted} />
              </TouchableOpacity>
              {renderPanelToggle()}
            </View>
          ),
        }}
      />

      {panel === 'split' ? (
        <View style={styles.splitContainer}>
          {renderChat()}
          <View style={styles.separator} />
          {renderTerminal()}
        </View>
      ) : panel === 'chat' ? (
        renderChat()
      ) : (
        renderTerminal()
      )}

      {showSessions && (
        <View style={styles.sessionsOverlay}>
          <SessionList onClose={() => setShowSessions(false)} />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  panelToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    overflow: 'hidden',
  },
  panelBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  panelBtnActive: {
    backgroundColor: theme.colors.brand.primaryMuted,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  fullChat: {
    flex: 1,
  },
  fullTerminal: {
    flex: 1,
  },
  splitChat: {
    flex: 1,
  },
  splitTerminal: {
    flex: 1,
  },
  separator: {
    width: 1,
    backgroundColor: theme.colors.borders.default,
  },
  list: {
    paddingVertical: theme.spacing.lg,
  },
  sessionsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.backgrounds.base,
    zIndex: 100,
  },
});
