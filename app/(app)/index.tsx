import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, X, Settings as SettingsIcon, Plus } from 'lucide-react-native'
import { useHubContext } from '@/context/HubContext'
import { ClawListItem } from '@/components/ClawListItem'
import { ClawDetailSheet } from '@/components/ClawDetailSheet'
import { SpawnModal } from '@/components/SpawnModal'
import { colors } from '@/lib/theme'
import type { Claw } from '@/lib/types'

export default function ClawListScreen() {
  const hub = useHubContext()
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [detailClaw, setDetailClaw] = useState<Claw | null>(null)
  const [spawnOpen, setSpawnOpen] = useState(false)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    hub.claws.forEach((c) => c.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet)
  }, [hub.claws])

  const filtered = useMemo(() => {
    return hub.claws.filter((c) => {
      const s = search.toLowerCase()
      const matchesSearch = !s || c.name.toLowerCase().includes(s) || c.template.toLowerCase().includes(s)
      const matchesTag = !activeTag || c.tags.includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [hub.claws, search, activeTag])

  const pinnedClaws = filtered.filter((c) => c.pinned)
  const unpinnedClaws = filtered.filter((c) => !c.pinned)
  type Row = { type: 'header'; label: string } | { type: 'claw'; claw: Claw }
  const rows: Row[] = []
  if (pinnedClaws.length > 0 && !search && !activeTag) {
    rows.push({ type: 'header', label: 'Pinned' })
    pinnedClaws.forEach((c) => rows.push({ type: 'claw', claw: c }))
    if (unpinnedClaws.length > 0) rows.push({ type: 'header', label: 'All claws' })
  }
  unpinnedClaws.forEach((c) => rows.push({ type: 'claw', claw: c }))
  if (!pinnedClaws.length && !unpinnedClaws.length) { /* handled below */ }
  if (search || activeTag) {
    // simple flat list when filtering
    rows.length = 0
    pinnedClaws.forEach((c) => rows.push({ type: 'claw', claw: c }))
    unpinnedClaws.forEach((c) => rows.push({ type: 'claw', claw: c }))
  }
  const sortedCount = pinnedClaws.length + unpinnedClaws.length

  function handleSelectClaw(claw: Claw) {
    hub.setSelectedClawId(claw.id)
    hub.setUnreadCount(claw.id, 0)
    router.push(`/chat/${claw.id}`)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.chevron}>›_</Text>
            <Text style={styles.title}>
              {hub.loading ? 'Loading…' : `${hub.claws.length} Active ${hub.claws.length === 1 ? 'Claw' : 'Claws'}`}
            </Text>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: hub.connected ? colors.green : colors.textDim },
              ]}
            />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SettingsIcon size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={15} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by name or template"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <View style={styles.tagScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagScrollContent}
          >
            {allTags.map((tag) => {
              const isActive = activeTag === tag
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setActiveTag(isActive ? null : tag)}
                  style={[
                    styles.tagChip,
                    isActive && { backgroundColor: colors.blue, borderColor: colors.blue },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.tagChipText, isActive && { color: colors.white }]}
                    numberOfLines={1}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Body */}
      {hub.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blueLight} />
        </View>
      ) : hub.hubError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not reach the hub</Text>
          <Text style={styles.errorText}>{hub.hubError}</Text>
          <TouchableOpacity onPress={hub.refreshClaws} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sortedCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {hub.claws.length === 0 ? 'No claws yet' : 'No claws match'}
          </Text>
          <Text style={styles.emptyText}>
            {hub.claws.length === 0
              ? 'Tap New to spawn your first claw.'
              : 'Try clearing your search or tag filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, i) => row.type === 'header' ? `h-${row.label}` : row.claw.id}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>
            }
            const msgs = hub.messages[item.claw.id] ?? []
            const lastMessage = msgs[msgs.length - 1]
            return (
              <ClawListItem
                claw={item.claw}
                lastMessage={lastMessage}
                isSelected={hub.selectedClawId === item.claw.id}
                onPress={() => handleSelectClaw(item.claw)}
                onLongPress={() => setDetailClaw(item.claw)}
              />
            )
          }}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: insets.bottom + 20 }}
        />
      )}

      <ClawDetailSheet
        visible={!!detailClaw}
        claw={detailClaw}
        onClose={() => setDetailClaw(null)}
        onSave={async (patch) => {
          if (detailClaw) await hub.patchClaw(detailClaw.id, patch)
        }}
        onTogglePin={(pinned) => {
          if (detailClaw) hub.setPinned(detailClaw.id, pinned)
        }}
        onNewSession={() => {
          if (detailClaw) hub.newSession(detailClaw.id)
        }}
        onKill={() => {
          if (detailClaw) hub.killClaw(detailClaw.id)
        }}
      />

      <SpawnModal
        visible={spawnOpen}
        onClose={() => setSpawnOpen(false)}
        onSpawn={async ({ template, name, color }) => {
          const finalName = name || `claw-${Date.now()}`
          await hub.createClaw({ name: finalName, template, color })
        }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => setSpawnOpen(true)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        activeOpacity={0.85}
      >
        <Plus size={26} color={colors.white} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: 'Menlo',
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  connectionDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    padding: 0,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tagScrollWrap: { height: 40, paddingBottom: 8 },
  tagScrollContent: { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  tagChip: {
    backgroundColor: colors.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tagChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  errorText: { color: colors.red, fontSize: 12, textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: colors.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
})
