import React, { useRef, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useChatStore } from '../../src/store/useChatStore';
import { useWorkspaces } from '../../src/store/useWorkspaces';
import { ChatMessage, ChatInput } from '../../src/components';
import { theme } from '../../src/theme';

export default function ChatScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { workspaces } = useWorkspaces();
  const { messages, sendMessage, stopAgent, isRunning } = useChatStore();
  const flatListRef = useRef<FlatList>(null);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  if (!workspace) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: workspace.name,
          headerSubtitle: workspace.path,
        }} 
      />
      
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  list: {
    paddingVertical: theme.spacing.lg,
  },
});
