import { useEffect, useRef, useState } from 'react'
import {
  Modal, View, Text, Pressable, Animated, StyleSheet, Dimensions, ScrollView,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import { Copy, Check } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { ClawAvatar } from './ClawAvatar'
import { colors } from '@/lib/theme'
import type { Message } from '@/lib/types'

interface Props {
  visible: boolean
  onClose: () => void
  message: Message | null
  clawName?: string
  clawColor?: string
}

const { height: SCREEN_H } = Dimensions.get('window')

const markdownStyles = {
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 0 },
  code_inline: {
    backgroundColor: '#0a0a0d',
    color: '#a5f3fc',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontFamily: 'Menlo',
    fontSize: 13,
  },
  fence: {
    backgroundColor: '#0a0a0d',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  link: { color: colors.blueLight },
  strong: { fontWeight: '700' as const, color: colors.text },
  em: { fontStyle: 'italic' as const },
  bullet_list: { marginLeft: 0, marginVertical: 2 },
  ordered_list: { marginLeft: 0, marginVertical: 2 },
  heading1: { color: colors.text, fontSize: 18, fontWeight: '700' as const, marginVertical: 6 },
  heading2: { color: colors.text, fontSize: 16, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { color: colors.text, fontSize: 15, fontWeight: '600' as const, marginVertical: 3 },
}

const markdownRules = {
  text: (node: any, _children: any, _parent: any, styles: any, inheritedStyles: any = {}) => (
    <Text key={node.key} style={[inheritedStyles, styles.text]} selectable>
      {node.content}
    </Text>
  ),
}

export function MessageActionMenu({ visible, onClose, message, clawName = '?', clawColor = 'blue' }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visible) {
      setCopied(false)
      translateY.setValue(SCREEN_H * 0.5)
      backdropOpacity.setValue(0)
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260, mass: 0.9,
        }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    }
  }, [visible, translateY, backdropOpacity])

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H * 0.5, duration: 180, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose())
  }

  if (!message) return null
  const isUser = message.role === 'user'

  async function handleCopy() {
    if (!message) return
    await Clipboard.setStringAsync(message.content)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setCopied(true)
    setTimeout(handleClose, 500)
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        {/* Preview */}
        <ScrollView
          style={styles.preview}
          contentContainerStyle={styles.previewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={isUser ? styles.userRow : styles.clawRow}>
            {!isUser && (
              <View style={styles.avatarSlot}>
                <ClawAvatar name={clawName} color={clawColor} size={28} />
              </View>
            )}
            <View style={isUser ? styles.userBubble : styles.clawBubble}>
              {isUser ? (
                <Text style={styles.userText} selectable>{message.content}</Text>
              ) : (
                <Markdown style={markdownStyles} rules={markdownRules}>{message.content}</Markdown>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            {copied ? (
              <>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                  <Check size={18} color="#4ade80" strokeWidth={2.5} />
                </View>
                <Text style={[styles.actionLabel, { color: '#4ade80' }]}>Copied</Text>
              </>
            ) : (
              <>
                <View style={styles.actionIcon}>
                  <Copy size={18} color={colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.actionLabel}>Copy</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable onPress={handleClose} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a1a1c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2c2e',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38383a',
    marginBottom: 8,
  },
  preview: {
    maxHeight: SCREEN_H * 0.35,
  },
  previewContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '92%',
    backgroundColor: '#0a84ff',
    borderRadius: 18,
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
    gap: 8,
  },
  avatarSlot: {
    width: 28,
    marginBottom: 2,
  },
  clawBubble: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actions: {
    marginHorizontal: 16,
    backgroundColor: '#242426',
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  actionBtnPressed: {
    backgroundColor: '#323235',
  },
  actionIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#323235',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: '#242426',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.blueLight,
    fontSize: 16,
    fontWeight: '600',
  },
})
