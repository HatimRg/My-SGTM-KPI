import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useDevStore } from './store/devStore'
import useThemeStore from './stores/themeStore'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'

// Layouts (kept eager as they are lightweight wrappers)
import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'

// Auth Pages (lazy-loaded)
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))

// Admin Pages (lazy-loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const ProjectManagement = lazy(() => import('./pages/admin/ProjectManagement'))
const KpiManagement = lazy(() => import('./pages/admin/KpiManagement'))

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
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const QualifiedPersonnel = lazy(() => import('./pages/shared/QualifiedPersonnel'))
const SubcontractorOpenings = lazy(() => import('./pages/shared/SubcontractorOpenings'))
const SubcontractorOpeningDetails = lazy(() => import('./pages/shared/SubcontractorOpeningDetails'))

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { simulatedRole } = useDevStore()

  const adminLikeRoles = ['admin', 'pole_director', 'works_director', 'hse_director', 'hr_director']

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const actualRole = user?.role
  const role = actualRole === 'dev' && simulatedRole ? simulatedRole : actualRole

  // Admin-like roles have access to all authenticated routes
  if (adminLikeRoles.includes(role)) {
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

// Guest Route Component (redirect if already logged in)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { simulatedRole } = useDevStore()

  const adminLikeRoles = ['admin', 'pole_director', 'works_director', 'hse_director', 'hr_director']

  if (isAuthenticated) {
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

function App() {
  const initTheme = useThemeStore((state) => state.initTheme)
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

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
      </Route>

      {/* Admin Routes */}
      <Route
        element={
          <ProtectedRoute adminOnly>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/projects" element={<ProjectManagement />} />
        <Route path="/admin/projects/:id" element={<ProjectDetails />} />
        <Route path="/admin/kpi" element={<KpiManagement />} />
        <Route path="/admin/kpi-history" element={<KpiHistory />} />
        <Route path="/admin/training" element={<Training />} />
        <Route path="/admin/awareness" element={<AwarenessSession />} />
        <Route path="/admin/sor" element={<SorSubmission />} />
        <Route path="/admin/work-permits" element={<WorkPermits />} />
        <Route path="/admin/inspections" element={<Inspections />} />
        <Route path="/admin/workers" element={<Workers />} />
        <Route path="/admin/qualified-personnel" element={<QualifiedPersonnel />} />
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
        <Route path="/supervisor/workers" element={<Workers />} />
        <Route path="/supervisor/profile" element={<Profile />} />
      </Route>

      {/* User Routes (Responsable HSE) */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['hse_manager', 'responsable']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/kpi/submit" element={<KpiSubmission />} />
        <Route path="/kpi/submit/:projectId" element={<KpiSubmission />} />
        <Route path="/kpi/edit/:reportId" element={<KpiSubmission />} />
        <Route path="/kpi/history" element={<KpiHistory />} />
        <Route path="/training" element={<Training />} />
        <Route path="/awareness" element={<AwarenessSession />} />
        <Route path="/user/sor" element={<SorSubmission />} />
        <Route path="/work-permits" element={<WorkPermits />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/subcontractors" element={<SubcontractorOpenings />} />
        <Route path="/subcontractors/openings/:id" element={<SubcontractorOpeningDetails />} />
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
        <Route path="/hr/profile" element={<Profile />} />
      </Route>

      {/* Qualified Personnel (Worker Trainings) - Responsable, Supervisor, HR, Admin */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['hse_manager', 'responsable', 'supervisor', 'hr']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/qualified-personnel" element={<QualifiedPersonnel />} />
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

      {/* Fallback Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
