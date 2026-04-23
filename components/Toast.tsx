import { useEffect, useRef } from "react"
import { Animated, View, Text, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check } from "lucide-react-native"
import { colors } from "@/lib/theme"

interface Props {
  message: string
  onHide: () => void
}

/**
 * Single-shot toast. Parent should mount with a unique `key` per trigger
 * (e.g. `key={Date.now()}`) so each copy reliably re-runs the animation.
 */
export function Toast({ message, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current
  const insets = useSafeAreaInsets()
  const onHideRef = useRef(onHide)
  onHideRef.current = onHide

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 180, useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, damping: 18, stiffness: 260, mass: 0.8,
      }),
    ]).start()

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 200, useNativeDriver: true }),
      ]).start(() => onHideRef.current())
    }, 1400)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.iconWrap}>
          <Check size={14} color="#4ade80" strokeWidth={3} />
        </View>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#242426',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3c',
  },
  iconWrap: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  text: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
})
