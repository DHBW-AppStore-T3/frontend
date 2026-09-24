<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDeploymentStore } from '@/stores/deployment.store'
import DeploymentProgressBar from '@/components/DeploymentProgressBar.vue'
import { 
  BarChart3, 
  Search,
  Check,
  Users,
  BookOpen,
  UserPlus
} from 'lucide-vue-next'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import type { User } from '@/types'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/http-error'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import CredentialMissingBanner from '@/components/CredentialMissingBanner.vue'

const { t } = useI18n()
const router = useRouter()
const store = useDeploymentStore()
const toast = useToast()
const credStore = useOpenStackCredentialsStore()

const courses = ref<any[]>([])

// Two separate lists: cache (initial) + current view (search/filter).
const allStudents = ref<any[]>([])
const students = ref<any[]>([])

// Cache map for every student ever seen (stable, keyed by keycloak_id).
const studentCache = ref(new Map<string, User>())

const studentSearchQuery = ref('')
const loadingCourses = ref(false)
const loadingStudents = ref(false)
const coursesError = ref<string | null>(null)
const studentsError = ref<string | null>(null)

// Selection tab: 'courses' or 'individuals'.
const activeTab = ref<'courses' | 'individuals'>('courses')

// Helper: store students in the cache (keyed by keycloak_id). Only overwrite
// when the new object has more info (e.g. firstName).
function cacheStudents(list: User[]) {
  for (const s of list || []) {
    if (!s?.keycloak_id || typeof s.keycloak_id !== 'string' || !s.keycloak_id.trim()) continue
    const existing = studentCache.value.get(s.keycloak_id)
    if (!existing || (s.firstName && !existing.firstName) || (s.lastName && !existing.lastName)) {
      studentCache.value.set(s.keycloak_id, s)
      store.studentCache.set(s.keycloak_id, s)
    }
  }
}

// Filtered list for individual search: shows search results, always returning
// the cached object when present.
const filteredStudents = computed(() => {
  // Base: empty query → empty list (no students without a search).
  if (!studentSearchQuery.value.trim()) {
    return []
  }
  // The backend already filtered by username/email/firstName/lastName (Keycloak
  // Admin API ``/users?search=…``), so we pass its response through and only use
  // the cached object when present (prevents duplicates).
  return students.value.map((s: any) => {
    const cached = s?.keycloak_id ? studentCache.value.get(s.keycloak_id) : undefined
    return cached || s
  }).filter(Boolean)
})

// Selected students: always resolved from the cache (stable, keyed by keycloak_id).
const selectedStudents = computed<User[]>(() => {
  return store.draft.studentIds
    .map((kid: string) => studentCache.value.get(kid))
    .filter((s): s is User => s !== undefined)
})

// Cache for students per course (lazy loading).
const courseStudentsCache = ref(new Map<string, User[]>())

// Helper: return all student IDs of a course (lazy loading).
async function getStudentIdsForCourse(courseId: string): Promise<string[]> {
  // Check the cache.
  if (courseStudentsCache.value.has(courseId)) {
    const students = courseStudentsCache.value.get(courseId)!
    return students.map((s: any) => s.keycloak_id)
  }

  // Load students for this course.
  try {
    const res = await courseApi.getById(courseId)
    const students = res.data.users || []
    courseStudentsCache.value.set(courseId, students)
    // Also cache in studentCache.
    cacheStudents(students)
    return students.map((s: any) => s.keycloak_id)
  } catch (err) {
    console.error(`Failed to load students for course ${courseId}:`, err)
    return []
  }
}

// Loading states for courses.
const loadingCourseStudents = ref(new Set<string>())

// Helper: return the student count per course (lazy loading).
function getStudentCountForCourse(courseId: string) {
  if (courseStudentsCache.value.has(courseId)) {
    return courseStudentsCache.value.get(courseId)!.length
  }
  // Load lazily if not loaded.
  if (!loadingCourseStudents.value.has(courseId)) {
    loadingCourseStudents.value.add(courseId)
    getStudentIdsForCourse(courseId).then(() => {
      loadingCourseStudents.value.delete(courseId)
    }).catch(() => {
      loadingCourseStudents.value.delete(courseId)
    })
  }
  return 0 // placeholder while loading
}

