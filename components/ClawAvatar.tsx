import { View, Text, StyleSheet } from "react-native"
import { COLOR_DOT, COLOR_BORDER } from "@/lib/theme"
import { clawInitial } from "@/lib/mappers"

interface Props {
  name: string
  color: string
  size?: number
  subtle?: boolean
}

export function ClawAvatar({ name, color, size = 44, subtle = false }: Props) {
  const bg = subtle ? (COLOR_BORDER[color] ?? '#3b82f6') + '33' : (COLOR_DOT[color] ?? '#60a5fa')
  const fg = subtle ? (COLOR_DOT[color] ?? '#60a5fa') : '#0a0a0a'

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.4, color: fg }]}>
        {clawInitial(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
})
