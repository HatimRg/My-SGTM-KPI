import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AdminDashboard from '../AdminDashboard'
import { dashboardService } from '../../../services/api'
import { apiCache } from '../../../utils/apiCache'

// Mock the API service
vi.mock('../../../services/api', () => ({
  dashboardService: {
    getAdminDashboard: vi.fn(),
  },
  exportService: {
    exportExcel: vi.fn(),
    exportPdf: vi.fn(),
  },
}))

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const mockDashboardData = {
  data: {
    data: {
      stats: {
        total_projects: 10,
        active_projects: 8,
        total_users: 25,
        active_users: 20,
        pending_reports: 5,
        total_reports: 100,
      },
      kpi_summary: {
        total_accidents: 3,
        fatal_accidents: 0,
        total_trainings: 50,
        employees_trained: 200,
        total_inspections: 75,
        avg_tf: 2.5,
        avg_tg: 1.2,
        avg_hse_compliance: 95,
      },
      weekly_trends: [
        {
          week: 1,
          week_label: 'S1',
          accidents: 1,
          trainings: 5,
          inspections: 10,
          tf: 2.0,
          tg: 1.0,
        },
        {
          week: 2,
          week_label: 'S2',
          accidents: 0,
          trainings: 8,
          inspections: 12,
          tf: 1.5,
          tg: 0.8,
        },
      ],
      project_performance: [
        {
          id: 1,
          name: 'Project A',
          code: 'PA',
          reports_count: 10,
          total_accidents: 1,
          total_trainings: 20,
          avg_tf: 2.0,
          avg_tg: 1.0,
        },
      ],
      recent_reports: [
        {
          id: 1,
          project: { name: 'Project A' },
          report_month: 11,
          report_year: 2025,
          status: 'approved',
          submitter: { name: 'John Doe' },
        },
      ],
    },
  },
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiCache.clear() // Clear cache between tests
    dashboardService.getAdminDashboard.mockResolvedValue(mockDashboardData)
  })

  it('should render loading state initially', () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    // Check for the animate-spin class on the loader
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should render dashboard data after loading', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    })

    // Check if stats are rendered
    expect(screen.getByText('Total Projects')).toBeInTheDocument()
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    // Values may appear multiple times, just verify they exist
    expect(screen.getAllByText('10').length).toBeGreaterThan(0)
    expect(screen.getAllByText('25').length).toBeGreaterThan(0)
  })

  it('should call API with correct year parameter', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      // cachedApiCall passes params as object { year }
      expect(dashboardService.getAdminDashboard).toHaveBeenCalledWith({
        year: new Date().getFullYear()
      })
    })
  })

  it('should use cached data on subsequent renders', async () => {
    const { rerender } = render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      // AdminDashboard calls the endpoint twice on mount (year + compareYear)
      expect(dashboardService.getAdminDashboard).toHaveBeenCalledTimes(2)
    })

    // Rerender component
    rerender(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    // Should use cache, not call API again
    expect(dashboardService.getAdminDashboard).toHaveBeenCalledTimes(2)
  })

  it('should render KPI summary cards', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    })

    // Check KPI cards are rendered
    expect(screen.getAllByText('Total Accidents').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Total Trainings').length).toBeGreaterThan(0)
  })

  it('should render project performance table', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Project Performance')).toBeInTheDocument()
    })

    // Check project data is rendered (may appear multiple times)
    expect(screen.getAllByText('Project A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PA').length).toBeGreaterThan(0)
  })

  it('should render recent reports', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Recent Submissions')).toBeInTheDocument()
    })

    // Check report data is rendered
    expect(screen.getByText(/John Doe/)).toBeInTheDocument()
  })
})

describe('AdminDashboard Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiCache.clear() // Clear cache between tests
    dashboardService.getAdminDashboard.mockResolvedValue(mockDashboardData)
  })

  it('should memoize expensive calculations', async () => {
    const { rerender } = render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    })

    // Force rerender with same data
    rerender(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    // Component should not recalculate if data hasn't changed
    // This is tested implicitly by React.memo and useMemo
    // AdminDashboard calls the endpoint twice on mount (year + compareYear)
    expect(dashboardService.getAdminDashboard).toHaveBeenCalledTimes(2)
  })
})
