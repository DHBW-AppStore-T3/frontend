<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  CheckCircle2,
  XCircle,
  CircleHelp,
  Cloud,
  KeyRound,
  Trash2,
  RefreshCw,
  Upload,
} from 'lucide-vue-next'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import CredentialMissingBanner from '@/components/CredentialMissingBanner.vue'
import { parseCloudsYaml, CloudsYamlError } from '@/utils/clouds-yaml'
import type {
  OpenStackAuthType,
  OpenStackCredentialUpsert,
} from '@/types/openstack-credential'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const credStore = useOpenStackCredentialsStore()
const { t } = useI18n()

type Tab = 'app' | 'password'
const activeTab = ref<Tab>('app')

const formApp = reactive({
  auth_url: '',
  region_name: '',
  identifier: '',
  secret: '',
})

const formPwd = reactive({
  auth_url: '',
  region_name: '',
  identifier: '',
  secret: '',
  project_id: '',
  project_name: '',
  user_domain_name: 'Default',
  project_domain_name: '',
})

const isDragging = ref(false)
const yamlInputRef = ref<HTMLInputElement | null>(null)

const lastValidated = computed(() => {
  if (!credStore.status?.last_validated_at) return null
  return new Date(credStore.status.last_validated_at).toLocaleString('de-DE')
})

onMounted(async () => {
  await credStore.fetch()
  // Pre-fill known non-secret fields if creds exist.
  if (credStore.status?.has_credential) {
    const c = credStore.status
    activeTab.value = c.auth_type === 'v3applicationcredential' ? 'app' : 'password'
    if (activeTab.value === 'app') {
      formApp.auth_url = c.auth_url ?? ''
      formApp.region_name = c.region_name ?? ''
    } else {
      formPwd.auth_url = c.auth_url ?? ''
      formPwd.region_name = c.region_name ?? ''
      formPwd.project_id = c.project_id ?? ''
      formPwd.project_name = c.project_name ?? ''
      formPwd.user_domain_name = c.user_domain_name ?? 'Default'
      formPwd.project_domain_name = c.project_domain_name ?? ''
    }
  }
})

const buildPayload = (): OpenStackCredentialUpsert | null => {
  if (activeTab.value === 'app') {
    if (!formApp.auth_url || !formApp.identifier || !formApp.secret) return null
    const payload: OpenStackCredentialUpsert = {
      auth_type: 'v3applicationcredential' as OpenStackAuthType,
      auth_url: formApp.auth_url,
      region_name: formApp.region_name || null,
      interface: 'public',
      identity_api_version: '3',
      identifier: formApp.identifier,
      secret: formApp.secret,
    }
    return payload
  }
  if (!formPwd.auth_url || !formPwd.identifier || !formPwd.secret || !formPwd.user_domain_name) return null
  if (!formPwd.project_id && !formPwd.project_name) return null
  return {
    auth_type: 'password' as OpenStackAuthType,
    auth_url: formPwd.auth_url,
    region_name: formPwd.region_name || null,
    interface: 'public',
    identity_api_version: '3',
    identifier: formPwd.identifier,
    secret: formPwd.secret,
    project_id: formPwd.project_id || null,
    project_name: formPwd.project_name || null,
    user_domain_name: formPwd.user_domain_name,
    project_domain_name: formPwd.project_domain_name || null,
  }
}

