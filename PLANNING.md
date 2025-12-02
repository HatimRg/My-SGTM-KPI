# HSE KPI Tracker - Project Planning

## Project Overview
HSE KPI Tracking System for SGTM - A comprehensive web application for monitoring Health, Safety & Environment key performance indicators across multiple projects.

## Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast

### Backend
- **Framework**: Laravel 10
- **Authentication**: Laravel Sanctum
- **Database**: MySQL
- **Export**: Maatwebsite Excel, DomPDF

## User Roles

### Admin
- Full access to all features
- Manage users and projects
- View all KPI reports
- Approve/reject submissions
- Export reports

### Responsable
- View assigned projects only
- Submit KPI reports
- View own submission history
- Basic dashboard access

## Core Features

### 1. Authentication
- [x] Login page with email/password
- [x] Forgot password flow
- [x] JWT token management
- [x] Role-based redirects

### 2. Admin Dashboard
- [x] KPI summary cards
- [x] Monthly trend charts
- [x] Project performance table
- [x] Recent submissions list
- [x] Export functionality

### 3. User Management (Admin)
- [x] User list with search/filter
- [x] Create/Edit/Delete users
- [x] Assign users to projects
- [x] Toggle user status

### 4. Project Management (Admin)
- [x] Project list/grid view
- [x] Create/Edit/Delete projects
- [x] Assign responsables
- [x] Project status management

### 5. User Dashboard
- [x] Personal KPI summary
- [x] Assigned projects list
- [x] Monthly submission status
- [x] Quick submit actions

### 6. KPI Submission
- [x] Project selection
- [x] Month/year selection
- [x] Expandable metric sections
- [x] Save as draft / Submit

### 7. KPI History
- [x] Filterable report list
- [x] Report detail modal
- [x] Status tracking
- [x] Edit/Delete drafts

### 8. Project Details
- [x] Project info display
- [x] KPI summary cards
- [x] Trend charts
- [x] Team members list

## KPI Metrics

### Accidents
- Total accidents
- Fatal/Serious/Minor breakdown
- Near misses
- First aid cases

### Training
- Trainings conducted/planned
- Employees trained
- Training hours
- Toolbox talks

### Inspections
- Inspections completed/planned
- Open/closed findings
- Corrective actions

### Safety Rates
- TF (Frequency Rate) = (Accidents × 1,000,000) / Hours Worked
- TG (Severity Rate) = (Lost Workdays × 1,000) / Hours Worked

### Additional
- Unsafe acts/conditions reported
- Emergency drills
- PPE compliance rate

## Database Schema

### Users
- id, name, email, password, role, phone, avatar, is_active

### Projects
- id, name, code, description, location, start_date, end_date, status, budget, client_name

### Project_User (Pivot)
- project_id, user_id, assigned_at

### KPI_Reports
- id, project_id, submitted_by, report_date, report_month, report_year
- Accident fields
- Training fields
- Inspection fields
- Rate fields
- status, approved_by, approved_at

### Notifications
- id, user_id, title, message, type, data, read_at

## API Structure

```
/api/auth/*          - Authentication
/api/users/*         - User management
/api/projects/*      - Project management
/api/kpi-reports/*   - KPI reports
/api/dashboard/*     - Dashboard data
/api/notifications/* - Notifications
/api/export/*        - Export functions
```

## UI/UX Guidelines

- Clean, professional HSE-oriented design
- Blue primary color (#1e40af)
- Responsive layout (mobile-first)
- Sidebar navigation
- Topbar with notifications
- Card-based components
- Consistent spacing and typography

## Setup Instructions

See README.md for detailed installation steps.

## Future Roadmap

1. Real-time WebSocket notifications
2. Multi-language support (FR/AR/EN)
3. Advanced analytics and reporting
4. Mobile application
5. API integrations
6. Automated alerts for safety thresholds