// Course checkbox: checked when all students of the course are selected.
function isCourseSelected(courseId: string) {
  if (!courseStudentsCache.value.has(courseId)) {
    return false // not loaded yet
  }
  const studentIds = courseStudentsCache.value.get(courseId)!.map((s: any) => s.keycloak_id)
  return studentIds.length > 0 && studentIds.every((id) => store.draft.studentIds.includes(id))
}

// Course checkbox toggle: select/deselect all students of the course.
const toggleCourse = async (courseId: string) => {
  const studentIds = await getStudentIdsForCourse(courseId)
  if (studentIds.length === 0) {
    toast.warning(t('CourseDetailView.addModal.noUsersFound'))
    return
  }
  const allSelected = studentIds.length > 0 && studentIds.every((id) => store.draft.studentIds.includes(id))
  if (allSelected) {
    // Deselect: remove all students of this course from the selection.
    store.draft.studentIds = store.draft.studentIds.filter((id: string) => !studentIds.includes(id))
  } else {
    // Select: add all students of this course to the selection (no duplicates).
    const set = new Set([...store.draft.studentIds, ...studentIds])
    store.draft.studentIds = Array.from(set)
  }
  // Sync the course-selection list.
  syncCourseSelection()
}

// Toggle a student checkbox (for individual selection).
const toggleStudent = (studentKeycloakId: string) => {
  if (!studentKeycloakId || typeof studentKeycloakId !== 'string' || !studentKeycloakId.trim()) return
  const index = store.draft.studentIds.indexOf(studentKeycloakId)
  if (index > -1) {
    store.draft.studentIds.splice(index, 1)
  } else {
    store.draft.studentIds.push(studentKeycloakId)
  }
  // After each toggle: sync the course selection.
  syncCourseSelection()
}

// Sync store.draft.courseIds with the current student selection state.
async function syncCourseSelection() {
  // For each course: if all students are selected, include it in courseIds.
  const newCourseIds: string[] = []
  for (const course of courses.value) {
    if (courseStudentsCache.value.has(course.courseId)) {
      const studentIds = courseStudentsCache.value.get(course.courseId)!.map((s: any) => s.keycloak_id)
      if (studentIds.length > 0 && studentIds.every((id) => store.draft.studentIds.includes(id))) {
        newCourseIds.push(course.courseId)
      }
    }
  }
  store.draft.courseIds = newCourseIds
}

const handleNext = () => {
  // Block if credentials missing — banner already explains why
  if (!credStore.hasCredential) {
    toast.warning(t('AppsDetailView.missingCredsTitle'))
    return
  }

  // Check that the name is filled in.
  if (!store.draft.name || store.draft.name.trim() === '') {
    toast.warning(t('deployment.errors.missingName'))
    return
  }

  // Check that at least one student is selected.
  if (store.draft.studentIds.length === 0) {
    toast.warning(t('deployment.errors.missingStudents'))
    return
  }
  router.push({ name: 'deployment.teams' })
}

const handleBack = () => {
  const appId = store.draft.appId
  if (appId) {
    router.push({ name: 'apps.detail', params: { id: appId } })
  } else {
    router.push('/apps')
  }
}

// Load courses.
async function loadCourses() {
  loadingCourses.value = true
  coursesError.value = null
  try {
    const res = await courseApi.list(0, 200)
    courses.value = res.data || []
  } catch (_err) {
    coursesError.value = t('CoursesView.toasts.loadError')
    toast.error(coursesError.value)
  } finally {
    loadingCourses.value = false
  }
}

