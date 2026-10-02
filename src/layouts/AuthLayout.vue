<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Package, Layers, ShieldCheck, Settings, SquarePlay, Check } from 'lucide-vue-next'
import { useTheme } from '@/theme/useTheme'
import { THEME_COLOR_KEYS } from '@/theme/types'
import { saveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
import '@/theme/auth.css'

const { locale, t } = useI18n()
const languages = SUPPORTED_LOCALES
const theme = useTheme()
const themeVars = Object.fromEntries(
  THEME_COLOR_KEYS.map(key => [`--color-${key}`, theme.colors[key]]),
)

function changeLocale(lang: SupportedLocale) {
  locale.value = lang
  saveLocale(lang)
}

// Translators define intentional line groups; no language-specific word parsing.
const titleLeadLines = computed(() => t('auth.hero.heading.lead').split('\n'))
const hasFixedTitleLines = computed(() => titleLeadLines.value.length > 1)
const features = [
  { icon: Package, key: 'diverse' },
  { icon: Layers, key: 'preconfigured' },
  { icon: ShieldCheck, key: 'secure' },
]
const steps = [
  { icon: Settings, key: 'configure', complete: true },
  { icon: Layers, key: 'deploy', complete: true },
  { icon: SquarePlay, key: 'start', complete: false },
]
</script>

<template>
  <div class="auth-page" :style="themeVars" :lang="locale">
    <div class="auth-backdrop" :style="theme.loginBackground ? { backgroundImage: `url(${theme.loginBackground})` } : undefined" aria-hidden="true" />

    <svg class="auth-panel" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="auth-fold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" class="auth-fold-stop" stop-opacity=".28" />
          <stop offset="1" class="auth-fold-stop" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="auth-panel-surface" d="M0 0H737L555 743Q548 765 568 781L800 941H0Z" />
      <path fill="url(#auth-fold)" d="M0 625L303 900Q317 914 320 941H0Z" />
    </svg>

    <div class="auth-content">
      <header class="auth-header">
        <div class="auth-brand">
          <div
            class="auth-logo-mark"
            role="img"
            :aria-label="theme.brand.name"
            :style="{ '--logo-mask-url': `url(${theme.authLogo?.src ?? theme.logo.src})` }"
          />
          <span>{{ theme.brand.tagline }}</span>
        </div>
        <div class="auth-language" role="group" :aria-label="t('auth.login.language')">
          <button
            v-for="lang in languages"
            :key="lang"
            type="button"
            :lang="lang"
            :data-testid="`locale-${lang}`"
            :aria-pressed="locale === lang"
            @click="changeLocale(lang)"
          >{{ lang.toUpperCase() }}</button>
        </div>
      </header>

      <main class="auth-main">
        <p class="auth-eyebrow">{{ t('auth.hero.eyebrow') }}</p>
        <h1 class="auth-title" :class="{ 'auth-title--fixed-lines': hasFixedTitleLines }">
          <span v-for="line in titleLeadLines" :key="line" class="auth-title-line">{{ line }}</span>
          <span class="auth-title-accent">{{ t('auth.hero.heading.accent') }}</span>
        </h1>
        <slot />
      </main>

      <footer class="auth-features" :style="{ '--auth-feature-count': features.length }">
        <div v-for="feature in features" :key="feature.key" class="auth-feature">
          <component :is="feature.icon" class="auth-icon" aria-hidden="true" />
          <span>{{ t(`auth.login.features.${feature.key}`) }}</span>
        </div>
      </footer>
    </div>

    <!-- Decorative product illustration, not live deployment status. -->
    <div class="auth-workflow" aria-hidden="true">
      <div v-for="step in steps" :key="step.key" class="auth-step">
        <component :is="step.icon" class="auth-icon" />
        <span>{{ t(`auth.hero.steps.${step.key}`) }}</span>
        <Check v-if="step.complete" class="auth-icon auth-step-check" />
        <span v-else class="auth-step-circle" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  isolation: isolate;
  height: 100svh;
  overflow: clip;
  background: var(--auth-surface);
  color: var(--auth-heading);
  font-family: var(--auth-font-family);
}

.auth-backdrop, .auth-panel {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.auth-backdrop {
  z-index: -3;
  background-size: cover;
  background-position: left center;
  filter: var(--auth-photo-filter);
}

.auth-panel {
  z-index: -1;
}

.auth-panel-surface {
  fill: var(--auth-surface);
}

.auth-fold-stop {
  stop-color: var(--auth-fold);
}

.auth-icon {
  stroke-width: var(--auth-icon-stroke);
}

.auth-content {
  width: var(--auth-content-width);
  height: 100%;
  margin-left: var(--auth-content-left);
}

.auth-header {
  padding-top: var(--auth-header-top);
}

.auth-brand {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--auth-brand-gap);
  color: var(--auth-muted);
  font-size: var(--auth-text-control);
}

.auth-logo-mark {
  width: var(--auth-logo-width);
  aspect-ratio: var(--auth-logo-ratio);
  background: var(--auth-accent);
  mask: var(--logo-mask-url) center / contain no-repeat;
  -webkit-mask: var(--logo-mask-url) center / contain no-repeat;
}

.auth-language {
  position: absolute;
  top: var(--auth-language-top);
  left: var(--auth-language-left);
  display: flex;
  overflow: hidden;
  border: 1px solid var(--auth-language-border);
  border-radius: var(--auth-language-radius);
}

