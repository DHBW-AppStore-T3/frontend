<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GraduationCap, ArrowLeft, UserMinus, UserPlus, Search, X, Loader2, Edit2, Check, X as CloseIcon, Info } from 'lucide-vue-next'
import { useCourseStore } from '@/stores/course.store'
import { userApi } from '@/api/user.api'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/http-error'
import { useRole } from '@/composables/useRole'
import { roleLabelKey } from '@/i18n/role-labels'
import { useI18n } from 'vue-i18n' // <-- i18n importieren
import Card from '@/components/ui/Card.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import Modal from '@/components/ui/Modal.vue'
import type { User } from '@/types'

// ----------------------------------------------------------------
// Setup
// ----------------------------------------------------------------
const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()
const toast = useToast()
// Permission mirror: editing course name and managing members is the
// same staff-level capability the backend gates on course-teacher
// membership. We approximate with ``isStaff`` because the legacy view
// already did, and the API will still reject non-teachers.
const { isStaff } = useRole()
const { t } = useI18n() // <-- i18n initialisieren

const courseId = computed(() => String(route.params.id))

// --- Kursname bearbeiten ---
const isEditingName = ref(false)
const editNameValue = ref('')

const startEditName = () => {
  editNameValue.value = courseStore.currentCourse?.name || ''
  isEditingName.value = true
}

const cancelEditName = () => {
  isEditingName.value = false
}

const saveName = async () => {
  if (!editNameValue.value || editNameValue.value === courseStore.currentCourse?.name) {
    isEditingName.value = false
    return
  }
  try {
    await courseStore.updateCourse(courseId.value, { name: editNameValue.value })
    toast.success(t('CourseDetailView.toasts.nameUpdated'))
    isEditingName.value = false
  } catch (_err) {
    toast.error(t('CourseDetailView.toasts.nameUpdateError'))
  }
}

// ----------------------------------------------------------------
// Modal States (Mitglieder)
// ----------------------------------------------------------------
const showAddModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<User[]>([])
const isSearching = ref(false)
const selectedToAdd = ref<Map<string, User>>(new Map())
const isAddingMembers = ref(false)

const removingId = ref<string | null>(null)
const showRemoveModal = ref(false)
const memberToRemove = ref<User | null>(null)

// ----------------------------------------------------------------
// Loading
// ----------------------------------------------------------------
const loadCourse = async () => {
  try {
    await courseStore.fetchCourseById(courseId.value)
    if (courseStore.courses.length === 0) {
      await courseStore.fetchCourses()
    }
  } catch {
    toast.error(t('CourseDetailView.toasts.loadError'))
    router.push({ path: '/courses' })
  }
}

onMounted(loadCourse)
watch(courseId, loadCourse)

// ----------------------------------------------------------------
// User search & selection
// ----------------------------------------------------------------
const loadAvailableUsers = async () => {
  isSearching.value = true
  try {
    const { data } = await userApi.list({ role: 'student', limit: 100 })
    searchResults.value = data
  } catch {
    searchResults.value = []
    toast.error(t('CourseDetailView.toasts.loadUsersError'))
  } finally {
    isSearching.value = false
  }
}