// Load the initial student list (cached).
async function loadAllStudents() {
  loadingStudents.value = true
  studentsError.value = null
  try {
    const res = await userApi.list({ role: 'student', limit: 1000 })
    allStudents.value = res.data || []
    students.value = allStudents.value
    cacheStudents(allStudents.value)
  } catch (_err) {
    studentsError.value = t('CourseDetailView.toasts.loadUsersError')
    toast.error(studentsError.value)
  } finally {
    loadingStudents.value = false
  }
}

// Search with debouncing.
let searchTimer: number | undefined
watch(studentSearchQuery, (val) => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(async () => {
    const q = val?.trim() || ''

    // Empty query: show the initial list (no extra API call).
    if (!q) {
      students.value = allStudents.value
      toast.clear()
      return
    }

    // Query too short: keep the current list (no flicker).
    if (q.length < 2) {
      toast.clear()
      return
    }

    // Perform the search.
    try {
      loadingStudents.value = true
      const res = await userApi.search(q, 50)
      toast.clear()
      students.value = res.data || []
      cacheStudents(students.value) // Cache new students (keyed by keycloak_id)
    } catch (err) {
      console.error('User search error:', err)
      const e: any = err
      const msg = extractErrorMessage(e, t('CourseDetailView.toasts.loadUsersError'))
      toast.error(msg)
    } finally {
      loadingStudents.value = false
    }
  }, 300)
})

// On mount, load courses + the initial students.
onMounted(async () => {
  // Ensure cred state is fresh; banner branch shows when missing
  if (!credStore.status) await credStore.fetch()
  await loadCourses()
  await loadAllStudents()
})
</script>

