import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useDevStore } from './store/devStore'
import useThemeStore from './stores/themeStore'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import bugReportRecorder from './utils/bugReportRecorder'

// Layouts (kept eager as they are lightweight wrappers)
import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'

// Auth Pages (lazy-loaded)
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ForceChangePasswordPage = lazy(() => import('./pages/auth/ForceChangePasswordPage'))

// Admin Pages (lazy-loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const ProjectManagement = lazy(() => import('./pages/admin/ProjectManagement'))
const KpiManagement = lazy(() => import('./pages/admin/KpiManagement'))
const BugReports = lazy(() => import('./pages/admin/BugReports'))
const Library = lazy(() => import('./pages/admin/Library'))

// User Pages (lazy-loaded)
const UserDashboard = lazy(() => import('./pages/user/UserDashboard'))
const MyProjects = lazy(() => import('./pages/user/MyProjects'))
const KpiSubmission = lazy(() => import('./pages/user/KpiSubmission'))
const KpiHistory = lazy(() => import('./pages/user/KpiHistory'))
const Training = lazy(() => import('./pages/user/Training'))

// SOR Pages (lazy-loaded)
const SorSubmission = lazy(() => import('./pages/sor/SorSubmission'))

// Shared Pages (lazy-loaded)
const ProjectDetails = lazy(() => import('./pages/shared/ProjectDetails'))
const Profile = lazy(() => import('./pages/shared/Profile'))
const NotFound = lazy(() => import('./pages/shared/NotFound'))
const AwarenessSession = lazy(() => import('./pages/shared/AwarenessSession'))
const WorkPermits = lazy(() => import('./pages/shared/WorkPermits'))
const Inspections = lazy(() => import('./pages/shared/Inspections'))
const Workers = lazy(() => import('./pages/shared/Workers'))
const PpeManagement = lazy(() => import('./pages/shared/PpeManagement'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const SubcontractorOpenings = lazy(() => import('./pages/shared/SubcontractorOpenings'))
const SubcontractorOpeningDetails = lazy(() => import('./pages/shared/SubcontractorOpeningDetails'))
const EffectifSubmission = lazy(() => import('./pages/shared/EffectifSubmission'))
const EffectifAnalytics = lazy(() => import('./pages/shared/EffectifAnalytics'))
const VeilleReglementaireHistory = lazy(() => import('./pages/shared/VeilleReglementaireHistory'))
const VeilleReglementaireDetails = lazy(() => import('./pages/shared/VeilleReglementaireDetails'))
const VeilleReglementaireForm = lazy(() => import('./pages/shared/VeilleReglementaireForm'))
const HseEvents = lazy(() => import('./pages/shared/HseEvents'))
const MonthlyMeasurements = lazy(() => import('./pages/shared/MonthlyMeasurements'))
const LightingMeasurements = lazy(() => import('./pages/shared/LightingMeasurements'))
const WasteManagement = lazy(() => import('./pages/shared/WasteManagement'))

// Heavy Machinery Tracking (lazy-loaded)
const HeavyMachineryViewMachines = lazy(() => import('./pages/shared/heavyMachinery/ViewMachines'))
const HeavyMachineryGlobalSearch = lazy(() => import('./pages/shared/heavyMachinery/GlobalSearch'))
const HeavyMachineryExpiredDocumentation = lazy(() => import('./pages/shared/heavyMachinery/ExpiredDocumentation'))

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = [], enforceAllowedRoles = false }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { simulatedRole } = useDevStore()
  const location = useLocation()

  const adminLikeRoles = ['admin', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director']

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.must_change_password && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace />
  }

  const actualRole = user?.role
  const role = actualRole === 'dev' && simulatedRole ? simulatedRole : actualRole

  // Admin-like roles have access to all authenticated routes (unless this route explicitly enforces allowedRoles)
  if (adminLikeRoles.includes(role) && !enforceAllowedRoles) {
    return children
  }

  // Dev can access all authenticated routes when not simulating a role
  if (actualRole === 'dev' && !simulatedRole) {
    return children
  }

  if (adminOnly && !adminLikeRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  // Check if user's role is allowed for this route
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect based on user's actual role
    if (role === 'user') {
      return <Navigate to="/sor" replace />
    } else if (role === 'supervisor') {
      return <Navigate to="/supervisor" replace />
    } else if (role === 'hr') {
      return <Navigate to="/hr" replace />
    } else if (adminLikeRoles.includes(role)) {
      return <Navigate to="/admin" replace />
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

const QualifiedPersonnelRedirect = ({ basePath }) => {
  const location = useLocation()

  // Preserve deep-link query params like ?worker_id=... when migrating legacy routes.
  return <Navigate to={`${basePath}${location.search || ''}`} replace />
}

const normalizeRegulatoryWatchCategory = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'environment' || raw === 'environnement') return 'environment'
  return 'sst'
}

const RegulatoryWatchNewRedirect = ({ basePath }) => {
  const params = useParams()
  const category = normalizeRegulatoryWatchCategory(params?.category)
  return <Navigate to={`${basePath}/${category}/new/1`} replace />
}

const RegulatoryWatchLegacyNewPageRedirect = ({ basePath }) => {
  const params = useParams()
  const page = String(params?.page || '1')
  return <Navigate to={`${basePath}/sst/new/${page}`} replace />
}

const RegulatoryWatchLegacyResubmitRedirect = ({ basePath }) => {
  const params = useParams()
  const id = params?.id
  if (!id) return <Navigate to={`${basePath}/sst`} replace />
  return <Navigate to={`${basePath}/sst/${id}/resubmit`} replace />
}

const RegulatoryWatchLegacyResubmitPageRedirect = ({ basePath }) => {
  const params = useParams()
  const id = params?.id
  const page = String(params?.page || '1')
  if (!id) return <Navigate to={`${basePath}/sst`} replace />
  return <Navigate to={`${basePath}/sst/${id}/resubmit/${page}`} replace />
}

const RegulatoryWatchCategoryOrLegacyIdRoute = ({ basePath }) => {
  const params = useParams()
  const raw = String(params?.category || '').trim().toLowerCase()
  const normalized = normalizeRegulatoryWatchCategory(raw)

  if (raw === 'sst' || raw === 'environment' || raw === 'environnement') {
    if (raw !== normalized) {
      return <Navigate to={`${basePath}/${normalized}`} replace />
    }
    return <VeilleReglementaireHistory />
  }

  if (params?.category) {
    return <Navigate to={`${basePath}/sst/${params.category}`} replace />
  }

  return <Navigate to={`${basePath}/sst`} replace />
}

// Guest Route Component (redirect if already logged in)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { simulatedRole } = useDevStore()

  const adminLikeRoles = ['admin', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director']

  if (isAuthenticated) {
    if (user?.must_change_password) {
      return <Navigate to="/force-change-password" replace />
    }
    const actualRole = user?.role
    const role = actualRole === 'dev' && simulatedRole ? simulatedRole : actualRole
    if (adminLikeRoles.includes(role)) {
      return <Navigate to="/admin" replace />
    } else if (actualRole === 'dev' && !simulatedRole) {
      return <Navigate to="/admin" replace />
    } else if (role === 'user') {
      return <Navigate to="/sor" replace />
    } else if (role === 'supervisor') {
      return <Navigate to="/supervisor" replace />
    } else if (role === 'hr') {
      return <Navigate to="/hr" replace />
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

const DashboardHome = () => {
  const { user } = useAuthStore()
  const { simulatedRole } = useDevStore()

  const actualRole = user?.role
  const role = actualRole === 'dev' && simulatedRole ? simulatedRole : actualRole

  if (role === 'hse_manager' || role === 'regional_hse_manager') {
    return <AdminDashboard />
  }

  return <UserDashboard />
}

function App() {
  const initTheme = useThemeStore((state) => state.initTheme)
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    bugReportRecorder.trackRoute({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  }, [location.pathname, location.search, location.hash])

  return (
    <ErrorBoundary
      name="App"
      context={{
        route: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        auth: {
          isAuthenticated: !!isAuthenticated,
          userId: user?.id ?? null,
          role: user?.role ?? null,
        },
      }}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
            <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
          </div>
        }
      >
        <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />

        <Route
          path="/force-change-password"
          element={
            <ProtectedRoute>
              <ForceChangePasswordPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Admin Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['admin', 'consultation', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director', 'hse_manager', 'regional_hse_manager', 'responsable']}
            enforceAllowedRoles
          >
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/hse-events" element={<HseEvents />} />
        <Route path="/admin/monthly-measurements" element={<MonthlyMeasurements />} />
        <Route path="/admin/lighting" element={<LightingMeasurements />} />
        <Route path="/admin/waste-management" element={<WasteManagement />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['admin', 'consultation', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director', 'hse_manager', 'regional_hse_manager']}
            enforceAllowedRoles
          >
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/kpi" element={<KpiManagement />} />
        <Route path="/admin/kpi-history" element={<KpiHistory />} />
      </Route>

      <Route
        element={
          <ProtectedRoute adminOnly>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/projects" element={<ProjectManagement />} />
        <Route path="/admin/projects/:id" element={<ProjectDetails />} />
        <Route path="/admin/bug-reports" element={<BugReports />} />
        <Route
          path="/admin/library"
          element={
            <ProtectedRoute allowedRoles={['admin', 'consultation', 'dev']} enforceAllowedRoles>
              <Library />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/effectif"
          element={
            <ProtectedRoute allowedRoles={['admin', 'hr_director', 'dev']} enforceAllowedRoles>
              <EffectifAnalytics />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/training" element={<Training />} />
        <Route path="/admin/awareness" element={<AwarenessSession />} />
        <Route path="/admin/sor" element={<SorSubmission />} />
        <Route path="/admin/work-permits" element={<WorkPermits />} />
        <Route path="/admin/inspections" element={<Inspections />} />
        <Route path="/admin/regulatory-watch" element={<Navigate to="/admin/regulatory-watch/sst" replace />} />
        <Route path="/admin/regulatory-watch/new" element={<Navigate to="/admin/regulatory-watch/sst/new/1" replace />} />
        <Route path="/admin/regulatory-watch/new/:page" element={<RegulatoryWatchLegacyNewPageRedirect basePath="/admin/regulatory-watch" />} />
        <Route path="/admin/regulatory-watch/:id/resubmit" element={<RegulatoryWatchLegacyResubmitRedirect basePath="/admin/regulatory-watch" />} />
        <Route path="/admin/regulatory-watch/:id/resubmit/:page" element={<RegulatoryWatchLegacyResubmitPageRedirect basePath="/admin/regulatory-watch" />} />
        <Route path="/admin/regulatory-watch/:category" element={<RegulatoryWatchCategoryOrLegacyIdRoute basePath="/admin/regulatory-watch" />} />
        <Route path="/admin/regulatory-watch/:category/new" element={<RegulatoryWatchNewRedirect basePath="/admin/regulatory-watch" />} />
        <Route path="/admin/regulatory-watch/:category/new/:page" element={<VeilleReglementaireForm mode="new" />} />
        <Route
          path="/admin/regulatory-watch/:category/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'hse_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']} enforceAllowedRoles>
              <VeilleReglementaireDetails />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/regulatory-watch/:category/:id/resubmit" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/admin/regulatory-watch/:category/:id/resubmit/:page" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/admin/workers" element={<Workers />} />
        <Route
          path="/admin/ppe"
          element={
            <ProtectedRoute allowedRoles={['admin', 'dev', 'pole_director', 'works_director', 'hse_director']} enforceAllowedRoles>
              <PpeManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/qualified-personnel" element={<QualifiedPersonnelRedirect basePath="/admin/workers" />} />
        <Route path="/admin/subcontractors" element={<SubcontractorOpenings />} />
        <Route path="/admin/subcontractors/openings/:id" element={<SubcontractorOpeningDetails />} />
        <Route path="/admin/profile" element={<Profile />} />
      </Route>

      {/* HSE Officer Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/sor" element={<SorSubmission />} />
        <Route path="/sor/projects" element={<MyProjects showKpiButton={false} />} />
        <Route path="/sor/projects/:id" element={<ProjectDetails />} />
        <Route path="/sor/awareness" element={<AwarenessSession />} />
        <Route path="/sor/profile" element={<Profile />} />
      </Route>

      {/* Supervisor Routes (Sup.USER) - same as HSE Officer + training + work permits */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['supervisor']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/supervisor" element={<SorSubmission />} />
        <Route path="/supervisor/projects" element={<MyProjects showKpiButton={false} />} />
        <Route path="/supervisor/projects/:id" element={<ProjectDetails />} />
        <Route path="/supervisor/awareness" element={<AwarenessSession />} />
        <Route path="/supervisor/training" element={<Training />} />
        <Route path="/supervisor/work-permits" element={<WorkPermits />} />
        <Route path="/supervisor/inspections" element={<Inspections />} />
        <Route path="/supervisor/regulatory-watch" element={<Navigate to="/supervisor/regulatory-watch/sst" replace />} />
        <Route path="/supervisor/regulatory-watch/new" element={<Navigate to="/supervisor/regulatory-watch/sst/new/1" replace />} />
        <Route path="/supervisor/regulatory-watch/new/:page" element={<RegulatoryWatchLegacyNewPageRedirect basePath="/supervisor/regulatory-watch" />} />
        <Route path="/supervisor/regulatory-watch/:id/resubmit" element={<RegulatoryWatchLegacyResubmitRedirect basePath="/supervisor/regulatory-watch" />} />
        <Route path="/supervisor/regulatory-watch/:id/resubmit/:page" element={<RegulatoryWatchLegacyResubmitPageRedirect basePath="/supervisor/regulatory-watch" />} />
        <Route path="/supervisor/regulatory-watch/:category" element={<RegulatoryWatchCategoryOrLegacyIdRoute basePath="/supervisor/regulatory-watch" />} />
        <Route path="/supervisor/regulatory-watch/:category/new" element={<RegulatoryWatchNewRedirect basePath="/supervisor/regulatory-watch" />} />
        <Route path="/supervisor/regulatory-watch/:category/new/:page" element={<VeilleReglementaireForm mode="new" />} />
        <Route
          path="/supervisor/regulatory-watch/:category/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'hse_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']} enforceAllowedRoles>
              <VeilleReglementaireDetails />
            </ProtectedRoute>
          }
        />
        <Route path="/supervisor/regulatory-watch/:category/:id/resubmit" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/supervisor/regulatory-watch/:category/:id/resubmit/:page" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/supervisor/workers" element={<Workers />} />
        <Route
          path="/supervisor/ppe"
          element={
            <ProtectedRoute allowedRoles={['supervisor']} enforceAllowedRoles>
              <PpeManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/supervisor/profile" element={<Profile />} />
      </Route>

      {/* User Routes (Responsable HSE) */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['hse_manager', 'regional_hse_manager', 'responsable']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/kpi/submit" element={<KpiSubmission />} />
        <Route path="/kpi/submit/:projectId" element={<KpiSubmission />} />
        <Route path="/kpi/edit/:reportId" element={<KpiSubmission />} />
        <Route path="/kpi/history" element={<KpiHistory />} />
        <Route path="/training" element={<Training />} />
        <Route path="/awareness" element={<AwarenessSession />} />
        <Route path="/deviations" element={<SorSubmission />} />
        <Route path="/user/sor" element={<Navigate to="/deviations" replace />} />
        <Route path="/work-permits" element={<WorkPermits />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/regulatory-watch" element={<Navigate to="/regulatory-watch/sst" replace />} />
        <Route path="/regulatory-watch/new" element={<Navigate to="/regulatory-watch/sst/new/1" replace />} />
        <Route path="/regulatory-watch/new/:page" element={<RegulatoryWatchLegacyNewPageRedirect basePath="/regulatory-watch" />} />
        <Route path="/regulatory-watch/:id/resubmit" element={<RegulatoryWatchLegacyResubmitRedirect basePath="/regulatory-watch" />} />
        <Route path="/regulatory-watch/:id/resubmit/:page" element={<RegulatoryWatchLegacyResubmitPageRedirect basePath="/regulatory-watch" />} />
        <Route path="/regulatory-watch/:category" element={<RegulatoryWatchCategoryOrLegacyIdRoute basePath="/regulatory-watch" />} />
        <Route path="/regulatory-watch/:category/new" element={<RegulatoryWatchNewRedirect basePath="/regulatory-watch" />} />
        <Route path="/regulatory-watch/:category/new/:page" element={<VeilleReglementaireForm mode="new" />} />
        <Route
          path="/regulatory-watch/:category/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'hse_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']} enforceAllowedRoles>
              <VeilleReglementaireDetails />
            </ProtectedRoute>
          }
        />
        <Route path="/regulatory-watch/:category/:id/resubmit" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/regulatory-watch/:category/:id/resubmit/:page" element={<VeilleReglementaireForm mode="resubmit" />} />
        <Route path="/workers" element={<Workers />} />
        <Route
          path="/ppe"
          element={
            <ProtectedRoute allowedRoles={['hse_manager', 'regional_hse_manager', 'responsable']} enforceAllowedRoles>
              <PpeManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/subcontractors" element={<SubcontractorOpenings />} />
        <Route path="/subcontractors/openings/:id" element={<SubcontractorOpeningDetails />} />
        <Route path="/hse-events" element={<HseEvents />} />
        <Route path="/monthly-measurements" element={<MonthlyMeasurements />} />
        <Route path="/lighting" element={<LightingMeasurements />} />
        <Route path="/waste-management" element={<WasteManagement />} />
      </Route>

      {/* HR Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['hr']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/hr" element={<Workers />} />
        <Route path="/hr/workers" element={<Workers />} />
        <Route path="/hr/effectif" element={<EffectifSubmission />} />
        <Route path="/hr/profile" element={<Profile />} />
      </Route>

      {/* Legacy Qualified Personnel (Worker Trainings) - migrated to Workers */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['hse_manager', 'regional_hse_manager', 'responsable', 'supervisor', 'hr']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/qualified-personnel" element={<QualifiedPersonnelRedirect basePath="/workers" />} />
      </Route>

      {/* Notifications - available for all authenticated roles */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Heavy Machinery Tracking - available for all authenticated roles except HR and HR Director */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'dev', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor', 'user', 'pole_director', 'works_director', 'hse_director']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/heavy-machinery/view-machines" element={<HeavyMachineryViewMachines />} />
        <Route path="/heavy-machinery/global-search" element={<HeavyMachineryGlobalSearch />} />
        <Route path="/heavy-machinery/expired-documentation" element={<HeavyMachineryExpiredDocumentation />} />
      </Route>

      {/* Fallback Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
