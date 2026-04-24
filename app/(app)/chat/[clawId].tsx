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
import type { PendingAttachment } from '@/lib/attachments'
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

  const handleSend = useCallback(async (content: string, attachments: PendingAttachment[]) => {
    if (!clawId) return

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

          // Merge uploaded paths back into attachments
          const uploadedMap = new Map(uploaded.map((u) => [u.name, u]))
          const merged = attachments.map((att) => {
            const up = uploadedMap.get(att.name)
            if (up && att.status === 'uploading') {
              return { ...att, status: 'ready' as const, path: up.path }
            }
            return att
          })

          hub.send(clawId, content, merged)
        } catch (err) {
          console.error('Upload failed:', err)
          // Mark uploads as error but still send message without them
          const failed = attachments.map((att) =>
            att.status === 'uploading' ? { ...att, status: 'error' as const, error: 'Upload failed' } : att
          )
          hub.send(clawId, content, failed)
        }
      } else {
        hub.send(clawId, content, readyAttachments)
      }
    } else {
      hub.send(clawId, content, [])
    }

    setPendingAttachments([])
  }, [clawId, hub])

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (result.canceled) return

      const newAttachments: PendingAttachment[] = result.assets.map((asset) => ({
        localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: asset.name ?? 'unnamed',
        size: asset.size ?? 0,
        mimetype: asset.mimeType ?? 'application/octet-stream',
        previewUrl: asset.uri,
        status: 'uploading',
      }))
      setPendingAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      console.error('Document picker error:', err)
    }
  }, [])

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      })
      if (result.canceled) return

      const newAttachments: PendingAttachment[] = result.assets.map((asset) => ({
        localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: asset.fileName ?? 'image.jpg',
        size: asset.fileSize ?? 0,
        mimetype: asset.mimeType ?? 'image/jpeg',
        previewUrl: asset.uri,
        status: 'uploading',
      }))
      setPendingAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      console.error('Image picker error:', err)
    }
  }, [])

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
