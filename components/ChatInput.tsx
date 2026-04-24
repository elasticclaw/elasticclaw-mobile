import { useState, useRef } from "react"
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import { ArrowUp, Paperclip } from "lucide-react-native"
import { colors } from "@/lib/theme"
import type { PendingAttachment } from "@/lib/attachments"
import { PendingAttachmentChip } from "./AttachmentChip"

interface Props {
  onSend: (content: string, attachments: PendingAttachment[]) => Promise<boolean>
  onPickAttachments?: () => void
  pendingAttachments?: PendingAttachment[]
  onRemoveAttachment?: (localId: string) => void
  disabled?: boolean
}

export function ChatInput({
  onSend,
  onPickAttachments,
  pendingAttachments,
  onRemoveAttachment,
  disabled,
}: Props) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<TextInput>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if ((!trimmed && !pendingAttachments?.length) || disabled || isSending) return
    setIsSending(true)
    const success = await onSend(trimmed, pendingAttachments ?? [])
    if (success) {
      setText('')
    }
    setIsSending(false)
  }

  const canSend = (text.trim().length > 0 || (pendingAttachments && pendingAttachments.length > 0)) && !disabled && !isSending

  return (
    <View style={styles.wrap}>
      {pendingAttachments && pendingAttachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentRow}
          style={styles.attachmentScroll}
        >
          {pendingAttachments.map((att) => (
            <PendingAttachmentChip
              key={att.localId}
              attachment={att}
              onRemove={() => onRemoveAttachment?.(att.localId)}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.inputRow}>
        <TouchableOpacity
          onPress={onPickAttachments}
          style={styles.attachBtn}
          disabled={disabled}
        >
          <Paperclip size={20} color={disabled ? colors.textMuted : colors.text} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Message claw…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendBtn, { backgroundColor: canSend ? colors.blue : colors.elevated }]}
          activeOpacity={0.7}
        >
          <ArrowUp size={18} color={canSend ? colors.white : colors.textMuted} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  attachmentScroll: {
    maxHeight: 52,
    marginBottom: 6,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.input,
    borderRadius: 22,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  attachBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
    paddingRight: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
