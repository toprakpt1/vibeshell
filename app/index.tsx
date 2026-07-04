import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkspaces } from '../src/store/useWorkspaces';
import { useBridgeStore } from '../src/store/useBridgeStore';
import { ConnectionStatus, WorkspaceCard } from '../src/components';
import { theme } from '../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { workspaces, addWorkspace, removeWorkspace, setActiveWorkspace } = useWorkspaces();
  const { connectionState } = useBridgeStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('~/projects/');

  const handleOpenWorkspace = (id: string) => {
    setActiveWorkspace(id);
    router.push(`/chat/${id}`);
  };

  const handleCreateWorkspace = () => {
    if (newName.trim() && newPath.trim()) {
      const workspace = addWorkspace(newName.trim(), newPath.trim());
      setIsAdding(false);
      setNewName('');
      setNewPath('~/projects/');
      handleOpenWorkspace(workspace.id);
    }
  };

  return (
    <View style={styles.container}>
      <ConnectionStatus />
      
      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <TouchableOpacity 
          style={styles.setupBanner}
          onPress={() => router.push('/onboarding')}
        >
          <Ionicons name="hardware-chip-outline" size={16} color={theme.colors.brand.primary} />
          <Text style={styles.setupBannerText}>Bridge not running — tap to set up</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.text.muted} />
        </TouchableOpacity>
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>Workspaces</Text>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => router.push('/onboarding')}
          >
            <Ionicons name="help-circle-outline" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WorkspaceCard
            workspace={item}
            onPress={() => handleOpenWorkspace(item.id)}
            onDelete={() => removeWorkspace(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isAdding ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.text.muted} />
              <Text style={styles.emptyText}>No workspaces yet</Text>
              <Text style={styles.emptySubtext}>Create one to start coding</Text>
            </View>
          ) : null
        }
      />

      {isAdding ? (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>New Workspace</Text>
          
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. My App"
            placeholderTextColor={theme.colors.text.muted}
            autoFocus
          />
          
          <Text style={styles.label}>Termux Path</Text>
          <TextInput
            style={styles.input}
            value={newPath}
            onChangeText={setNewPath}
            placeholder="e.g. ~/projects/myapp"
            placeholderTextColor={theme.colors.text.muted}
            autoCapitalize="none"
          />
          
          <View style={styles.formActions}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => setIsAdding(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.createButton]} 
              onPress={handleCreateWorkspace}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.fabContainer}>
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => setIsAdding(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color={theme.colors.text.inverse} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    ...theme.typography.textStyles.title,
    color: theme.colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.sm,
  },
  list: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyText: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.xs,
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.brand.primaryMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.brand.primary,
  },
  setupBannerText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.brand.primary,
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surfaces.surface,
    padding: theme.spacing.lg,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borders.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  formTitle: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.textStyles.label,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.backgrounds.base,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.muted,
  },
  createButton: {
    backgroundColor: theme.colors.brand.primary,
  },
  createButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.inverse,
    fontWeight: theme.typography.fontWeights.medium,
  },
});
