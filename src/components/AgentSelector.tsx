import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOpenCodeStore } from '../store/useOpenCodeStore';
import { theme } from '../theme';
import type { Agent } from '../opencode/types';

export function AgentSelector() {
  const [visible, setVisible] = useState(false);
  const { agents, selectedAgent, setSelectedAgent } = useOpenCodeStore();

  const selected = agents.find((a) => a.name === selectedAgent);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)}>
        <Ionicons name="git-branch" size={16} color={theme.colors.brand.primary} />
        <Text style={styles.buttonText}>{selected?.name || 'Agent'}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.text.muted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>Agent Sec</Text>
            <FlatList
              data={agents}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.item,
                    selectedAgent === item.name && styles.itemSelected,
                  ]}
                  onPress={() => {
                    setSelectedAgent(item.name);
                    setVisible(false);
                  }}
                >
                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.itemText,
                        selectedAgent === item.name && styles.itemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text style={styles.itemDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                  {selectedAgent === item.name && (
                    <Ionicons name="checkmark" size={18} color={theme.colors.brand.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaces.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
  },
  buttonText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.text.primary,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.backgrounds.base,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '50%',
  },
  title: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borders.default,
  },
  itemSelected: {
    backgroundColor: theme.colors.brand.primaryMuted,
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
  },
  itemTextSelected: {
    color: theme.colors.brand.primary,
  },
  itemDesc: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
});
