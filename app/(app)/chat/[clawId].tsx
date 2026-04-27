import { useEffect, useRef, useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, RotateCcw, Info } from 'lucide-react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { ClawDetailSheet } from '@/components/ClawDetailSheet'
import { ClawAvatar } from '@/components/ClawAvatar'
import { Toast } from '@/components/Toast'
import { useHubContext } from '@/context/HubContext'
import { MessageBubble, StreamingBubble } from '@/components/MessageBubble'
import { ChatInput } from '@/components/ChatInput'
import { StatusDot } from '@/components/StatusDot'
import { colors } from '@/lib/theme'
import type { Message } from '@/lib/types'
import { MAX_FILE_BYTES, MAX_FILES_PER_MSG, formatBytes, type PendingAttachment } from '@/lib/attachments'
import { uploadFiles } from '@/lib/api'

export default function ChatScreen() {
  const { clawId } = useLocalSearchParams<{ clawId: string }>()
  const hub = useHubContext()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [toastSeq, setToastSeq] = useState<number | null>(null)

  const claw = hub.claws.find((c) => c.id === clawId)
  const messages = hub.messages[clawId] ?? []
  const streaming = hub.streamingBuffers[clawId]

  useEffect(() => {
    if (clawId) {
      hub.setSelectedClawId(clawId)
      hub.loadMessages(clawId)
    }
    return () => hub.setSelectedClawId(null)
  }, [clawId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0 || streaming) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      })
    }
  }, [messages.length, !!streaming])

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])

  interface NormalizedAsset {
    uri: string
    name: string
    size: number
    mimeType: string
  }

  const validateAndCreateAttachments = useCallback((
    assets: NormalizedAsset[],
    currentCount: number
  ): PendingAttachment[] | null => {
    const availableSlots = MAX_FILES_PER_MSG - currentCount
    if (availableSlots <= 0) {
      Alert.alert('Limit reached', `Maximum ${MAX_FILES_PER_MSG} files per message.`)
      return null
    }

    let validAssets = assets.slice(0, availableSlots)
    const oversizedFiles = validAssets.filter((a) => a.size > MAX_FILE_BYTES)
    if (oversizedFiles.length > 0) {
      validAssets = validAssets.filter((a) => a.size <= MAX_FILE_BYTES)
      const names = oversizedFiles.map((f) => f.name).join(', ')
      Alert.alert(
        oversizedFiles.length === 1 ? 'File too large' : 'Files too large',
        `${names} exceeds ${formatBytes(MAX_FILE_BYTES)} limit.`
      )
    }

    if (assets.length > availableSlots) {
      Alert.alert('Some files skipped', `Only ${availableSlots} more file(s) allowed.`)
    }

    if (validAssets.length === 0) return null

    return validAssets.map((asset) => ({
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: asset.name,
      size: asset.size,
      mimetype: asset.mimeType,
      previewUrl: asset.uri,
      status: 'uploading' as const,
    }))
  }, [])

  const handleSend = useCallback(async (content: string, attachments: PendingAttachment[]): Promise<boolean> => {
    if (!clawId) return false

    // Upload any pending attachments first
    if (attachments.length > 0) {
      const readyAttachments = attachments.filter((a) => a.status === 'ready')
      const uploadingAttachments = attachments.filter((a) => a.status === 'uploading')

      if (uploadingAttachments.length > 0) {
        try {
          const filesToUpload = uploadingAttachments.map((a) => ({
            uri: a.previewUrl!, // local file URI
            name: a.name,
            type: a.mimetype,
          }))
          const uploaded = await uploadFiles(clawId, filesToUpload)

          // Merge uploaded paths back into attachments using index-based matching
          // to avoid collisions when multiple files share the same name
          let uploadIdx = 0
          const merged = attachments.map((att) => {
            if (att.status === 'uploading' && uploadIdx < uploaded.length) {
              const up = uploaded[uploadIdx++]
              return { ...att, status: 'ready' as const, path: up.path }
            }
            return att
          })

          hub.send(clawId, content, merged)
          // Remove sent attachments, but preserve any added during upload
          const sentIds = new Set(attachments.map((a) => a.localId))
          setPendingAttachments((prev) => prev.filter((a) => !sentIds.has(a.localId)))
          return true
        } catch (err) {
          console.error('Upload failed:', err)
          // Keep attachments from the failed batch, but also preserve any added/removed during upload
          const failedIds = new Set(attachments.map((a) => a.localId))
          setPendingAttachments((prev) => {
            const prevIds = new Set(prev.map((a) => a.localId))
            // Keep items currently in state, plus restore failed ones that were removed
            const restoredFromFailed = attachments.filter((a) => !prevIds.has(a.localId))
            return [...prev, ...restoredFromFailed]
          })
          Alert.alert('Upload failed', 'Could not upload attachments. Please try again.')
          return false
        }
      } else {
        hub.send(clawId, content, readyAttachments)
        // Remove sent attachments, but preserve any added during send
        const sentIds = new Set(attachments.map((a) => a.localId))
        setPendingAttachments((prev) => prev.filter((a) => !sentIds.has(a.localId)))
      }
    } else {
      hub.send(clawId, content, [])
    }

    return true
  }, [clawId, hub])

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (result.canceled) return

      const normalizedAssets: NormalizedAsset[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name ?? 'unnamed',
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      }))

      const newAttachments = validateAndCreateAttachments(normalizedAssets, pendingAttachments.length)
      if (newAttachments) {
        setPendingAttachments((prev) => [...prev, ...newAttachments])
      }
    } catch (err) {
      console.error('Document picker error:', err)
    }
  }, [pendingAttachments.length, validateAndCreateAttachments])

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      })
      if (result.canceled) return

      const normalizedAssets: NormalizedAsset[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? 'image.jpg',
        size: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? 'image/jpeg',
      }))

      const newAttachments = validateAndCreateAttachments(normalizedAssets, pendingAttachments.length)
      if (newAttachments) {
        setPendingAttachments((prev) => [...prev, ...newAttachments])
      }
    } catch (err) {
      console.error('Image picker error:', err)
    }
  }, [pendingAttachments.length, validateAndCreateAttachments])

  const handlePickAttachments = useCallback(() => {
    Alert.alert(
      'Attach file',
      'Choose a source',
      [
        { text: 'Photo Library', onPress: handlePickImage },
        { text: 'Document', onPress: handlePickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }, [handlePickImage, handlePickDocument])

  const handleRemoveAttachment = useCallback((localId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.localId !== localId))
  }, [])

  function handleNewSession() {
    if (clawId) hub.newSession(clawId)
  }

  function handleKill() {
    Alert.alert('Kill claw', `Terminate ${claw?.name ?? 'this claw'}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kill',
        style: 'destructive',
        onPress: async () => {
          await hub.killClaw(clawId!)
          router.back()
        },
      },
    ])
  }

  const items: Array<{ type: 'msg'; message: Message; showAvatar: boolean; id: string } | { type: 'streaming'; id: '__streaming__' }> = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const next = messages[i + 1]
    // Show claw avatar only on the LAST claw message in a consecutive run
    const showAvatar = m.role === 'claw' && (!next || next.role !== 'claw')
    items.push({ type: 'msg', message: m, showAvatar, id: m.id })
  }
  if (streaming) items.push({ type: 'streaming', id: '__streaming__' })

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setDetailOpen(true)}
          style={styles.headerCenter}
          activeOpacity={0.7}
        >
          {claw && <ClawAvatar name={claw.name} color={claw.color} size={32} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {claw?.name ?? clawId}
            </Text>
            {claw && (
              <View style={styles.headerSub}>
                <StatusDot status={claw.status} isStreaming={claw.isStreaming} size={6} />
                <Text style={styles.headerSubText} numberOfLines={1}>
                  {claw.template}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNewSession}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCcw size={17} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDetailOpen(true)}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Info size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Context usage */}
      {claw && claw.contextUsage > 0 && (
        <View style={styles.contextBar}>
          <View style={[styles.contextFill, { width: `${Math.min(100, claw.contextUsage)}%` }]} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.flex}
      >
        <FlatList
          ref={flatListRef}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.type === 'streaming' && streaming) {
              return (
                <StreamingBubble
                  state={streaming}
                  clawName={claw?.name}
                  clawColor={claw?.color}
                />
              )
            }
            if (item.type === 'msg') {
              return (
                <MessageBubble
                  message={item.message}
                  clawName={claw?.name}
                  clawColor={claw?.color}
                  showAvatar={item.showAvatar}
                  onCopied={() => setToastSeq(Date.now())}
                />
              )
            }
            return null
          }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptyText}>Ask {claw?.name ?? 'the claw'} anything.</Text>
            </View>
          }
        />
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput
            onSend={handleSend}
            onPickAttachments={handlePickAttachments}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={handleRemoveAttachment}
            disabled={claw?.status === 'provisioning' || claw?.status === 'offline'}
          />
        </View>
      </KeyboardAvoidingView>

      {toastSeq !== null && (
        <Toast
          key={toastSeq}
          message="Message copied"
          onHide={() => setToastSeq(null)}
        />
      )}

      <ClawDetailSheet
        visible={detailOpen}
        claw={claw ?? null}
        onClose={() => setDetailOpen(false)}
        onSave={async (patch) => {
          if (claw) await hub.patchClaw(claw.id, patch)
        }}
        onTogglePin={(pinned) => {
          if (claw) hub.setPinned(claw.id, pinned)
        }}
        onNewSession={handleNewSession}
        onKill={async () => {
          if (claw) {
            await hub.killClaw(claw.id)
            router.back()
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  headerSubText: { color: colors.textMuted, fontSize: 11 },
  contextBar: { height: 2, backgroundColor: colors.elevated },
  contextFill: { height: '100%', backgroundColor: colors.blueLight },
  empty: { alignItems: 'center', marginTop: 120, paddingHorizontal: 32 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
})
