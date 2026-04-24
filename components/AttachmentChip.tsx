import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native"
import { X, FileText, Image as ImageIconLucide } from "lucide-react-native"
import { colors } from "@/lib/theme"
import type { PendingAttachment, ParsedAttachment } from "@/lib/attachments"
import { getFileViewUrl } from "@/lib/api"

interface PendingProps {
  attachment: PendingAttachment
  onRemove: () => void
}

interface ParsedProps {
  attachment: ParsedAttachment
  clawId: string
}

export function PendingAttachmentChip({ attachment, onRemove }: PendingProps) {
  const isImage = attachment.mimetype.startsWith("image/")

  return (
    <View style={styles.chip}>
      {isImage && attachment.previewUrl ? (
        <Image source={{ uri: attachment.previewUrl }} style={styles.thumb} />
      ) : (
        <View style={styles.iconBox}>
          {isImage ? <ImageIconLucide size={14} color={colors.textMuted} /> : <FileText size={14} color={colors.textMuted} />}
        </View>
      )}
      <View style={styles.textBox}>
        <Text style={styles.name} numberOfLines={1}>{attachment.name}</Text>
        <Text style={styles.meta}>
          {attachment.status === "uploading" ? "Uploading…" : attachment.status === "error" ? "Error" : attachment.mimetype}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  )
}

export function ParsedAttachmentChip({ attachment, clawId }: ParsedProps) {
  const isImage = attachment.mimetype.startsWith("image/")
  const viewUrl = getFileViewUrl(clawId, attachment.path)

  return (
    <View style={styles.chip}>
      {isImage ? (
        <Image source={{ uri: viewUrl }} style={styles.thumb} />
      ) : (
        <View style={styles.iconBox}>
          <FileText size={14} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.textBox}>
        <Text style={styles.name} numberOfLines={1}>{attachment.name}</Text>
        <Text style={styles.meta}>{attachment.sizeLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.bg,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  textBox: {
    maxWidth: 140,
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "500",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  closeBtn: {
    padding: 2,
  },
})
