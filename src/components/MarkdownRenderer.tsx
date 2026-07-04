import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Markdown, { ASTNode, RenderRules } from 'react-native-markdown-display';
import { theme } from '../theme';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { width } = useWindowDimensions();

  const rules: RenderRules = {
    code_block: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: any) => {
      return (
        <View key={node.key} style={markdownStyles.codeBlockContainer}>
          <Markdown
            style={{
              body: markdownStyles.codeBlockText,
            }}
          >
            {node.content}
          </Markdown>
        </View>
      );
    },
  };

  return (
    <Markdown
      style={markdownStyles}
      rules={rules}
    >
      {content}
    </Markdown>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text.primary,
  },
  heading1: {
    ...theme.typography.textStyles.hero,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heading2: {
    ...theme.typography.textStyles.title,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  heading3: {
    ...theme.typography.textStyles.heading,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    marginBottom: theme.spacing.md,
  },
  link: {
    color: theme.colors.brand.primary,
    textDecorationLine: 'underline',
  },
  list_item: {
    marginBottom: theme.spacing.xs,
  },
  bullet_list: {
    marginBottom: theme.spacing.md,
  },
  ordered_list: {
    marginBottom: theme.spacing.md,
  },
  code_inline: {
    ...theme.typography.textStyles.code,
    backgroundColor: theme.colors.backgrounds.elevated,
    color: theme.colors.brand.accent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 4,
  },
  codeBlockContainer: {
    backgroundColor: theme.colors.backgrounds.elevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borders.default,
  },
  codeBlockText: {
    ...theme.typography.textStyles.codeSmall,
    color: theme.colors.text.primary,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.brand.primary,
    paddingLeft: theme.spacing.md,
    opacity: 0.8,
    marginBottom: theme.spacing.md,
  },
});
