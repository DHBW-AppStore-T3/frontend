import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Search, Check, Users, BookOpen, UserPlus } from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import CredentialMissingBanner from '@/components/CredentialMissingBanner'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { paths } from '@/router/paths'
import { useStudentDirectory } from './new-deployment/useStudentDirectory'
import { useDeploymentRuntime } from './new-deployment/useDeploymentRuntime'
import CredentialPicker from './new-deployment/CredentialPicker'
import QuotaWarningBanner from './new-deployment/QuotaWarningBanner'
import { useDeploymentQuotaWarnings } from './new-deployment/quotaWarnings'
import {
  deriveCourseIds,
  displayNameOf,
  isCourseFullySelected,
  toggleCourseSelection,
  toggleId,
} from './new-deployment/studentSelection'

type Tab = 'courses' | 'individuals'

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
        checked ? 'bg-primary border-primary' : 'border-gray-400 bg-white'
      }`}
    >
      {checked ? <Check size={16} className="text-white" /> : null}
    </div>
  )
}

export default function NewDeploymentConfigView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()

  const draft = useDeploymentStore((s) => s.draft)
  const directory = useStudentDirectory()
  const runtime = useDeploymentRuntime()
  const { credentialsMissing } = runtime
  const quotaWarnings = useDeploymentQuotaWarnings(runtime.needsCredential ? runtime.credentialId : null)
  const [activeTab, setActiveTab] = useState<Tab>('courses')
  const updateDraft = useDeploymentStore.getState().updateDraft

  // Keep the course selection in sync with the student selection.
  const applyStudentIds = (studentIds: string[]) => {
    updateDraft({
      studentIds,
      courseIds: deriveCourseIds(
        directory.courses.map((c) => c.courseId),
        directory.membersByCourse,
        studentIds,
      ),
    })
  }

  const toggleCourse = async (courseId: string) => {
    const memberIds = directory.membersByCourse.get(courseId) ?? (await directory.loadCourseMembers(courseId))
    if (memberIds.length === 0) {
      toast.warning(t('CourseDetailView.addModal.noUsersFound'))
      return
    }
    // Read the latest selection: the member load above may have awaited.
    const current = useDeploymentStore.getState().draft.studentIds
    applyStudentIds(toggleCourseSelection(current, memberIds))
  }

  const toggleStudent = (userId: string | null | undefined) => {
    if (!userId) return
    applyStudentIds(toggleId(useDeploymentStore.getState().draft.studentIds, userId))
  }

  const selectedStudents = useMemo(
    () => draft.studentIds.map((id) => directory.cache.get(id)).filter((s) => s !== undefined),
    [draft.studentIds, directory.cache],
  )

  // The backend already filtered by the query; reuse cached objects (richer data).
  const searchResults = directory.query.trim()
    ? directory.students.map((s) => (s.userId ? (directory.cache.get(s.userId) ?? s) : s))
    : []

  const handleNext = () => {
    // VM apps run in the project of a credential the caller picks; pods need none.
    if (runtime.needsCredential && !runtime.credentialId) {
      toast.warning(t('deployment.config.credentialRequired'))
      return
    }
    if (!draft.name || draft.name.trim() === '') {
      toast.warning(t('deployment.errors.missingName'))
      return
    }
    if (draft.studentIds.length === 0) {
      toast.warning(t('deployment.errors.missingStudents'))
      return
    }
    navigate(paths.deploymentTeams)
  }

  const handleBack = () => navigate(draft.appId ? paths.app(draft.appId) : paths.apps)

  const tabClass = (tab: Tab) =>
    `px-6 py-3 font-semibold transition-colors border-b-2 ${
      activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMuted'
    }`

  return (
    <div className="app-page wizard-page">
      <div className="wizard-surface flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-textHeading">{t('deployment.title')}</h1>
          <BarChart3 size={32} className="text-primary" />
        </div>

        <DeploymentProgressBar currentStep={1} />

        {credentialsMissing ? (
          <div className="mb-6">
            <CredentialMissingBanner
              variant="warning"
              title={t('AppsDetailView.missingCredsTitle')}
              message={t('AppsDetailView.missingCredsText')}
              cta={t('AppsDetailView.missingCredsLink')}
              ctaTo={paths.userOpenStack}
              next={paths.deploymentConfig}
            />
          </div>
        ) : (
          <>
            {runtime.needsCredential ? (
              <>
                <CredentialPicker
                  credentials={runtime.usableCredentials}
                  value={runtime.credentialId}
                  onChange={(credentialId) => updateDraft({ credentialId })}
                />
                <QuotaWarningBanner warnings={quotaWarnings.warnings} />
              </>
            ) : null}

            <div className="mb-8">
              <label className="block text-xl font-bold text-textHeading mb-3">
                {t('deployment.config.nameLabel')}
              </label>
              <input
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                type="text"
                placeholder={t('deployment.config.namePlaceholder')}
                data-testid="deployment-name"
                className="w-full px-4 py-3 rounded-full border-2 border-borderSubtle focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="flex-grow">
              <h2 className="text-xl font-bold text-textHeading mb-4">{t('deployment.config.targetGroupTitle')}</h2>

              <div className="flex border-b border-borderSubtle mb-6">
                <button type="button" onClick={() => setActiveTab('courses')} className={tabClass('courses')}>
                  <BookOpen size={20} className="inline mr-2" />
                  {t('deployment.config.courseLabel')}
                </button>
                <button type="button" onClick={() => setActiveTab('individuals')} className={tabClass('individuals')}>
                  <UserPlus size={20} className="inline mr-2" />
                  {t('deployment.config.studentsLabel')}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  {activeTab === 'courses' ? (
                    <div>
                      <h3 className="text-lg font-semibold text-textHeading mb-4">{t('CoursesView.title')}</h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {directory.courses.map((course) => {
                          const members = directory.membersByCourse.get(course.courseId)
                          const selected = !!members && isCourseFullySelected(members, draft.studentIds)
                          return (
                            <div
                              key={course.courseId}
                              onClick={() => void toggleCourse(course.courseId)}
                              data-testid={`course-${course.courseId}`}
                              className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                selected
                                  ? 'bg-primaryFaint border-primary/30'
                                  : 'bg-surfaceMuted border-borderSubtle hover:border-borderSubtle'
                              }`}
                            >
                              <Checkbox checked={selected} />
                              <div className="flex-grow">
                                <div className="font-semibold text-textHeading">{course.name}</div>
                                <div className="text-sm text-textMuted">
                                  {directory.loadingCourseIds.has(course.courseId) ? (
                                    <span>{t('CoursesView.loading')}</span>
                                  ) : (
                                    <span>
                                      {t('DeploymentDetailView.deploymentStudentCount', { count: members?.length ?? 0 })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-textHeading mb-4">
                        {t('deployment.config.studentsLabel')}
                      </h3>

                      <div className="relative mb-4">
                        <Search
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-textFaint"
                          size={20}
                        />
                        <input
                          value={directory.query}
                          onChange={(e) => directory.setQuery(e.target.value)}
                          type="text"
                          placeholder={t('deployment.config.searchPlaceholder')}
                          data-testid="student-search"
                          className="w-full pl-12 pr-4 py-3 rounded-full border-2 border-borderSubtle focus:border-primary outline-none transition-all"
                        />
                      </div>

                      <div className="bg-surfaceMuted rounded-lg overflow-hidden border-2 border-borderSubtle max-h-[350px] overflow-y-auto">
                        {searchResults.map((student) => {
                          const checked = draft.studentIds.includes(student.userId)
                          return (
                            <div
                              key={student.userId}
                              onClick={() => toggleStudent(student.userId)}
                              data-testid={`student-${student.userId}`}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-b-0 border-borderSubtle transition-colors select-none ${
                                checked ? 'bg-primaryFaint' : 'hover:bg-surfaceMuted'
                              }`}
                            >
                              <Checkbox checked={checked} />
                              <span className="text-textMuted font-medium">{displayNameOf(student)}</span>
                            </div>
                          )
                        })}

                        {searchResults.length === 0 ? (
                          <div className="p-4 text-textMuted text-center">
                            {t('CourseDetailView.addModal.noUsersFound')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-textHeading mb-4 flex items-center gap-2">
                    <Users size={20} />
                    {t('deployment.groups.studentsSelected', { count: selectedStudents.length })}
                  </h3>

                  <div className="bg-surfaceMuted rounded-lg border-2 border-borderSubtle p-4 max-h-[400px] overflow-y-auto">
                    {selectedStudents.length === 0 ? (
                      <div className="text-textMuted text-center py-8">{t('deployment.assignment.noStudents')}</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedStudents.map((student) => (
                          <div
                            key={student.userId}
                            className="flex items-center justify-between bg-white p-3 rounded-lg border border-borderSubtle"
                          >
                            <span className="text-textMuted font-medium">{displayNameOf(student)}</span>
                            <button
                              type="button"
                              onClick={() => toggleStudent(student.userId)}
                              className="text-danger hover:text-red-700 font-bold text-lg leading-none"
                              title={t('CourseDetailView.removeModal.remove')}
                              data-testid={`remove-${student.userId}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-4 bg-infoTint border border-info/30 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{t('deployment.config.infoTitle')}</strong> {t('deployment.config.infoText')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between items-center mt-8 pt-4 border-t border-borderSubtle">
          <button
            type="button"
            onClick={handleBack}
            data-testid="btn-back"
            className="px-8 py-2.5 rounded-full bg-gray-400 text-white font-semibold hover:bg-surfaceMuted0 transition-colors"
          >
            {t('deployment.actions.back')}
          </button>

          <button
            type="button"
            onClick={handleNext}
            data-testid="btn-next"
            disabled={credentialsMissing}
            className="px-8 py-2.5 rounded-full bg-success text-white font-bold hover:bg-successHover transition-colors shadow-lg shadow-success/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('deployment.actions.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
