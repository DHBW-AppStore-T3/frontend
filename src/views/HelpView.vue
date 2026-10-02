<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { HelpCircle, Layers, BookOpen, FileText, Search, Bell, ChevronRight } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
const { t, tm } = useI18n()
const searchQuery = ref('')
function matches(keys: string[]) {
  return keys.map(key => JSON.stringify(tm(key))).join(' ').toLocaleLowerCase().includes(searchQuery.value.trim().toLocaleLowerCase())
}
</script>

<template>
  <div class="app-page help-page">
    <PageHeader :eyebrow="t('nav.help')" :title="t('HelpView.title')" :subtitle="t('HelpView.subtitle')" />
    <label class="search-field help-search"><Search :size="16" aria-hidden="true" /><input v-model="searchQuery" type="search" :placeholder="t('workspace.searchHelp')" :aria-label="t('workspace.searchHelp')" /></label>
    <div class="help-list">
      <details class="help-section" v-show="matches(['workspace.help.documentation', 'HelpView.docs', 'HelpView.resources'])">
        <summary><span class="help-icon"><FileText :size="26" /></span><span class="help-summary"><strong>{{ t('workspace.help.documentation') }}</strong><span>{{ t('workspace.help.documentationDescription') }}</span></span><ChevronRight :size="18" /></summary>
        <div class="help-body"><p class="text-textMuted mb-6">{{ t('HelpView.intro') }}</p>
      <article class="help-article">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <FileText :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.docs.title') }}</h2>
        </div>
        <p class="text-textMuted leading-7 mb-4">
          {{ $t('HelpView.docs.description') }}
        </p>
        <ul class="list-disc list-inside space-y-3 text-textMuted">
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/deployment/blob/main/README.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkAdmin') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/technologiestack.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkTech') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/template-app/blob/main/README.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkAppDev') }}
            </a>
          </li>
        </ul>
      </article>      <article class="help-article">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <BookOpen :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.resources.title') }}</h2>
        </div>
        <p class="text-textMuted leading-7 mb-4">
          {{ $t('HelpView.resources.description') }}
        </p>
        <ul class="list-disc list-inside space-y-2 text-textMuted">
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/frontend" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.frontendRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/backend" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.backendRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/deployment" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.deploymentRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/DHBW-AppStore-T3/worker" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.workerRepo') }}
            </a>
          </li>
        </ul>
      </article>
        </div>
      </details>
      <details class="help-section" v-show="matches(['workspace.help.faq', 'HelpView.intro', 'HelpView.troubleshooting', 'HelpView.quickHelp'])">
        <summary><span class="help-icon"><HelpCircle :size="26" /></span><span class="help-summary"><strong>{{ t('workspace.help.faq') }}</strong><span>{{ t('workspace.help.faqDescription') }}</span></span><ChevronRight :size="18" /></summary>
        <div class="help-body"><p class="text-textMuted mb-6">{{ t('HelpView.intro') }}</p>
      <article class="help-article">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <BookOpen :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.quickHelp.title') }}</h2>
        </div>
        <p class="text-sm font-semibold text-slate-700 mb-3">{{ $t('HelpView.quickHelp.processTitle') }}</p>
        <ol class="list-decimal list-inside space-y-3 text-textMuted">
          <li>{{ $t('HelpView.quickHelp.step1') }}</li>
          <li>{{ $t('HelpView.quickHelp.step2') }}</li>
          <li>{{ $t('HelpView.quickHelp.step3') }}</li>
          <li>{{ $t('HelpView.quickHelp.step4') }}</li>
          <li>{{ $t('HelpView.quickHelp.step5') }}</li>
        </ol>
        <div class="mt-6 space-y-4 text-textMuted">
          <div>
            <h3 class="font-semibold text-base">{{ $t('HelpView.quickHelp.pageDashboardTitle') }}</h3>
            <p class="text-textMuted">{{ $t('HelpView.quickHelp.pageDashboard') }}</p>
          </div>
          <div>
            <h3 class="font-semibold text-base">{{ $t('HelpView.quickHelp.pageAppsTitle') }}</h3>
            <p class="text-textMuted">{{ $t('HelpView.quickHelp.pageApps') }}</p>
          </div>
          <div>
            <h3 class="font-semibold text-base">{{ $t('HelpView.quickHelp.pageCoursesTitle') }}</h3>
            <p class="text-textMuted">{{ $t('HelpView.quickHelp.pageCourses') }}</p>
          </div>
          <div>
            <h3 class="font-semibold text-base">{{ $t('HelpView.quickHelp.pageDeploymentsTitle') }}</h3>
            <p class="text-textMuted">{{ $t('HelpView.quickHelp.pageDeployments') }}</p>
          </div>
        </div>
      </article>      <article class="help-article">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <Layers :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.troubleshooting.title') }}</h2>
        </div>
        <p class="text-textMuted leading-7 mb-4">
          {{ $t('HelpView.troubleshooting.description') }}
        </p>
        <ul class="list-disc list-inside space-y-2 text-textMuted">
          <li>{{ $t('HelpView.troubleshooting.item1') }}</li>
          <li>{{ $t('HelpView.troubleshooting.item2') }}</li>
        </ul>
      </article>
        </div>
      </details>
      <details class="help-section" v-show="matches(['workspace.help.support', 'workspace.help.supportDescription'])">
        <summary><span class="help-icon"><Bell :size="26" /></span><span class="help-summary"><strong>{{ t('workspace.help.support') }}</strong><span>{{ t('workspace.help.supportDescription') }}</span></span><ChevronRight :size="18" /></summary>
        <p class="help-body text-textMuted">{{ t('auth.login.noAccount') }}</p>
      </details>
    </div>
  </div>
</template>

<style scoped>
.help-search { max-width: 480px; margin-bottom: 24px; }
.help-list { display: grid; gap: 20px; }
.help-section { border: 1px solid rgb(var(--color-border-subtle)); border-radius: var(--workspace-card-radius); background: var(--workspace-surface); }
.help-section summary { list-style: none; display: flex; align-items: center; gap: 20px; padding: 24px; cursor: pointer; }
.help-section summary::-webkit-details-marker { display: none; }
.help-icon { display: grid; place-items: center; flex-shrink: 0; width: 52px; height: 52px; border-radius: 9px; color: rgb(var(--color-info)); background: rgb(var(--color-info) / .1); }
.help-summary { display: grid; flex: 1; gap: 6px; }
.help-summary strong { color: rgb(var(--color-text-heading)); font-size: 16px; }
.help-summary span { color: rgb(var(--color-text-muted)); font-size: 13px; }
.help-section[open] summary > svg { transform: rotate(90deg); }
.help-body { padding: 0 24px 24px; }
.help-article + .help-article { margin-top: 28px; padding-top: 24px; border-top: 1px solid rgb(var(--color-border-subtle)); }
@media (max-width: 560px) { .help-section summary { padding: 20px; gap: 14px; } }
</style>
