import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOpenCodeStore } from '../store/useOpenCodeStore';
import { useChatStore } from '../store/useChatStore';
import { theme } from '../theme';
import type { Session } from '../opencode/types';

export function SessionList({ onClose }: { onClose: () => void }) {
  const { sessions, setCurrentSession } = useOpenCodeStore();
  const { setSession } = useChatStore();

  const handleSelect = (session: Session) => {
    setCurrentSession(session.id);
    setSession(session.id);
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gecmis Oturumlar</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color={theme.colors.text.muted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
            <View style={styles.itemIcon}>
              <Ionicons name="chatbubble" size={16} color={theme.colors.brand.primary} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              <Text style={styles.itemDate}>
                {new Date((item as any).createdAt || Date.now()).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henuz oturum yok</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgrounds.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  title: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
  },
  itemDate: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  empty: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
  },
});
