import { useEffect, useRef } from "react"
import { Animated, View } from "react-native"
import type { ClawStatus } from "@/lib/types"

interface Props {
  status: ClawStatus
  isStreaming?: boolean
  size?: number
}

const STATUS_COLORS: Record<ClawStatus, string> = {
  connected: '#22c55e',
  idle: '#f59e0b',
  offline: '#52525b',
  provisioning: '#60a5fa',
  error: '#ef4444',
}

export function StatusDot({ status, isStreaming, size = 8 }: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const isSpinning = status === 'provisioning'

  useEffect(() => {
    if (isSpinning) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      )
      loop.start()
      return () => loop.stop()
    }
    spinAnim.setValue(0)
  }, [isSpinning, spinAnim])

  useEffect(() => {
    if (isStreaming && !isSpinning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    }
    pulseAnim.setValue(1)
  }, [isStreaming, isSpinning, pulseAnim])

  const color = isStreaming ? '#22c55e' : STATUS_COLORS[status]

  if (isSpinning) {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    return (
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate: spin }],
        }}
      />
    )
  }

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: pulseAnim,
      }}
    />
  )
}
