<script setup lang="ts">
import PageHeader from '@/components/ui/PageHeader.vue'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  CheckCircle2,
  XCircle,
  CircleHelp,
  KeyRound,
  Trash2,
  RefreshCw,
  Upload,
  ShieldQuestion,
} from 'lucide-vue-next'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import { parseCloudsYaml, CloudsYamlError } from '@/utils/clouds-yaml'
import type {
  OpenStackAuthType,
  OpenStackCredential,
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

const formatTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('de-DE') : null)

onMounted(async () => {
  await credStore.fetch()
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

const clearSecrets = () => {
  formApp.identifier = ''
  formApp.secret = ''
  formPwd.secret = ''
}

// Keystone checks the credential before anything is stored and names its
// project; saving another one for the same project replaces it (that is how
// a secret is rotated).
const handleSave = async () => {
  const payload = buildPayload()
  if (!payload) {
    toast.error(t('SettingsOpenStackView.errors.missingFields'))
    return
  }
  try {
    const saved = await credStore.save(payload)
    toast.success(t('SettingsOpenStackView.toasts.saveSuccess', { project: saved.project_name || saved.project_id }))
    clearSecrets()
    maybeReturnToWizard()
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleTest = async (credential: OpenStackCredential) => {
  try {
    const checked = await credStore.test(credential.credentialId)
    if (checked.last_validation_error) {
      toast.error(t('SettingsOpenStackView.errors.validationFailed', { error: checked.last_validation_error }))
    } else {
      toast.success(t('SettingsOpenStackView.toasts.credentialsValid'))
    }
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleDelete = async (credential: OpenStackCredential) => {
  if (credential.active_deployments > 0) {
    toast.warning(t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: credential.active_deployments }))
    return
  }
  if (!confirm(t('SettingsOpenStackView.confirmDelete', { project: credential.project_name || credential.project_id || '' }))) return
  try {
    await credStore.remove(credential.credentialId)
    toast.success(t('SettingsOpenStackView.status.deleteSuccess'))
  } catch {
    if (credStore.error) toast.error(credStore.error)
  }
}

const handleYamlFile = async (file: File) => {
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

// Back to the wizard step that sent the user here. Only a path inside the
// app is followed (never "//host", "/\host" or "https://..."), so a crafted
// link cannot use this page to send someone elsewhere.
const isAppPath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')

const maybeReturnToWizard = () => {
  const next = route.query.next
  if (isAppPath(next)) router.push(next)
}
</script>

<template>
  <div class="app-page max-w-4xl">
    <PageHeader :eyebrow="t('UserView.settings.title')" :title="t('SettingsOpenStackView.title')" :subtitle="t('SettingsOpenStackView.intro')" />

    <!-- Only VM apps (the Windows desktop) need a credential; pod apps run without. -->
    <p class="text-sm text-textMuted mb-6">{{ t('SettingsOpenStackView.vmOnlyHint') }}</p>

    <!-- Stored credentials, one per OpenStack project -->
    <div class="bg-white rounded-xl border mb-6" data-testid="credential-list">
      <div v-if="credStore.loading && !credStore.isResolved" class="p-5 text-textMuted text-sm">
        {{ t('SettingsOpenStackView.status.loading') }}
      </div>
      <div v-else-if="!credStore.hasAnyCredential" class="p-5 flex items-center gap-3">
        <CircleHelp class="text-textFaint" :size="22" />
        <div>
          <div class="font-medium text-textHeading">{{ t('SettingsOpenStackView.status.noneTitle') }}</div>
          <div class="text-sm text-textMuted">
            <i18n-t keypath="SettingsOpenStackView.status.noneHint" tag="span">
              <template #file><code class="font-mono">clouds.yaml</code></template>
            </i18n-t>
          </div>
        </div>
      </div>
      <ul v-else class="divide-y">
        <li
          v-for="c in credStore.list"
          :key="c.credentialId"
          class="p-5 flex flex-wrap items-center justify-between gap-3"
          :data-testid="`credential-${c.credentialId}`"
        >
          <div class="flex items-center gap-3 min-w-0">
            <ShieldQuestion v-if="!c.project_verified" class="text-warning" :size="22" />
            <XCircle v-else-if="c.last_validation_error" class="text-danger" :size="22" />
            <CheckCircle2 v-else class="text-green-500" :size="22" />
            <div class="min-w-0">
              <div class="font-medium text-textHeading truncate">
                {{ c.project_name || c.project_id || t('SettingsOpenStackView.status.unknownProject') }}
                <span class="ml-2 text-xs text-textFaint font-mono">{{ c.auth_type === 'password' ? t('SettingsOpenStackView.tabs.password') : t('SettingsOpenStackView.tabs.app') }}</span>
              </div>
              <div class="text-sm text-textMuted">
                <span v-if="!c.project_verified" class="block text-warning" data-testid="credential-unverified">
                  {{ t('SettingsOpenStackView.status.unverified') }}
                </span>
                <span v-else-if="formatTime(c.last_validated_at)">
                  {{ t('SettingsOpenStackView.status.lastChecked', { time: formatTime(c.last_validated_at) }) }}
                </span>
                <span v-if="c.last_validation_error" class="block text-danger">{{ c.last_validation_error }}</span>
                <span v-if="c.active_deployments > 0" class="block">
                  {{ t('SettingsOpenStackView.status.activeDeployments', { count: c.active_deployments }) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-2 text-sm border rounded-md hover:bg-surfaceMuted flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :data-testid="`btn-retest-${c.credentialId}`"
              @click="handleTest(c)"
              :disabled="credStore.loading"
            >
              <RefreshCw :size="16" /> {{ t('SettingsOpenStackView.status.retest') }}
            </button>
            <button
              class="px-3 py-2 text-sm border rounded-md text-danger border-danger/30 hover:bg-dangerTint flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :data-testid="`btn-delete-${c.credentialId}`"
              @click="handleDelete(c)"
              :disabled="credStore.loading || c.active_deployments > 0"
              :title="c.active_deployments > 0 ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''"
            >
              <Trash2 :size="16" /> {{ t('SettingsOpenStackView.status.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </div>

    <h2 class="text-lg font-semibold text-textHeading mb-3">{{ t('SettingsOpenStackView.addTitle') }}</h2>

    <!-- clouds.yaml drop zone -->
    <div
      class="border-2 border-dashed rounded-xl p-6 mb-6 transition-colors text-center"
      :class="[
        isDragging ? 'border-primary bg-primary/5' : 'border-borderSubtle bg-white',
      ]"
      @dragenter.prevent.stop="isDragging = true"
      @dragover.prevent.stop="isDragging = true"
      @dragleave.prevent.stop="isDragging = false"
      @drop.prevent.stop="onDrop"
    >
      <Upload class="mx-auto text-textFaint mb-2" :size="28" />
      <div class="font-medium text-textHeading mb-1">{{ t('SettingsOpenStackView.dropZone.headline') }}</div>
      <div class="text-sm text-textMuted mb-3">
        {{ t('SettingsOpenStackView.dropZone.orPrefix') }}
        <button
          class="text-primary underline"
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
        @change="onFilePick"
      />
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl border">
      <div class="flex border-b">
        <button
          class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'app' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-textMuted'"
          data-testid="tab-app"
          @click="activeTab = 'app'"
        >
          {{ t('SettingsOpenStackView.tabs.app') }}
          <span class="ml-2 text-xs text-success">{{ t('SettingsOpenStackView.tabs.appRecommended') }}</span>
        </button>
        <button
          class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'password' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-textMuted'"
          data-testid="tab-password"
          @click="activeTab = 'password'"
        >
          {{ t('SettingsOpenStackView.tabs.password') }}
        </button>
      </div>

      <!-- Application Credential -->
      <div v-if="activeTab === 'app'" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.authUrl') }}</label>
          <input
            v-model="formApp.auth_url"
            data-testid="app-auth-url"
            type="url"
            :placeholder="t('SettingsOpenStackView.placeholders.authUrl')"
            class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.region') }}</label>
          <input
            v-model="formApp.region_name"
            data-testid="app-region"
            type="text"
            :placeholder="t('SettingsOpenStackView.placeholders.region')"
            class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.appCredentialId') }}</label>
          <input
            v-model="formApp.identifier"
            data-testid="app-identifier"
            type="text"
            class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-surfaceMuted disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.appCredentialSecret') }}</label>
          <input
            v-model="formApp.secret"
            data-testid="app-secret"
            type="password"
            class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-surfaceMuted disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <!-- Password -->
      <div v-else class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.authUrl') }}</label>
          <input v-model="formPwd.auth_url" data-testid="pwd-auth-url" type="url" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.region') }}</label>
            <input v-model="formPwd.region_name" data-testid="pwd-region" type="text" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.userDomain') }}</label>
            <input v-model="formPwd.user_domain_name" data-testid="pwd-user-domain" type="text" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.username') }}</label>
            <input v-model="formPwd.identifier" data-testid="pwd-identifier" type="text" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.password') }}</label>
            <input v-model="formPwd.secret" data-testid="pwd-secret" type="password" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.projectId') }}</label>
            <input v-model="formPwd.project_id" data-testid="pwd-project-id" type="text" class="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.projectName') }}</label>
            <input v-model="formPwd.project_name" data-testid="pwd-project-name" type="text" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-textMuted mb-1">{{ t('SettingsOpenStackView.fields.projectDomain') }}</label>
          <input v-model="formPwd.project_domain_name" data-testid="pwd-project-domain" type="text" class="w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed" />
        </div>
      </div>

      <div class="px-6 pb-6 flex justify-end">
        <button
          class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          :disabled="credStore.loading"
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