let searchTimer: number | null = null
watch(searchQuery, (q) => {
  if (searchTimer) window.clearTimeout(searchTimer)
  const query = q.trim()

  if (query.length === 0) {
    loadAvailableUsers()
    return
  }
  if (query.length < 2) return

  searchTimer = window.setTimeout(async () => {
    isSearching.value = true
    try {
      const { data } = await userApi.search(query, 10)
      searchResults.value = data
    } catch {
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300) as unknown as number
})

const isAlreadyMember = (userId: string) =>
    courseStore.currentMembers.some((m) => m.userId === userId)

const getOtherCourseName = (userCourseId: string | undefined | null) => {
  if (!userCourseId || userCourseId === courseId.value) return null
  const found = courseStore.courses.find(c => c.courseId === userCourseId)
  return found ? found.name : t('CourseDetailView.otherCourseFallback')
}

const toggleSelection = (user: User) => {
  if (selectedToAdd.value.has(user.userId)) {
    selectedToAdd.value.delete(user.userId)
  } else {
    selectedToAdd.value.set(user.userId, user)
  }
  selectedToAdd.value = new Map(selectedToAdd.value)
}

const removeSelection = (userId: string) => {
  selectedToAdd.value.delete(userId)
  selectedToAdd.value = new Map(selectedToAdd.value)
}

const openAddModal = () => {
  searchQuery.value = ''
  selectedToAdd.value = new Map()
  showAddModal.value = true
  loadAvailableUsers()
}

const closeAddModal = () => {
  showAddModal.value = false
}

const submitAddMembers = async () => {
  if (selectedToAdd.value.size === 0) return
  isAddingMembers.value = true
  try {
    const ids = Array.from(selectedToAdd.value.keys())
    await courseStore.addMembers(courseId.value, ids)

    // Singular/plural for toasts.
    if (ids.length === 1) {
      toast.success(t('CourseDetailView.toasts.membersAddedSingular'))
    } else {
      toast.success(t('CourseDetailView.toasts.membersAddedPlural', { count: ids.length }))
    }
    closeAddModal()
  } catch (err: any) {
    toast.error(extractErrorMessage(err, t('CourseDetailView.toasts.addError')))
  } finally {
    isAddingMembers.value = false
  }
}

// ----------------------------------------------------------------
// Member removal
// ----------------------------------------------------------------
const requestRemoveMember = (user: User) => {
  memberToRemove.value = user
  showRemoveModal.value = true
}

const closeRemoveModal = () => {
  if (removingId.value) return
  showRemoveModal.value = false
  memberToRemove.value = null
}

const confirmRemoveMember = async () => {
  if (!memberToRemove.value) return
  const user = memberToRemove.value
  removingId.value = user.userId
  try {
    await courseStore.removeMember(courseId.value, user.userId)
    toast.success(t('CourseDetailView.toasts.memberRemoved'))
    showRemoveModal.value = false
    memberToRemove.value = null
  } catch (err: any) {
    toast.error(extractErrorMessage(err, t('CourseDetailView.toasts.removeError')))
  } finally {
    removingId.value = null
  }
}

// ----------------------------------------------------------------
// Display helpers
// ----------------------------------------------------------------
const memberCount = computed(() => courseStore.currentMembers.length)

const roleLabel = (role: string | undefined) => {
  // Centralized role labels for consistent translations across views.
  return t(roleLabelKey(role))
}

const roleClass = (role: string | undefined) => {
  switch (role) {
    case 'admin': return 'bg-red-50 text-red-700'
    case 'teacher': return 'bg-purple-50 text-purple-700'
    default: return 'bg-blue-50 text-blue-700'
  }
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <button
        @click="router.push('/courses')"
        class="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 text-sm"
    >
      <ArrowLeft :size="16" />
      {{ $t('CourseDetailView.back') }}
    </button>

    <div v-if="courseStore.isLoading && !courseStore.currentCourse" class="text-center py-16 text-gray-400">
      {{ $t('CourseDetailView.loading') }}
    </div>

    <div v-else-if="courseStore.currentCourse" class="space-y-6">
      <div class="flex items-start gap-5 border-b border-gray-100 pb-6">
        <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <GraduationCap :size="28" class="text-blue-600" />
        </div>
        <div class="flex-grow">
          <div v-if="!isEditingName" class="flex items-center gap-3">
            <h1 class="text-3xl font-bold text-gray-900">{{ courseStore.currentCourse.name }}</h1>
            <button
                v-if="isStaff"
                @click="startEditName"
                class="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition"
                :title="$t('CourseDetailView.editNameTitle')"
            >
              <Edit2 :size="20" />
            </button>
          </div>

          <div v-else class="flex items-center gap-2 max-w-md">
            <BaseInput v-model="editNameValue" @keyup.enter="saveName" auto-focus />
            <BaseButton @click="saveName" class="!p-2" :title="$t('CourseDetailView.save')">
              <Check :size="18" />
            </BaseButton>
            <BaseButton variant="ghost" @click="cancelEditName" class="!p-2" :title="$t('CourseDetailView.cancel')">
              <CloseIcon :size="18" />
            </BaseButton>
          </div>

          <p class="text-gray-500 text-sm mt-1">
            {{ memberCount === 1 ? $t('CourseDetailView.memberSingular', { count: memberCount }) : $t('CourseDetailView.memberPlural', { count: memberCount }) }}
          </p>
        </div>
      </div>

      <Card>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">{{ $t('CourseDetailView.membersTitle') }}</h2>
          <BaseButton
              v-if="isStaff"
              @click="openAddModal"
              class="flex items-center gap-2"
          >
            <UserPlus :size="16" />
            {{ $t('CourseDetailView.addMemberBtn') }}
          </BaseButton>
        </div>

        <div
            v-if="courseStore.currentMembers.length === 0"
            class="py-10 text-center text-gray-400 text-sm"
        >
          {{ $t('CourseDetailView.noMembers') }}
        </div>

        <ul v-else class="divide-y divide-gray-100">
          <li
              v-for="user in courseStore.currentMembers"
              :key="user.userId"
              class="flex items-center justify-between py-3"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-semibold">
                {{ (user.username || '?').charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="font-medium text-gray-900">{{ user.username }}</div>
                <div class="text-xs text-gray-500">{{ user.email }}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span
                  class="text-xs px-2 py-0.5 rounded font-medium"
                  :class="roleClass(user.role)"
              >
                {{ roleLabel(user.role) }}
              </span>
              <button
                  v-if="isStaff"
                  @click="requestRemoveMember(user)"
                  :disabled="removingId === user.userId"
                  class="p-2 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                  :title="$t('CourseDetailView.removeMemberTitle')"
              >
                <Loader2 v-if="removingId === user.userId" :size="16" class="animate-spin text-red-500" />
                <UserMinus v-else :size="16" class="text-red-600" />
              </button>
            </div>
          </li>
        </ul>
      </Card>
    </div>

    <Modal :show="showAddModal" @close="closeAddModal">
      <template #header>
        <h2 class="text-xl font-semibold">{{ $t('CourseDetailView.addModal.title') }}</h2>
      </template>

      <template #body>
        <div class="space-y-5">

          <div class="bg-blue-50 text-blue-800 p-3.5 rounded-lg text-sm flex gap-3 items-start border border-blue-100">
            <Info :size="18" class="mt-0.5 flex-shrink-0 text-blue-600" />
            <p v-html="$t('CourseDetailView.addModal.info')"></p>
          </div>

          <div class="relative">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                v-model="searchQuery"
                type="text"
                :placeholder="$t('CourseDetailView.addModal.searchPlaceholder')"
                class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div v-if="selectedToAdd.size > 0" class="flex flex-wrap gap-2">
            <span
                v-for="user in Array.from(selectedToAdd.values())"
                :key="user.userId"
                class="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-sm px-2 py-1 rounded"
            >
              {{ user.username }}
              <button @click="removeSelection(user.userId)" class="hover:text-emerald-900">
                <X :size="14" />
              </button>
            </span>
          </div>

          <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg overscroll-contain">
            <div v-if="isSearching" class="p-4 text-center text-gray-400 text-sm">
              {{ $t('CourseDetailView.addModal.loadingUsers') }}
            </div>
            <div
                v-else-if="searchResults.length === 0"
                class="p-4 text-center text-gray-400 text-sm"
            >
              {{ $t('CourseDetailView.addModal.noUsersFound') }}
            </div>
            <ul v-else class="divide-y divide-gray-100">
              <label
                  v-for="user in searchResults"
                  :key="user.userId"
                  class="flex items-center justify-between p-3 hover:bg-gray-50 transition select-none"
                  :class="isAlreadyMember(user.userId) ? 'opacity-75' : 'cursor-pointer'"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-semibold">
                    {{ (user.username || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-medium text-gray-900 text-sm">{{ user.username }}</div>
                    <div class="text-xs text-gray-500">{{ user.email }}</div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span v-if="isAlreadyMember(user.userId)" class="text-xs text-gray-400">
                    {{ $t('CourseDetailView.addModal.alreadyMember') }}
                  </span>
                  <template v-else>
                    <span
                        v-if="getOtherCourseName(user.courseId)"
                        class="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded"
                    >
                      {{ $t('CourseDetailView.addModal.inOtherCourse', { courseName: getOtherCourseName(user.courseId) }) }}
                    </span>
                    <input
                        type="checkbox"
                        :checked="selectedToAdd.has(user.userId)"
                        @change="toggleSelection(user)"
                        class="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </template>
                </div>
              </label>
            </ul>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="ghost" @click="closeAddModal" :disabled="isAddingMembers">
            {{ $t('CourseDetailView.addModal.cancel') }}
          </BaseButton>
          <BaseButton
              @click="submitAddMembers"
              :disabled="selectedToAdd.size === 0 || isAddingMembers"
          >
            {{ isAddingMembers ? $t('CourseDetailView.addModal.adding') : $t('CourseDetailView.addModal.addCount', { count: selectedToAdd.size }) }}
          </BaseButton>
        </div>
      </template>
    </Modal>

    <Modal :show="showRemoveModal" @close="closeRemoveModal">
      <template #header>
        <h2 class="text-xl font-semibold text-red-700">{{ $t('CourseDetailView.removeModal.title') }}</h2>
      </template>

      <template #body>
        <div class="space-y-3">
          <p class="text-gray-700" v-html="$t('CourseDetailView.removeModal.confirmPrompt', { username: memberToRemove?.username })"></p>
          <p class="text-sm text-gray-500">
            {{ $t('CourseDetailView.removeModal.warning') }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="ghost" @click="closeRemoveModal" :disabled="!!removingId">
            {{ $t('CourseDetailView.removeModal.cancel') }}
          </BaseButton>
          <BaseButton variant="red" @click="confirmRemoveMember" :disabled="!!removingId">
            {{ removingId ? $t('CourseDetailView.removeModal.removing') : $t('CourseDetailView.removeModal.remove') }}
          </BaseButton>
        </div>
      </template>
    </Modal>
  </div>
</template>