const handleSave = async () => {
  if (credStore.isLocked) {
    toast.warning(t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: credStore.activeDeployments }))
    return
  }
  const payload = buildPayload()
  if (!payload) {
    toast.error(t('SettingsOpenStackView.errors.missingFields'))
    return
  }
  try {
    await credStore.save(payload)
    if (credStore.lastError) {
      toast.warning(t('SettingsOpenStackView.errors.validationFailedSaved', { error: credStore.lastError }))
    } else {
      toast.success(t('SettingsOpenStackView.toasts.saveSuccess'))
      maybeReturnToWizard()
    }
    formApp.secret = ''
    formPwd.secret = ''
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleTest = async () => {
  try {
    await credStore.test()
    if (credStore.lastError) {
      toast.error(t('SettingsOpenStackView.errors.validationFailed', { error: credStore.lastError }))
    } else {
      toast.success(t('SettingsOpenStackView.toasts.credentialsValid'))
    }
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleDelete = async () => {
  if (credStore.isLocked) {
    toast.warning(t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: credStore.activeDeployments }))
    return
  }
  if (!confirm(t('SettingsOpenStackView.confirmDelete'))) return
  try {
    await credStore.remove()
    toast.success(t('SettingsOpenStackView.status.deleteSuccess'))
    formApp.secret = ''
    formPwd.secret = ''
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleYamlFile = async (file: File) => {
  if (credStore.isLocked) {
    toast.warning(t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: credStore.activeDeployments }))
    return
  }
  let text: string
  try {
    text = await file.text()
  } catch (err) {
    console.error('Failed to read clouds.yaml file:', err)
    toast.error(t('SettingsOpenStackView.fileReadError'))
    return
  }
  if (!text.trim()) {
    toast.error(t('SettingsOpenStackView.fileEmpty'))
    return
  }

  let parsed
  try {
    parsed = parseCloudsYaml(text)
  } catch (err) {
    console.error('clouds.yaml parse error:', err)
    const msg = err instanceof CloudsYamlError ? err.message : t('SettingsOpenStackView.cloudsYamlError')
    toast.error(msg)
    return
  }

  if (parsed.auth_type === 'v3applicationcredential') {
    activeTab.value = 'app'
    formApp.auth_url = parsed.auth_url
    formApp.region_name = parsed.region_name
    formApp.identifier = parsed.identifier
    formApp.secret = parsed.secret
  } else {
    activeTab.value = 'password'
    formPwd.auth_url = parsed.auth_url
    formPwd.region_name = parsed.region_name
    formPwd.identifier = parsed.identifier
    formPwd.secret = parsed.secret
    formPwd.project_id = parsed.project_id
    formPwd.project_name = parsed.project_name
    formPwd.user_domain_name = parsed.user_domain_name || 'Default'
    formPwd.project_domain_name = parsed.project_domain_name
  }

  toast.success(t('SettingsOpenStackView.cloudsYamlImported'))
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false
  if (credStore.isLocked) return
  const file = event.dataTransfer?.files?.[0]
  if (!file) {
    toast.error(t('SettingsOpenStackView.dropNoFile'))
    return
  }
  handleYamlFile(file)
}

const onFilePick = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleYamlFile(file)
  input.value = ''
}

