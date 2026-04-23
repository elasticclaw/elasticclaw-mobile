import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
import { Pin } from "lucide-react-native"
import { StatusDot } from "./StatusDot"
import { UnreadBadge } from "./UnreadBadge"
import { formatUptime } from "@/lib/mappers"
import { colors, COLOR_DOT, COLOR_BORDER } from "@/lib/theme"
import type { Claw, Message } from "@/lib/types"

interface Props {
  claw: Claw
  lastMessage?: Message
  isSelected: boolean
  onPress: () => void
  onLongPress?: () => void
}

function formatElapsed(claw: Claw): string {
  if (claw.status !== 'connected' || claw.uptime <= 0) return ''
  return formatUptime(claw.uptime)
}

function previewContent(msg: Message | undefined, isStreaming: boolean): string {
  if (isStreaming) return 'Typing…'
  if (!msg) return ''
  if (msg.role === 'system') return msg.content
  const prefix = msg.role === 'user' ? 'You: ' : ''
  const content = msg.content
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  return prefix + content
}

export function ClawListItem({ claw, lastMessage, isSelected, onPress, onLongPress }: Props) {
  const hasUnread = claw.unreadCount > 0
  const elapsed = formatElapsed(claw)
  const primaryTag = claw.tags[0]
  const extraTags = claw.tags.length - 1
  const preview = previewContent(lastMessage, claw.isStreaming)
  const borderColor = COLOR_BORDER[claw.color] ?? colors.blue
  const dotColor = COLOR_DOT[claw.color] ?? '#60a5fa'

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      activeOpacity={0.75}
      style={[
        styles.card,
        { borderLeftColor: borderColor },
        isSelected && styles.cardSelected,
      ]}
    >
      {/* Top: status + name + time */}
      <View style={styles.topRow}>
        <View style={styles.statusWrap}>
          <StatusDot status={claw.status} isStreaming={claw.isStreaming} size={8} />
          <UnreadBadge count={claw.unreadCount} />
        </View>
        <Text
          style={[styles.name, hasUnread && styles.nameUnread]}
          numberOfLines={1}
        >
          {claw.name}
        </Text>
        {claw.pinned && <Pin size={11} color={colors.textMuted} fill={colors.textMuted} />}
        <View style={styles.flex} />
        {elapsed ? <Text style={styles.time}>{elapsed}</Text> : null}
      </View>

      {/* Message preview */}
      {preview ? (
        <Text
          style={[styles.preview, hasUnread && styles.previewUnread]}
          numberOfLines={2}
        >
          {preview}
        </Text>
      ) : null}

      {/* Primary tag */}
      {primaryTag ? (
        <View style={styles.tagRow}>
          <View style={styles.tagChip}>
            <Text style={styles.tagText} numberOfLines={1}>{primaryTag}</Text>
          </View>
        </View>
      ) : null}

      {/* Bottom: extra tag count + color dot */}
      {(extraTags > 0 || !primaryTag) && (
        <View style={styles.bottomRow}>
          {extraTags > 0 ? (
            <Text style={styles.moreTags}>
              + {extraTags} {extraTags === 1 ? 'tag' : 'tags'}
            </Text>
          ) : null}
          <View style={styles.flex} />
          <View style={[styles.colorDot, { backgroundColor: dotColor }]} />
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: colors.border,
    borderRadius: 10,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 12,
    paddingLeft: 14,
  },
  cardSelected: {
    backgroundColor: colors.elevated,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusWrap: {
    position: 'relative',
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  nameUnread: {
    fontWeight: '700',
  },
  flex: { flex: 1 },
  time: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  preview: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  previewUnread: {
    color: colors.text,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: colors.elevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '85%',
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Menlo',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    minHeight: 10,
  },
  moreTags: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})
