import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDevStore, DEV_PROJECT_SCOPE } from '../store/devStore'
import useThemeStore from '../stores/themeStore'
import { useLanguage } from '../i18n'
import { notificationService } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  History,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Settings,
  PlusCircle,
  ClipboardCheck,
  ClipboardList,
  AlertTriangle,
  Sun,
  Moon,
  CheckCircle,
  XCircle,
  BookOpen,
  Clock,
  HardHat,
  Megaphone,
  FolderPlus,
  ExternalLink,
  Building2
} from 'lucide-react'
import appLogo from '../App_Logo.png'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  const { user, logout, isAdmin } = useAuthStore()
  const { simulatedRole, setSimulatedRole, clearSimulatedRole, projectScope, setProjectScope } = useDevStore()
  const { isDark, toggleTheme } = useThemeStore()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const isUserAdmin = isAdmin()

  const isDev = user?.role === 'dev'
  const effectiveRole = isDev && simulatedRole ? simulatedRole : user?.role
  const adminLikeRoles = ['admin', 'pole_director', 'works_director', 'hse_director', 'hr_director']
  const isUserAdminLike = isUserAdmin || (user?.role === 'dev' && !simulatedRole) || adminLikeRoles.includes(effectiveRole)

  // Fetch notifications (only when user is authenticated)
  useEffect(() => {
    if (!user) return // Don't fetch if user is not logged in
    
    const fetchNotifications = async () => {
      try {
        const countRes = await notificationService.getUnreadCount()
        setUnreadCount(countRes.data?.data?.count ?? 0)
        
        const notifRes = await notificationService.getAll({ per_page: 5 })
        setNotifications(notifRes.data?.data ?? [])
      } catch (error) {
        // Silently handle auth errors (403/401) - user might be logging out
        if (error.response?.status !== 403 && error.response?.status !== 401) {
          console.error('Error fetching notifications:', error)
        }
      }
    }
    fetchNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Get icon and color for notification type
  const getNotificationStyle = (type) => {
    const styles = {
      kpi_submitted: { icon: ClipboardCheck, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
      kpi_approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
      kpi_rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
      project_assigned: { icon: FolderPlus, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
      sor_submitted: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
      sor_corrected: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
      training_submitted: { icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
      awareness_submitted: { icon: Users, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
      worker_training_expiring: { icon: HardHat, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
      worker_training_expired: { icon: HardHat, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
      reminder: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
      system: { icon: Megaphone, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' },
      info: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
      warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
      success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
      error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    }
    return styles[type] || styles.info
  }

  const handleNotificationClick = async (notif) => {
    // Mark as read
    if (!notif.read_at) {
      try {
        await notificationService.markAsRead(notif.id)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => 
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        ))
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }

    setNotificationDropdownOpen(false)

    // Navigate to action_url if available, otherwise use type-based navigation
    if (notif.action_url) {
      navigate(notif.action_url)
      return
    }

    // Fallback navigation based on type
    switch (notif.type) {
      case 'kpi_approved':
      case 'kpi_rejected':
      case 'kpi_submitted':
        navigate(isUserAdminLike ? '/admin/kpi' : '/kpi/history')
        break
      case 'project_assigned':
        navigate(isUserAdminLike ? '/admin/projects' : '/my-projects')
        break
      case 'sor_submitted':
      case 'sor_corrected':
        navigate(isHseOfficer ? '/sor' : '/user/sor')
        break
      case 'training_submitted':
        navigate('/training')
        break
      case 'awareness_submitted':
        navigate('/awareness')
        break
      default:
        break
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const isHseOfficer = effectiveRole === 'user'
  const isSupervisor = effectiveRole === 'supervisor'
  const isResponsable = effectiveRole === 'responsable'
  const isHseManager = effectiveRole === 'hse_manager'
  const isHR = effectiveRole === 'hr'

  const adminNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/admin/users', icon: Users, label: t('users.title') },
    { to: '/admin/projects', icon: FolderKanban, label: t('projects.title') },
    { to: '/admin/kpi', icon: ClipboardCheck, label: t('kpi.title') },
    { to: '/admin/kpi-history', icon: History, label: t('kpi.history') },
    { to: '/admin/training', icon: FileText, label: t('training.navLabel') },
    { to: '/admin/awareness', icon: Megaphone, label: t('awareness.navLabel') },
    { to: '/admin/sor', icon: AlertTriangle, label: t('sor.title') },
    { to: '/admin/work-permits', icon: ClipboardList, label: t('workPermits.title') },
    { to: '/admin/inspections', icon: ClipboardCheck, label: t('inspections.title') },
    { to: '/admin/workers', icon: HardHat, label: t('workers.title') },
    { to: '/admin/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
    { to: '/admin/subcontractors', icon: Building2, label: t('subcontractors.title') },
  ]

  const directorNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/admin/kpi', icon: ClipboardCheck, label: t('kpi.title') },
    { to: '/admin/kpi-history', icon: History, label: t('kpi.history') },
    { to: '/admin/training', icon: FileText, label: t('training.navLabel') },
    { to: '/admin/awareness', icon: Megaphone, label: t('awareness.navLabel') },
    { to: '/admin/sor', icon: AlertTriangle, label: t('sor.title') },
    { to: '/admin/work-permits', icon: ClipboardList, label: t('workPermits.title') },
    { to: '/admin/inspections', icon: ClipboardCheck, label: t('inspections.title') },
    { to: '/admin/workers', icon: HardHat, label: t('workers.title') },
    { to: '/admin/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
    { to: '/admin/subcontractors', icon: Building2, label: t('subcontractors.title') },
  ]

  const hrDirectorNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/admin/workers', icon: HardHat, label: t('workers.title') },
    { to: '/admin/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
  ]

  const userNavItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/my-projects', icon: FolderKanban, label: t('nav.myProjects') },
    { to: '/kpi/submit', icon: PlusCircle, label: t('kpi.submission') },
    { to: '/kpi/history', icon: History, label: t('kpi.history') },
    { to: '/training', icon: FileText, label: t('training.navLabel') },
    { to: '/awareness', icon: Users, label: t('awareness.navLabel') },
    { to: '/user/sor', icon: AlertTriangle, label: t('sor.title') },
    { to: '/work-permits', icon: ClipboardCheck, label: t('workPermits.title') },
    { to: '/inspections', icon: ClipboardList, label: t('inspections.title') },
    { to: '/workers', icon: HardHat, label: t('workers.title') },
    { to: '/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
    { to: '/subcontractors', icon: Building2, label: t('subcontractors.title') },
  ]

  const hseOfficerNavItems = [
    { to: '/sor', icon: AlertTriangle, label: t('sor.title') },
    { to: '/sor/projects', icon: FolderKanban, label: t('nav.myProjects') },
    { to: '/sor/awareness', icon: Users, label: t('awareness.navLabel') },
  ]

  const supervisorNavItems = [
    { to: '/supervisor', icon: AlertTriangle, label: t('sor.title') },
    { to: '/supervisor/projects', icon: FolderKanban, label: t('nav.myProjects') },
    { to: '/supervisor/awareness', icon: Users, label: t('awareness.navLabel') },
    { to: '/supervisor/training', icon: FileText, label: t('training.navLabel') },
    { to: '/supervisor/work-permits', icon: ClipboardCheck, label: t('workPermits.title') },
    { to: '/supervisor/inspections', icon: ClipboardList, label: t('inspections.title') },
    { to: '/supervisor/workers', icon: HardHat, label: t('workers.title') },
    { to: '/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
  ]

  const hrNavItems = [
    { to: '/hr/workers', icon: HardHat, label: t('workers.title') },
    { to: '/qualified-personnel', icon: HardHat, label: t('qualifiedPersonnel.navLabel') },
  ]

  const getNavItems = () => {
    if (effectiveRole === 'admin') return adminNavItems
    if (effectiveRole === 'pole_director') return directorNavItems
    if (effectiveRole === 'works_director') return directorNavItems
    if (effectiveRole === 'hse_director') return directorNavItems
    if (effectiveRole === 'hr_director') return hrDirectorNavItems
    if (effectiveRole === 'user') return hseOfficerNavItems
    if (effectiveRole === 'supervisor') return supervisorNavItems
    if (effectiveRole === 'hr') return hrNavItems
    if (effectiveRole === 'dev') return userNavItems
    if (effectiveRole === 'hse_manager' || effectiveRole === 'responsable') return userNavItems
    return userNavItems
  }

  const navItems = getNavItems()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(isUserAdminLike ? '/admin' : '/dashboard')}
            >
              <img 
                src={appLogo} 
                alt={t('common.appName')} 
                className="h-10 w-10 object-contain rounded-lg"
              />
              <div>
                <h1 className="font-bold text-sgtm-orange">SGTM</h1>
                <p className="text-xs text-gray-500">{t('common.appName')}</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
            <div className="mb-4">
              <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {isUserAdminLike ? t('nav.administration') : t('nav.dashboard')}
              </span>
            </div>
            
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin' || item.to === '/dashboard' || item.to === '/sor'}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link-active' : 'sidebar-link'
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Role label */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-400">
              {t(`roles.${effectiveRole}`) ?? effectiveRole}
            </span>
          </div>

          {/* User info at bottom */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-10 h-10 bg-hse-primary rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center h-16 px-4 sm:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden mr-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu className="w-6 h-6 dark:text-gray-300" />
            </button>

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-2">

              {/* Dev Tools */}
              {isDev && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setDevToolsOpen(!devToolsOpen)
                      setNotificationDropdownOpen(false)
                      setProfileDropdownOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Dev Tools"
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Dev</span>
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>

                  {devToolsOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 animate-fade-in z-50">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dev Tools</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Simulate role & project scope</p>
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Simulated role</label>
                          <select
                            value={simulatedRole ?? ''}
                            onChange={(e) => setSimulatedRole(e.target.value || null)}
                            className="mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">(none)</option>
                            <option value="admin">admin</option>
                            <option value="hse_manager">hse_manager</option>
                            <option value="responsable">responsable</option>
                            <option value="supervisor">supervisor</option>
                            <option value="user">user</option>
                            <option value="hr">hr</option>
                            <option value="pole_director">pole_director</option>
                            <option value="works_director">works_director</option>
                            <option value="hse_director">hse_director</option>
                            <option value="hr_director">hr_director</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Project scope</label>
                          <select
                            value={projectScope}
                            onChange={(e) => setProjectScope(e.target.value)}
                            className="mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value={DEV_PROJECT_SCOPE.ALL}>{t('common.allProjects')}</option>
                            <option value={DEV_PROJECT_SCOPE.ASSIGNED}>Assigned only</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => {
                              clearSimulatedRole()
                              setProjectScope(DEV_PROJECT_SCOPE.ALL)
                              setDevToolsOpen(false)
                            }}
                            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Language Switcher */}
              <LanguageSwitcher variant="compact" />

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isDark ? t('common.lightMode') : t('common.darkMode')}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationDropdownOpen(!notificationDropdownOpen)
                    setProfileDropdownOpen(false)
                    setDevToolsOpen(false)
                  }}
                  className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {notificationDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-96 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 animate-fade-in z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('notifications.title')}</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-hse-primary hover:underline"
                        >
                          {t('notifications.markAllRead')}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => {
                          const style = getNotificationStyle(notif.type)
                          const IconComponent = style.icon
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex gap-3 ${
                                !notif.read_at ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0`}>
                                <IconComponent className={`w-4 h-4 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm ${!notif.read_at ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-gray-100 line-clamp-1`}>
                                    {notif.title}
                                  </p>
                                  {!notif.read_at && (
                                    <span className="w-2 h-2 bg-hse-primary rounded-full flex-shrink-0 mt-1.5" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                {notif.project && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                                    <FolderKanban className="w-3 h-3" />
                                    {notif.project.name}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {notif.action_url && (
                                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="px-4 py-12 text-center">
                          <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {t('notifications.noNotifications')}
                          </p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-center">
                        <button 
                          onClick={() => {
                            setNotificationDropdownOpen(false)
                            navigate('/notifications')
                          }}
                          className="text-sm text-hse-primary hover:underline"
                        >
                          {t('notifications.viewAll')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(!profileDropdownOpen)
                    setNotificationDropdownOpen(false)
                    setDevToolsOpen(false)
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-hse-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>

                {/* Profile dropdown menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 animate-fade-in">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <NavLink
                        to={isUserAdminLike ? '/admin/profile' : '/profile'}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        {t('nav.profile')}
                      </NavLink>
                      <NavLink
                        to={isUserAdminLike ? '/admin/profile' : '/profile'}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        {t('nav.settings')}
                      </NavLink>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('auth.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content with animation */}
        <main className="p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Click outside to close dropdowns */}
      {(profileDropdownOpen || notificationDropdownOpen || devToolsOpen) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setProfileDropdownOpen(false)
            setNotificationDropdownOpen(false)
            setDevToolsOpen(false)
          }}
        />
      )}
    </div>
  )
}
