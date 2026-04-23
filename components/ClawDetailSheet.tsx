import { useEffect, useState } from "react"
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Alert,
} from "react-native"
import { X, Pin, PinOff, RotateCcw, Trash2, Check, Plus } from "lucide-react-native"
import { colors, COLOR_DOT, COLOR_BORDER } from "@/lib/theme"
import { CLAW_COLORS, formatUptime } from "@/lib/mappers"
import { StatusDot } from "./StatusDot"
import type { Claw } from "@/lib/types"

interface Props {
  visible: boolean
  claw: Claw | null
  onClose: () => void
  onSave: (patch: { name?: string; tags?: string[]; color?: string }) => Promise<void>
  onTogglePin: (pinned: boolean) => void
  onNewSession: () => void
  onKill: () => void
}

export function ClawDetailSheet({ visible, claw, onClose, onSave, onTogglePin, onNewSession, onKill }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('blue')
  const [tags, setTags] = useState<string[]>([])
  const [tagKey, setTagKey] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (claw) {
      setName(claw.name)
      setColor(claw.color)
      setTags(claw.tags)
      setTagKey('')
      setTagValue('')
    }
  }, [claw, visible])

  if (!claw) return null

  const dirty =
    name.trim() !== claw.name ||
    color !== claw.color ||
    JSON.stringify([...tags].sort()) !== JSON.stringify([...claw.tags].sort())

  async function handleSave() {
    if (!claw || !dirty) return
    setSaving(true)
    try {
      const patch: { name?: string; tags?: string[]; color?: string } = {}
      if (name.trim() !== claw.name) patch.name = name.trim()
      if (color !== claw.color) patch.color = color
      if (JSON.stringify([...tags].sort()) !== JSON.stringify([...claw.tags].sort())) patch.tags = tags
      await onSave(patch)
      onClose()
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  function addTag() {
    const key = tagKey.trim()
    const value = tagValue.trim()
    if (!key) return
    const tag = value ? `${key}=${value}` : key
    if (!tags.includes(tag)) setTags([...tags, tag])
    setTagKey('')
    setTagValue('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.wrap}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <StatusDot status={claw.status} isStreaming={claw.isStreaming} size={10} />
              <Text style={styles.title}>Claw details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Meta */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Template</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{claw.template}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>{claw.status}</Text>
            </View>
            {claw.status === 'connected' && claw.uptime > 0 && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Uptime</Text>
                <Text style={styles.metaValue}>{formatUptime(claw.uptime)}</Text>
              </View>
            )}
            {claw.contextUsage > 0 && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Context</Text>
                <Text style={styles.metaValue}>{claw.contextUsage}%</Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Color picker */}
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {CLAW_COLORS.map((c) => {
                const selected = color === c
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: COLOR_DOT[c] },
                      selected && { borderColor: colors.text, borderWidth: 2 },
                    ]}
                    activeOpacity={0.7}
                  >
                    {selected && <Check size={14} color="#000" strokeWidth={3} />}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Tags */}
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.input, styles.tagInput]}
                value={tagKey}
                onChangeText={setTagKey}
                placeholder="key"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.tagInput]}
                value={tagValue}
                onChangeText={setTagValue}
                placeholder="value (optional)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={addTag}
                disabled={!tagKey.trim()}
                style={[styles.addBtn, { backgroundColor: tagKey.trim() ? colors.blue : colors.elevated }]}
              >
                <Plus size={16} color={tagKey.trim() ? colors.white : colors.textMuted} />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagList}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => removeTag(tag)}
                    style={styles.tagChip}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <X size={11} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Save */}
            {dirty && (
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={styles.saveBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            {/* Actions */}
            <TouchableOpacity
              onPress={() => onTogglePin(!claw.pinned)}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              {claw.pinned
                ? <PinOff size={18} color={colors.text} />
                : <Pin size={18} color={colors.text} />
              }
              <Text style={styles.actionText}>
                {claw.pinned ? 'Unpin' : 'Pin to top'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onNewSession()
                onClose()
              }}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <RotateCcw size={18} color={colors.text} />
              <Text style={styles.actionText}>New session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Kill claw', `Terminate ${claw.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Kill',
                    style: 'destructive',
                    onPress: () => {
                      onKill()
                      onClose()
                    },
                  },
                ])
              }}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color={colors.red} />
              <Text style={[styles.actionText, { color: colors.red }]}>Kill claw</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: { color: colors.textMuted, fontSize: 13 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '500', maxWidth: '70%' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  colorSwatch: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tagInput: { flex: 1 },
  addBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.elevated,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
  },
  tagChipText: { color: colors.text, fontSize: 12 },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.blue,
  },
  saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '500' },
})