const maybeReturnToWizard = () => {
  const next = route.query.next as string | undefined
  if (next) router.push(next)
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Cloud :size="28" class="text-primary" />
        {{ t('SettingsOpenStackView.title') }}
      </h1>
      <p class="text-gray-500">
        {{ t('SettingsOpenStackView.intro') }}
      </p>
    </div>

    <!-- Lock banner -->
    <CredentialMissingBanner
      v-if="credStore.isLocked"
      variant="lock"
      :title="t('SettingsOpenStackView.lockBanner.title')"
      :message="t('SettingsOpenStackView.lockBanner.message', { count: credStore.activeDeployments })"
      :cta="t('SettingsOpenStackView.lockBanner.cta')"
      ctaTo="/deployments"
      class="mb-6"
    />

    <!-- Status card -->
    <div class="bg-white rounded-xl border p-5 mb-6">
      <div v-if="credStore.loading" class="text-gray-500 text-sm">
        {{ t('SettingsOpenStackView.status.loading') }}
      </div>
      <div v-else-if="!credStore.hasCredential" class="flex items-center gap-3">
        <CircleHelp class="text-gray-400" :size="22" />
        <div>
          <div class="font-medium text-gray-900">{{ t('SettingsOpenStackView.status.noneTitle') }}</div>
          <div class="text-sm text-gray-500">
            <i18n-t keypath="SettingsOpenStackView.status.noneHint" tag="span">
              <template #file><code class="font-mono">clouds.yaml</code></template>
            </i18n-t>
          </div>
        </div>
      </div>
      <div v-else class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <CheckCircle2 v-if="credStore.isValidated && !credStore.lastError" class="text-green-500" :size="22" />
          <XCircle v-else class="text-red-500" :size="22" />
          <div>
            <div class="font-medium text-gray-900">
              {{ credStore.isValidated && !credStore.lastError ? t('SettingsOpenStackView.status.valid') : t('SettingsOpenStackView.status.invalid') }}
            </div>
            <div class="text-sm text-gray-500">
              <span v-if="lastValidated">{{ t('SettingsOpenStackView.status.lastChecked', { time: lastValidated }) }}</span>
              <span v-if="credStore.lastError" class="block text-red-600">{{ credStore.lastError }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-retest"
            @click="handleTest"
            :disabled="credStore.loading"
          >
            <RefreshCw :size="16" /> {{ t('SettingsOpenStackView.status.retest') }}
          </button>
          <button
            class="px-3 py-2 text-sm border rounded-md text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-delete"
            @click="handleDelete"
            :disabled="credStore.loading || credStore.isLocked"
            :title="credStore.isLocked ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''"
          >
            <Trash2 :size="16" /> {{ t('SettingsOpenStackView.status.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- clouds.yaml drop zone -->
    <div
      class="border-2 border-dashed rounded-xl p-6 mb-6 transition-colors text-center"
      :class="[
        isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 bg-white',
        credStore.isLocked ? 'opacity-50 pointer-events-none' : ''
      ]"
      @dragenter.prevent.stop="!credStore.isLocked && (isDragging = true)"
      @dragover.prevent.stop="!credStore.isLocked && (isDragging = true)"
      @dragleave.prevent.stop="isDragging = false"
      @drop.prevent.stop="onDrop"
    >
      <Upload class="mx-auto text-gray-400 mb-2" :size="28" />
      <div class="font-medium text-gray-900 mb-1">{{ t('SettingsOpenStackView.dropZone.headline') }}</div>
      <div class="text-sm text-gray-500 mb-3">
        {{ t('SettingsOpenStackView.dropZone.orPrefix') }}
        <button
          class="text-primary underline disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="credStore.isLocked"
          @click="yamlInputRef?.click()"
        >{{ t('SettingsOpenStackView.dropZone.pickFile') }}</button>
        {{ t('SettingsOpenStackView.dropZone.suffix') }}
      </div>
      <input
        ref="yamlInputRef"
        data-testid="yaml-input"
        type="file"
        accept=".yaml,.yml,application/x-yaml,text/yaml"
        class="hidden"
        :disabled="credStore.isLocked"
        @change="onFilePick"
      />
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl border">
      <div class="flex border-b">
        <button
          class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'app' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'"
          data-testid="tab-app"
          @click="activeTab = 'app'"
        >
          {{ t('SettingsOpenStackView.tabs.app') }}
          <span class="ml-2 text-xs text-green-600">{{ t('SettingsOpenStackView.tabs.appRecommended') }}</span>
        </button>
        <button
          class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'password' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'"
          data-testid="tab-password"
          @click="activeTab = 'password'"
        >
          {{ t('SettingsOpenStackView.tabs.password') }}
        </button>
      </div>

      <!-- Application Credential -->
      <div v-if="activeTab === 'app'" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.authUrl') }}</label>
          <input
            v-model="formApp.auth_url"
            data-testid="app-auth-url"
            type="url"
            :placeholder="t('SettingsOpenStackView.placeholders.authUrl')"
            :disabled="credStore.isLocked"
            class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.region') }}</label>
          <input
            v-model="formApp.region_name"
            data-testid="app-region"
            type="text"
            :placeholder="t('SettingsOpenStackView.placeholders.region')"
            :disabled="credStore.isLocked"
            class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.appCredentialId') }}</label>
          <input
            v-model="formApp.identifier"
            data-testid="app-identifier"
            type="text"
            :disabled="credStore.isLocked"
            class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.appCredentialSecret') }}</label>
          <input
            v-model="formApp.secret"
            data-testid="app-secret"
            type="password"
            :disabled="credStore.isLocked"
            class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <!-- Password -->
      <div v-else class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.authUrl') }}</label>
          <input v-model="formPwd.auth_url" data-testid="pwd-auth-url" type="url" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.region') }}</label>
            <input v-model="formPwd.region_name" data-testid="pwd-region" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.userDomain') }}</label>
            <input v-model="formPwd.user_domain_name" data-testid="pwd-user-domain" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.username') }}</label>
            <input v-model="formPwd.identifier" data-testid="pwd-identifier" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.password') }}</label>
            <input v-model="formPwd.secret" data-testid="pwd-secret" type="password" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.projectId') }}</label>
            <input v-model="formPwd.project_id" data-testid="pwd-project-id" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.projectName') }}</label>
            <input v-model="formPwd.project_name" data-testid="pwd-project-name" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('SettingsOpenStackView.fields.projectDomain') }}</label>
          <input v-model="formPwd.project_domain_name" data-testid="pwd-project-domain" type="text" :disabled="credStore.isLocked" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed" />
        </div>
      </div>

      <div class="px-6 pb-6 flex justify-end">
        <button
          class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          :disabled="credStore.loading || credStore.isLocked"
          :title="credStore.isLocked ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''"
          data-testid="btn-save"
          @click="handleSave"
        >
          <KeyRound :size="16" />
          {{ t('SettingsOpenStackView.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