<template>
  <div class="max-w-6xl mx-auto w-full">
    
    <div class="bg-white rounded-2xl p-10 border shadow-sm min-h-[700px] flex flex-col">
      
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          {{ t('deployment.title') }}
        </h1>
        <BarChart3 :size="32" class="text-emerald-600" />
      </div>

      <DeploymentProgressBar :current-step="1" />

      <CredentialMissingBanner
        v-if="credStore.isResolved && !credStore.hasCredential"
        variant="warning"
        :title="t('AppsDetailView.missingCredsTitle')"
        :message="t('AppsDetailView.missingCredsText')"
        :cta="t('AppsDetailView.missingCredsLink')"
        ctaTo="/user/openstack"
        next="/deployment/new/config"
        class="mb-6"
      />

      <template v-if="!credStore.isResolved || credStore.hasCredential">
      <div class="mb-8">
        <label class="block text-xl font-bold text-gray-900 mb-3">
          {{ t('deployment.config.nameLabel') }}
        </label>
        <input 
          v-model="store.draft.name"
          type="text" 
          :placeholder="t('deployment.config.namePlaceholder')"
          data-testid="deployment-name"
          class="w-full px-4 py-3 rounded-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
        />
      </div>

      <div class="flex-grow">
        <h2 class="text-xl font-bold text-gray-900 mb-4">
          {{ t('deployment.config.targetGroupTitle') }}
        </h2>

        <div class="flex border-b border-gray-200 mb-6">
          <button
            @click="activeTab = 'courses'"
            class="px-6 py-3 font-semibold transition-colors border-b-2"
            :class="activeTab === 'courses' 
              ? 'border-emerald-500 text-emerald-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            <BookOpen :size="20" class="inline mr-2" />
            {{ t('deployment.config.courseLabel') }}
          </button>
          <button
            @click="activeTab = 'individuals'"
            class="px-6 py-3 font-semibold transition-colors border-b-2"
            :class="activeTab === 'individuals' 
              ? 'border-emerald-500 text-emerald-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            <UserPlus :size="20" class="inline mr-2" />
            {{ t('deployment.config.studentsLabel') }}
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div>
            <div v-if="activeTab === 'courses'">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ t('CoursesView.title') }}</h3>
              <div class="space-y-3 max-h-[400px] overflow-y-auto">
                <div 
                  v-for="course in courses"
                  :key="course.courseId"
                  @click="toggleCourse(course.courseId)"
                  :data-testid="`course-${course.courseId}`"
                  class="flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all"
                  :class="isCourseSelected(course.courseId) 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'"
                >
                  <div class="w-6 h-6 flex items-center justify-center rounded border transition-colors"
                       :class="isCourseSelected(course.courseId) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-400 bg-white'"
                  >
                     <Check v-if="isCourseSelected(course.courseId)" :size="16" class="text-white" />
                  </div>
                  <div class="flex-grow">
                    <div class="font-semibold text-gray-900">{{ course.name }}</div>
                    <div class="text-sm text-gray-600">
                      <span v-if="loadingCourseStudents.has(course.courseId)">{{ t('CoursesView.loading') }}</span>
                      <span v-else>{{ t('DeploymentDetailView.deploymentStudentCount', getStudentCountForCourse(course.courseId)) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'individuals'">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ t('deployment.config.studentsLabel') }}</h3>
              
              <div class="relative mb-4">
                <Search class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" :size="20" />
                <input 
                  v-model="studentSearchQuery"
                  type="text"
                  :placeholder="t('deployment.config.searchPlaceholder')"
                  data-testid="student-search"
                  class="w-full pl-12 pr-4 py-3 rounded-full border-2 border-gray-200 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div class="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 max-h-[350px] overflow-y-auto">
                <div 
                  v-for="student in filteredStudents"
                  :key="student.keycloak_id ?? student.userId"
                  @click="toggleStudent(student.keycloak_id)"
                  :data-testid="`student-${student.keycloak_id}`"
                  class="flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-b-0 border-gray-200 transition-colors select-none"
                  :class="store.draft.studentIds.includes(student.keycloak_id) ? 'bg-emerald-50' : 'hover:bg-gray-100'"
                >
                  <div class="w-6 h-6 flex items-center justify-center rounded border transition-colors"
                       :class="store.draft.studentIds.includes(student.keycloak_id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-400 bg-white'"
                  >
                     <Check v-if="store.draft.studentIds.includes(student.keycloak_id)" :size="16" class="text-white" />
                  </div>
                  <span class="text-gray-700 font-medium">
                    {{ (student.firstName || student.lastName) 
                        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                        : (student.username || student.email || student.keycloak_id) }}
                  </span>
                </div>
                
                <div v-if="filteredStudents.length === 0" class="p-4 text-gray-500 text-center">
                  {{ t('CourseDetailView.addModal.noUsersFound') }}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users :size="20" />
              {{ t('deployment.groups.studentsSelected', { count: selectedStudents.length }) }}
            </h3>
            
            <div class="bg-gray-50 rounded-lg border-2 border-gray-200 p-4 max-h-[400px] overflow-y-auto">
              <div v-if="selectedStudents.length === 0" class="text-gray-500 text-center py-8">
                {{ t('deployment.assignment.noStudents') }}
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="student in selectedStudents"
                  :key="student.keycloak_id ?? student.userId"
                  class="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                >
                  <span class="text-gray-700 font-medium">
                    {{ (student.firstName || student.lastName) 
                        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                        : (student.username || student.email || student.keycloak_id) }}
                  </span>
                  <button 
                    @click="toggleStudent(student.keycloak_id ?? '')" 
                    class="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                    :title="t('CourseDetailView.removeModal.remove')"
                    :data-testid="`remove-${student.keycloak_id ?? student.userId}`"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="text-sm text-blue-800">
                <strong>{{ t('deployment.config.infoTitle') }}</strong> {{ t('deployment.config.infoText') }}
              </p>
            </div>
          </div>

        </div>
      </div>
      </template>

      <div class="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
        <button 
          @click="handleBack"
          data-testid="btn-back"
          class="px-8 py-2.5 rounded-full bg-gray-400 text-white font-semibold hover:bg-gray-500 transition-colors"
        >
          {{ t('deployment.actions.back') }}
        </button>
        
        <button
          @click="handleNext"
          data-testid="btn-next"
          :disabled="credStore.isResolved && !credStore.hasCredential"
          class="px-8 py-2.5 rounded-full bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ t('deployment.actions.next') }}
        </button>
      </div>

    </div>
  </div>
</template>