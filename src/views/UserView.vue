<script setup lang="ts">
import { User, Mail, Shield, Calendar, Cloud, ChevronRight, BookOpen, Contact, Key } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { roleLabelKey, roleBadgeVariant as roleBadgeVariantFor } from '@/i18n/role-labels'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

const authStore = useAuthStore()
const { t } = useI18n()

// Cast to ``any`` so fields like firstName/course are accessible without the strict user type.
const user = computed(() => authStore.user as any)

// Central role-label helpers: one source for variant + translation across views.
const roleBadgeVariant = computed(() => roleBadgeVariantFor(user.value?.role))
const roleLabel = computed(() => t(roleLabelKey(user.value?.role)))

const createdDate = computed(() => {
  if (!user.value?.created_at) return 'N/A'
  return new Date(user.value.created_at).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

</script>

<template>
  <div class="p-6">

    <PageHeader :title="t('UserView.title')" :subtitle="t('UserView.subtitle')" />

    <div v-if="!user" class="text-center py-12">
      <p class="text-textMuted">{{ t('UserView.loading') }}</p>
    </div>

    <div v-else class="space-y-6">
      <Card class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div
              class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <User :size="32" class="text-primary" />
          </div>

          <div>
            <div class="font-semibold text-textHeading text-lg">
              {{ user.username || 'N/A' }}
            </div>
            <Badge :variant="roleBadgeVariant">{{ roleLabel }}</Badge>
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.firstName') }}</div>
            <div class="font-medium" :class="user.firstName ? 'text-textHeading' : 'text-textFaint'">
              {{ user.firstName || 'N/A' }}
            </div>
          </div>
          <Contact :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.lastName') }}</div>
            <div class="font-medium" :class="user.lastName ? 'text-textHeading' : 'text-textFaint'">
              {{ user.lastName || 'N/A' }}
            </div>
          </div>
          <Contact :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.email') }}</div>
            <div class="font-medium" :class="user.email ? 'text-textHeading' : 'text-textFaint'">
              {{ user.email || 'N/A' }}
            </div>
          </div>
          <Mail :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.course') }}</div>
            <div class="font-medium" :class="user.course?.name ? 'text-textHeading' : 'text-textFaint'">
              {{ user.course?.name || 'N/A' }}
            </div>
          </div>
          <BookOpen :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.role') }}</div>
            <div class="font-medium text-textHeading">{{ roleLabel }}</div>
          </div>
          <Shield :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.userId') }}</div>
            <div class="font-mono text-xs" :class="user.userId ? 'text-textMuted' : 'text-textFaint'">
              {{ user.userId || 'N/A' }}
            </div>
          </div>
          <User :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.registeredAt') }}</div>
            <div class="font-medium text-textHeading">{{ createdDate }}</div>
          </div>
          <Calendar :size="20" class="text-primary" />
        </Card>

        <Card class="flex items-center justify-between">
          <div>
            <div class="text-sm text-textMuted mb-1">{{ t('UserView.fields.keycloakId') }}</div>
            <div class="font-mono text-xs" :class="user.keycloak_id ? 'text-textMuted' : 'text-textFaint'">
              {{ user.keycloak_id || 'N/A' }}
            </div>
          </div>
          <Key :size="20" class="text-primary" />
        </Card>

      </div>

      <!-- Settings — list layout rather than a card grid; same border/padding
           style as the cards above. -->
      <div class="bg-white rounded-2xl shadow-md border border-borderSubtle overflow-hidden">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-textHeading">{{ t('UserView.settings.title') }}</h2>
        </div>
        <router-link
          to="/user/openstack"
          class="flex items-center justify-between px-6 py-4 hover:bg-surfaceMuted transition-colors"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud :size="20" class="text-primary" />
            </div>
            <div>
              <div class="font-medium text-textHeading">{{ t('UserView.settings.openstackTitle') }}</div>
              <div class="text-sm text-textMuted">
                {{ t('UserView.settings.openstackHint') }}
              </div>
            </div>
          </div>
          <ChevronRight :size="18" class="text-textFaint" />
        </router-link>
      </div>
    </div>
  </div>
</template>