<script setup lang="ts">
import { computed } from "vue"
import { useRole } from "@/composables/useRole"

/**
 * Conditional slot wrapper for permission-gated template content.
 *
 *   <RoleGate admin>…</RoleGate>          – only admins see the slot
 *   <RoleGate staff>…</RoleGate>          – teacher + admin
 *   <RoleGate :can="canEditApp(app)">…</RoleGate>
 *
 * Capability checks (``can``) are evaluated by the parent and passed in as a
 * plain boolean; the gate stays thin and knows nothing about specific resources.
 *
 * ``can`` defaults to ``null`` (not ``false``) so that ``null`` means
 * "prop was not provided — show unconditionally". Vue's Boolean casting would
 * coerce an absent boolean prop to ``false``, which would incorrectly hide the
 * slot when no ``can`` binding is present at all.
 */
const props = withDefaults(defineProps<{
  admin?: boolean
  staff?: boolean
  can?: boolean | null
}>(), { can: null })

const { isAdmin, isStaff } = useRole()
const allow = computed(() => {
  if (props.admin) return isAdmin.value
  if (props.staff) return isStaff.value
  if (props.can !== null) return props.can as boolean
  return true
})
</script>

<template>
  <slot v-if="allow" />
</template>
