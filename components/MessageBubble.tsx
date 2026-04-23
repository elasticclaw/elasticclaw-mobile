import { View, Text, StyleSheet, Animated, Pressable } from "react-native"
import Markdown from "react-native-markdown-display"
import * as Haptics from "expo-haptics"
import * as Clipboard from "expo-clipboard"
import { useEffect, useRef } from "react"
import { ClawAvatar } from "./ClawAvatar"
import { colors, BUBBLE_TINT } from "@/lib/theme"
import type { Message } from "@/lib/types"
import type { TypewriterState } from "@/hooks/use-typewriter"

async function copyWithFeedback(content: string, onCopied?: () => void) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  await Clipboard.setStringAsync(content)
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  onCopied?.()
}

interface Props {
  message: Message
  clawName?: string
  clawColor?: string
  showAvatar?: boolean
  onCopied?: () => void
}

const markdownRules = {
  text: (node: any, _children: any, _parent: any, styles: any, inheritedStyles: any = {}) => (
    <Text key={node.key} style={[inheritedStyles, styles.text]} selectable>
      {node.content}
    </Text>
  ),
}

const markdownStyles = {
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 4, color: colors.text },
  text: { color: colors.text },

  // Inline
  code_inline: {
    backgroundColor: '#0a0a0d',
    color: '#a5f3fc',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontFamily: 'Menlo',
    fontSize: 13,
  },
  strong: { fontWeight: '700' as const, color: colors.text },
  em: { fontStyle: 'italic' as const, color: colors.text },
  s: { textDecorationLine: 'line-through' as const, color: colors.textMuted },
  link: { color: colors.blueLight },

  // Code blocks
  fence: {
    backgroundColor: '#0a0a0d',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    fontFamily: 'Menlo',
    fontSize: 12,
    color: colors.text,
    borderWidth: 0,
  },
  code_block: {
    backgroundColor: '#0a0a0d',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    fontFamily: 'Menlo',
    fontSize: 12,
    color: colors.text,
    borderWidth: 0,
  },

  // Headings
  heading1: { color: colors.text, fontSize: 18, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
  heading2: { color: colors.text, fontSize: 16, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
  heading3: { color: colors.text, fontSize: 15, fontWeight: '600' as const, marginTop: 4, marginBottom: 2 },
  heading4: { color: colors.text, fontSize: 14, fontWeight: '600' as const, marginTop: 4, marginBottom: 2 },
  heading5: { color: colors.text, fontSize: 13, fontWeight: '600' as const, marginTop: 2, marginBottom: 2 },
  heading6: { color: colors.textMuted, fontSize: 12, fontWeight: '600' as const, marginTop: 2, marginBottom: 2 },

  // Horizontal rule
  hr: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    borderWidth: 0,
  },

  // Blockquote
  blockquote: {
    backgroundColor: 'transparent',
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: 10,
    marginLeft: 0,
    marginVertical: 4,
  },

  // Lists
  bullet_list: { marginLeft: 0, marginVertical: 2 },
  ordered_list: { marginLeft: 0, marginVertical: 2 },
  list_item: { marginVertical: 1, color: colors.text },
  bullet_list_icon: { color: colors.text, marginLeft: 2, marginRight: 6 },
  bullet_list_content: { color: colors.text, flex: 1 },
  ordered_list_icon: { color: colors.text, marginLeft: 2, marginRight: 6 },
  ordered_list_content: { color: colors.text, flex: 1 },

  // Tables
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  thead: { backgroundColor: colors.elevated },
  tbody: { backgroundColor: 'transparent' },
  th: {
    padding: 8,
    color: colors.text,
    fontWeight: '600' as const,
    backgroundColor: colors.elevated,
  },
  tr: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: 'transparent',
    flexDirection: 'row' as const,
  },
  td: {
    padding: 8,
    color: colors.text,
    backgroundColor: 'transparent',
    flex: 1,
  },

  // Images
  image: { borderRadius: 6 },
}

function ThinkingDots() {
  const a = useRef(new Animated.Value(0.3)).current
  const b = useRef(new Animated.Value(0.3)).current
  const c = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )
    const loops = [make(a, 0), make(b, 160), make(c, 320)]
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [a, b, c])

  return (
    <View style={dotStyles.row}>
      <Animated.View style={[dotStyles.dot, { opacity: a }]} />
      <Animated.View style={[dotStyles.dot, { opacity: b }]} />
      <Animated.View style={[dotStyles.dot, { opacity: c }]} />
    </View>
  )
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
})

export function MessageBubble({ message, clawName = '?', clawColor = 'blue', showAvatar = true, onCopied }: Props) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const bubbleTint = BUBBLE_TINT[clawColor] ?? '#1c1c1e'

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <View style={styles.systemLine} />
        <Text style={styles.systemText}>{message.content}</Text>
        <View style={styles.systemLine} />
      </View>
    )
  }

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Pressable onLongPress={() => copyWithFeedback(message.content, onCopied)} delayLongPress={260}>
            <Text style={styles.userText}>{message.content}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.clawRow}>
      <View style={styles.avatarSlot}>
        {showAvatar ? <ClawAvatar name={clawName} color={clawColor} size={28} /> : null}
      </View>
      <View style={[styles.clawBubble, { backgroundColor: bubbleTint }]}>
        <Pressable onLongPress={() => copyWithFeedback(message.content, onCopied)} delayLongPress={260}>
          <Markdown style={markdownStyles} rules={markdownRules}>{message.content}</Markdown>
        </Pressable>
      </View>
    </View>
  )
}

export function StreamingBubble({ clawName = '?', clawColor = 'blue', state }: { clawName?: string; clawColor?: string; state: TypewriterState }) {
  const bubbleTint = BUBBLE_TINT[clawColor] ?? '#1c1c1e'
  return (
    <View style={styles.clawRow}>
      <View style={styles.avatarSlot}>
        <ClawAvatar name={clawName} color={clawColor} size={28} />
      </View>
      <View style={[styles.clawBubble, { backgroundColor: bubbleTint }]}>
        {!state.hadChunks ? (
          <ThinkingDots />
        ) : state.isPaused ? (
          <>
            {state.text ? <Markdown style={markdownStyles} rules={markdownRules}>{state.text}</Markdown> : null}
            <View style={styles.toolGap} />
            <ThinkingDots />
          </>
        ) : (
          <Markdown style={markdownStyles} rules={markdownRules}>{state.text || ' '}</Markdown>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: '#0a84ff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
  },
  clawRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    gap: 8,
  },
  avatarSlot: {
    width: 28,
    marginBottom: 2,
  },
  clawBubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  systemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
    paddingHorizontal: 8,
  },
  systemLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  systemText: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  toolGap: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
})