.auth-language button {
  padding: var(--auth-language-padding-y) var(--auth-language-padding-x);
  font-size: var(--auth-text-control);
  line-height: var(--auth-line-compact);
  color: var(--auth-language-text);
  transition: background .15s;
}

.auth-language button[aria-pressed='true'] {
  color: var(--auth-accent);
  background: var(--auth-language-selected);
}

.auth-language button:hover {
  background: var(--auth-language-hover);
}

.auth-language button:focus-visible {
  outline: 2px solid var(--auth-accent);
  outline-offset: -3px;
}

.auth-main {
  position: absolute;
  top: var(--auth-main-top);
  width: inherit;
}

.auth-eyebrow {
  margin: 0 0 var(--auth-eyebrow-gap);
  font-size: var(--auth-text-caption);
  line-height: var(--auth-line-eyebrow);
  letter-spacing: var(--auth-tracking-eyebrow);
  color: var(--auth-accent);
}

.auth-title {
  margin: 0 0 var(--auth-title-gap);
  font-size: var(--auth-text-title);
  font-weight: var(--auth-title-weight);
  font-optical-sizing: none;
  line-height: var(--auth-line-title);
  letter-spacing: var(--auth-tracking-title);
}

.auth-title span {
  display: block;
}

.auth-title--fixed-lines .auth-title-line {
  white-space: nowrap;
}

.auth-title-accent {
  color: var(--auth-accent);
}

.auth-features {
  position: absolute;
  bottom: var(--auth-features-bottom);
  width: inherit;
  display: grid;
  grid-template-columns: repeat(var(--auth-feature-count), minmax(0, 1fr));
  gap: var(--auth-feature-column-gap);
  padding-top: var(--auth-feature-padding);
  border-top: 1px solid var(--auth-divider);
}

.auth-feature {
  display: flex;
  flex-direction: column;
  gap: var(--auth-feature-gap);
  color: var(--auth-feature-icon);
}

.auth-feature svg {
  width: var(--auth-feature-icon-size);
  height: var(--auth-feature-icon-size);
}

.auth-feature span {
  color: var(--auth-muted);
  font-size: var(--auth-text-caption);
  line-height: var(--auth-line-compact);
}

.auth-workflow {
  position: absolute;
  top: var(--auth-workflow-top);
  left: var(--auth-workflow-left);
  width: var(--auth-workflow-width);
  display: grid;
  gap: var(--auth-workflow-gap);
  transform: skewY(4deg);
}

.auth-workflow::after {
  content: '';
  position: absolute;
  z-index: -1;
  right: -24%;
  top: -30%;
  bottom: -20%;
  width: 75%;
  border: 1px solid var(--auth-connector-border);
  border-left: 0;
  border-radius: 0 24px 24px 0;
}

.auth-step {
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--auth-card-gap);
  height: var(--auth-card-height);
  padding: var(--auth-card-padding);
  border: 1px solid var(--auth-card-border);
  border-radius: var(--auth-card-radius);
  background: var(--auth-card-surface);
  color: var(--auth-card-text);
  box-shadow: 0 12px 36px var(--auth-card-shadow);
  backdrop-filter: blur(10px);
}

.auth-step::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 50%;
  width: 24%;
  border-top: 1px solid var(--auth-connector-line);
}

.auth-step span {
  font-size: var(--auth-text-card);
  white-space: nowrap;
}

.auth-step > svg {
  flex-shrink: 0;
  width: var(--auth-icon-size);
  height: var(--auth-icon-size);
}

.auth-step .auth-step-check {
  width: var(--auth-check-size);
  margin-left: auto;
}

.auth-step-circle {
  margin-left: auto;
  width: var(--auth-status-size);
  height: var(--auth-status-size);
  border: 1px solid var(--auth-status-ring);
  border-radius: 50%;
  flex-shrink: 0;
}

/* Use natural document flow on narrow/short screens and when zoomed in. */
@media (max-width: 1023px), (max-height: 650px) {
  .auth-page {
    --auth-unit: 1px;
    height: auto;
    min-height: 100svh;
  }

  .auth-backdrop, .auth-workflow, .auth-panel {
    display: none;
  }

  .auth-page::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 45% -50% -20%;
    background: linear-gradient(135deg, var(--auth-mobile-fold), var(--auth-surface));
    transform: rotate(-35deg);
  }

  .auth-content {
    width: 100%;
    max-width: var(--auth-mobile-width);
    min-height: 100svh;
    margin: 0 auto;
    padding: var(--auth-mobile-padding);
    display: flex;
    flex-direction: column;
  }

  .auth-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0;
  }

  .auth-language {
    position: static;
  }

  .auth-language button {
    min-height: 40px;
    min-width: 44px;
  }

  .auth-main {
    position: static;
    width: 100%;
    margin: var(--auth-mobile-main-gap) 0;
  }

  .auth-title {
    font-size: var(--auth-mobile-title);
    letter-spacing: var(--auth-mobile-tracking);
  }

  .auth-title--fixed-lines {
    font-size: var(--auth-mobile-title-wide);
  }

  .auth-features {
    position: static;
    width: 100%;
    margin-top: auto;
    gap: var(--auth-mobile-feature-gap);
  }

  .auth-feature span {
    font-size: var(--auth-mobile-caption);
    overflow-wrap: anywhere;
  }

}

@media (prefers-reduced-motion: reduce) {
  .auth-language button {
    transition: none;
  }

}
</style>
