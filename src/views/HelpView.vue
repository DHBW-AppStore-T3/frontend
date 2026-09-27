<script setup lang="ts">
import { HelpCircle, Layers, BookOpen, FileText } from 'lucide-vue-next'
</script>

<template>
  <div class="bg-white rounded-2xl p-10 border shadow-sm">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
      <div class="flex items-center gap-4 text-primary">
        <HelpCircle :size="28" />
        <div>
          <h1 class="text-2xl font-bold">{{ $t('HelpView.title') }}</h1>
          <p class="text-sm text-textMuted">{{ $t('HelpView.subtitle') }}</p>
        </div>
      </div>
    </div>

    <p class="text-textMuted leading-7 max-w-3xl mb-8">
      {{ $t('HelpView.intro') }}
    </p>

    <div class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
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

      <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
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
      </article>

      <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <BookOpen :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.resources.title') }}</h2>
        </div>
        <p class="text-textMuted leading-7 mb-4">
          {{ $t('HelpView.resources.description') }}
        </p>
        <ul class="list-disc list-inside space-y-2 text-textMuted">
          <li>
            <a href="https://github.com/six7-click-n-deploy/frontend" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.frontendRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/six7-click-n-deploy/backend" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.backendRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/six7-click-n-deploy/deployment" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.deploymentRepo') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/six7-click-n-deploy/worker" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.resources.workerRepo') }}
            </a>
          </li>
        </ul>
      </article>

      <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div class="flex items-center gap-3 mb-4 text-primary">
          <FileText :size="20" />
          <h2 class="text-lg font-semibold">{{ $t('HelpView.docs.title') }}</h2>
        </div>
        <p class="text-textMuted leading-7 mb-4">
          {{ $t('HelpView.docs.description') }}
        </p>
        <ul class="list-disc list-inside space-y-3 text-textMuted">
          <li>
            <a href="https://github.com/six7-click-n-deploy/deployment/blob/main/README.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkAdmin') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/six7-click-n-deploy/.github/blob/main/docs/technologiestack.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkTech') }}
            </a>
          </li>
          <li>
            <a href="https://github.com/six7-click-n-deploy/template-app/blob/main/README.md" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
              {{ $t('HelpView.docs.linkAppDev') }}
            </a>
          </li>
        </ul>
      </article>

    </div>
  </div>
</template>