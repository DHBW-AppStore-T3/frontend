/**
 * Most view specs mock vue-i18n's ``useI18n`` (``t`` returns the key). The
 * ``<i18n-t>`` component, which interpolates user-controlled names as slots
 * instead of through ``v-html`` (.github#7 J), gets the same treatment here:
 * it renders its keypath followed by its slot content, so a spec still sees
 * the interpolated values. ``tests/unit/i18nXss.spec.ts`` checks the real
 * component.
 */
import { config } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const I18nTStub = defineComponent({
  name: 'I18nTStub',
  props: {
    keypath: { type: String, required: true },
    tag: { type: String, default: 'span' },
  },
  setup(props, { slots }) {
    return () => h(props.tag, [props.keypath, ' ', ...Object.values(slots).flatMap((slot) => slot?.() ?? [])])
  },
})

config.global.stubs = { ...config.global.stubs, 'i18n-t': I18nTStub, I18nT: I18nTStub }
