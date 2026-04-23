import { useEffect, useState } from "react"
import {
  Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert,
} from "react-native"
import { X, Check, ChevronDown } from "lucide-react-native"
import { colors, COLOR_DOT } from "@/lib/theme"
import { CLAW_COLORS } from "@/lib/mappers"
import { fetchTemplates, type HubTemplate } from "@/lib/api"

interface Props {
  visible: boolean
  onClose: () => void
  onSpawn: (params: { template: string; name: string; color: string }) => Promise<void>
}

export function SpawnModal({ visible, onClose, onSpawn }: Props) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [color, setColor] = useState('blue')
  const [templates, setTemplates] = useState<HubTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [spawning, setSpawning] = useState(false)

  useEffect(() => {
    if (!visible) return
    setName('')
    setColor('blue')
    setTemplate('')
    setPicking(false)
    setLoadingTemplates(true)
    setTemplatesError(null)
    fetchTemplates()
      .then((t) => {
        setTemplates(t)
        if (t.length > 0) setTemplate(t[0].name)
      })
      .catch((err) => {
        setTemplatesError(err instanceof Error ? err.message : 'Failed to load templates')
      })
      .finally(() => setLoadingTemplates(false))
  }, [visible])

  async function handleSpawn() {
    if (!template.trim()) return
    setSpawning(true)
    try {
      await onSpawn({
        template: template.trim(),
        name: name.trim(),
        color,
      })
      onClose()
    } catch (err) {
      Alert.alert('Spawn failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSpawning(false)
    }
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
            <Text style={styles.title}>New Claw</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Template */}
            <Text style={styles.label}>Template</Text>
            {loadingTemplates ? (
              <View style={[styles.input, styles.loadingRow]}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.loadingText}>Loading templates…</Text>
              </View>
            ) : templatesError ? (
              <View style={styles.emptyBox}>
                <Text style={styles.error}>Couldn't load templates</Text>
                <Text style={styles.emptySub}>{templatesError}</Text>
              </View>
            ) : templates.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No templates on your hub</Text>
                <Text style={styles.emptySub}>
                  Push a template from the CLI first:{'\n'}
                  <Text style={styles.emptyCode}>elasticclaw template push</Text>
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setPicking((p) => !p)}
                  style={[styles.input, styles.dropdown]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownText, !template && { color: colors.textMuted }]}>
                    {template || 'Choose a template'}
                  </Text>
                  <ChevronDown
                    size={16}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: picking ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {picking && (
                  <View style={styles.dropdownList}>
                    {templates.map((t) => {
                      const selected = t.name === template
                      return (
                        <TouchableOpacity
                          key={t.name}
                          onPress={() => {
                            setTemplate(t.name)
                            setPicking(false)
                          }}
                          style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.dropdownItemText, selected && { color: colors.text, fontWeight: '600' }]}>
                            {t.name}
                          </Text>
                          {selected && <Check size={14} color={colors.blueLight} strokeWidth={2.5} />}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </>
            )}

            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional — auto-generated if blank"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Color */}
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
                      selected && styles.colorSwatchSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    {selected && <Check size={14} color="#000" strokeWidth={3} />}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Spawn */}
            {(() => {
              const canSpawn = !!template.trim() && templates.length > 0 && !spawning
              return (
                <TouchableOpacity
                  onPress={handleSpawn}
                  disabled={!canSpawn}
                  style={[
                    styles.spawnBtn,
                    { backgroundColor: canSpawn ? colors.blue : colors.elevated },
                  ]}
                  activeOpacity={0.85}
                >
                  {spawning ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={[
                      styles.spawnBtnText,
                      { color: canSpawn ? colors.white : colors.textMuted },
                    ]}>
                      Spawn Claw
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })()}
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
    maxHeight: '88%',
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
    paddingBottom: 8,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBox: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyCode: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: colors.text,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 6,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.elevated,
  },
  dropdownItemText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  colorSwatch: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: colors.text,
  },
  spawnBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  spawnBtnText: { fontSize: 15, fontWeight: '600' },
})
