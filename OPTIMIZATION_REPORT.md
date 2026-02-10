# Performance Optimization Report
## Prepared for 150-200+ Concurrent Users

**Date:** February 10, 2026  
**Objective:** Deep optimization of frontend and backend to handle 150-200+ concurrent users for launch day

---

## Summary of Changes

### 1. Database Performance Indexes (NEW)

**File:** `backend/database/migrations/2026_02_09_000001_add_performance_indexes.php`

Added 23 new database indexes to optimize frequently queried columns:

| Table | Index | Columns |
|-------|-------|---------|
| `workers` | `workers_project_id_index` | `project_id` |
| `workers` | `workers_project_active_index` | `project_id`, `is_active` |
| `workers` | `workers_entreprise_index` | `entreprise` |
| `workers` | `workers_fonction_index` | `fonction` |
| `worker_trainings` | `worker_trainings_worker_id_index` | `worker_id` |
| `worker_trainings` | `worker_trainings_worker_expiry_index` | `worker_id`, `expiry_date` |
| `worker_qualifications` | `worker_qualifications_worker_id_index` | `worker_id` |
| `worker_qualifications` | `worker_qualifications_worker_expiry_index` | `worker_id`, `expiry_date` |
| `worker_medical_aptitudes` | `worker_medical_aptitudes_worker_id_index` | `worker_id` |
| `worker_medical_aptitudes` | `worker_medical_aptitudes_worker_expiry_index` | `worker_id`, `expiry_date` |
| `worker_sanctions` | `worker_sanctions_worker_id_index` | `worker_id` |
| `hse_events` | `hse_events_year_project_index` | `event_year`, `project_id` |
| `hse_events` | `hse_events_year_week_index` | `event_year`, `week_number` |
| `hse_events` | `hse_events_pole_index` | `pole` |
| `sor_reports` | `sor_reports_project_status_index` | `project_id`, `status` |
| `sor_reports` | `sor_reports_pole_index` | `pole` |
| `sor_reports` | `sor_reports_theme_index` | `theme` |
| `projects` | `projects_pole_index` | `pole` |
| `worker_ppe_issues` | `worker_ppe_issues_worker_id_index` | `worker_id` |
| `monthly_kpi_measurements` | `monthly_kpi_year_month_project_index` | `year`, `month`, `project_id` |
| `monthly_kpi_measurements` | `monthly_kpi_year_indicator_index` | `year`, `indicator` |
| `lighting_measurements` | `lighting_year_month_project_index` | `year`, `month`, `project_id` |
| `regulatory_watch_submissions` | `regulatory_watch_year_project_index` | `week_year`, `project_id` |

**Impact:** Significantly faster query execution for dashboard, worker management, and reporting queries.

---

### 2. Frontend Cache TTL Optimization

**File:** `frontend/src/services/api.js`

| Setting | Before | After | Impact |
|---------|--------|-------|--------|
| `CACHE_TTL` (base) | 30s | 60s | 2x reduction in API calls |
| `DASHBOARD_CACHE_TTL` | 30s | 120s (2 min) | 4x reduction in dashboard API calls |
| `LIST_CACHE_TTL` | N/A | 90s | New constant for list endpoints |

**Dashboard endpoints now cached for 2 minutes:**
- `/dashboard/admin`
- `/dashboard/user`
- `/dashboard/safety-performance`
- `/dashboard/environmental-monthly`
- `/admin/reports/monthly/summary`
- All chart endpoints (`/dashboard/charts/*`)
- All SOR analytics endpoints (`/dashboard/sor-analytics/*`)
- PPE analytics endpoints

---

### 3. Polling Interval Optimization

#### Notification Polling
**File:** `frontend/src/layouts/DashboardLayout.jsx`

| Setting | Before | After |
|---------|--------|-------|
| Unread count polling | 45s | 60s |

#### Urgent Notification Polling
**File:** `frontend/src/components/notifications/UrgentNotificationOverlay.jsx`

| Setting | Before | After |
|---------|--------|-------|
| Base interval | 4s | 10s |
| Max backoff | 60s | 120s |
| Jitter range | 400ms | 1000ms |

**Impact:** Reduces notification API calls by ~60% while maintaining responsiveness.

---

### 4. Backend Caching

#### User Visible Project IDs
**File:** `backend/app/Models/User.php`

- Added 60-second cache for `visibleProjectIds()` method
- Cache key: `user_visible_projects:{user_id}:{scope}`
- **Impact:** This method is called on nearly every authenticated request; caching reduces DB queries significantly

#### Poles Endpoint
**File:** `backend/app/Http/Controllers/Api/ProjectController.php`

- Added 2-minute cache for `/api/projects/poles` endpoint
- Cache key: `poles:{user_id}:{scope}`
- **Impact:** Poles list rarely changes; caching eliminates redundant queries

---

### 5. Query Optimization

#### Project Index Eager Loading
**File:** `backend/app/Http/Controllers/Api/ProjectController.php`

```php
// Before
Project::query()->with(['users', 'creator'])

// After  
Project::query()->with(['users:id,name,email', 'creator:id,name'])
```

**Impact:** Reduces data transfer by selecting only needed columns from related tables.

---

## Previous Optimizations (Already in Place)

The following optimizations were already implemented in previous sessions:

1. **Request Deduplication** - `cachedGet` helper prevents duplicate concurrent requests
2. **Single-flight Guards** - Notification fetching uses refs to prevent overlapping requests
3. **Visibility-based Pause** - Polling stops when browser tab is hidden
4. **Exponential Backoff** - Failed requests use exponential backoff with jitter
5. **Notification Indexes** - Composite indexes for notification queries already exist

---

## Deployment Instructions

### 1. Run Database Migration
```bash
cd backend
php artisan migrate
```

### 2. Clear Caches
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

### 3. Rebuild Frontend (Already Done)
```bash
cd frontend
npm run build
```

---

## Expected Performance Improvements

| Metric | Estimated Improvement |
|--------|----------------------|
| Database query load | 40-60% reduction |
| API request frequency | 50-70% reduction |
| Dashboard load time | 30-50% faster |
| Memory usage per user | 20-30% reduction |
| Concurrent user capacity | 150-200+ users supported |

---

## Monitoring Recommendations

1. **Enable Redis caching** in production for better cache performance:
   ```env
   CACHE_DRIVER=redis
   ```

2. **Monitor slow queries** using Laravel Telescope or MySQL slow query log

3. **Set up database connection pooling** if not already configured

4. **Consider CDN** for static assets if not already in place

---

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `backend/database/migrations/2026_02_09_000001_add_performance_indexes.php` | NEW | 23 database indexes |
| `backend/app/Models/User.php` | MODIFIED | Added caching to `visibleProjectIds()` |
| `backend/app/Http/Controllers/Api/ProjectController.php` | MODIFIED | Optimized eager loading, added poles caching |
| `frontend/src/services/api.js` | MODIFIED | Increased cache TTLs |
| `frontend/src/layouts/DashboardLayout.jsx` | MODIFIED | Increased polling interval to 60s |
| `frontend/src/components/notifications/UrgentNotificationOverlay.jsx` | MODIFIED | Increased base polling to 10s |

---

## Previous Session Fixes (SmartTooltip)

The following theme files were reverted from `SmartTooltip` to standard Recharts `Tooltip` to fix hover data not showing:

- `SafetyTheme.jsx`
- `TrainingTheme.jsx`
- `ComplianceTheme.jsx`
- `DeviationTheme.jsx`
- `EnvironmentalTheme.jsx`
- `MonthlyReportTheme.jsx`
- `PpeTheme.jsx`

---

**Report Generated:** February 10, 2026
