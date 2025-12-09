# HSE KPI Tracker - Development Summary

## Project Overview
A comprehensive Health, Safety & Environment (HSE) KPI tracking system built for SGTM (Société Générale des Travaux du Maroc).

**Tech Stack:**
- **Backend:** Laravel 10 (PHP 8.x)
- **Frontend:** React 18 + Vite + TailwindCSS
- **Database:** MySQL
- **Excel Export:** Maatwebsite Excel + PhpSpreadsheet

---

## Features Implemented

### 1. Authentication & Authorization
- Multi-role authentication (Admin, Responsable, Supervisor, User/Animateur, HR)
- Role-based access control
- Password reset functionality
- Remember me functionality
- **Login animation** with success overlay and smooth transitions

### 2. Dashboard System
- **Admin Dashboard:** Overview of all projects, KPI statistics, charts
- **User Dashboard:** Personal project overview, quick actions
- Theme selector with multiple dashboard themes (Safety, Training, Compliance, Environmental)
- Dark mode support throughout the app

### 3. Project Management
- Create, edit, delete projects
- Assign users to projects with specific roles
- Project zones management
- Project details with statistics

### 4. KPI Reporting System
- **Daily KPI Snapshots:** Per-day data entry for 17+ indicators
- **Weekly KPI Reports:** Aggregated weekly reports with approval workflow
- **Auto-populate feature:** Automatically fills KPI form from related data sources:
  - SOR Reports (deviations)
  - Trainings
  - Awareness Sessions
  - Work Permits
  - Inspections
  - Workers count
- TF (Frequency Rate) and TG (Severity Rate) auto-calculation
- Draft saving with localStorage backup
- Report submission, approval, and rejection workflow

### 5. SOR (Safety Observation Report) System
- Deviation tracking with categories
- Photo upload for problem and corrective action
- Corrective action workflow
- Pin/unpin for follow-up
- Status tracking (Open, In Progress, Closed)
- **Closer name display** - shows who closed each report
- **Clickable images** - photos open in new tab for full view

### 6. Training Management
- Training sessions with photo documentation
- Worker training records
- Training hours tracking
- Participants tracking

### 7. Awareness Sessions (Sensibilisation)
- Session management
- Participant tracking
- Duration tracking

### 8. Work Permits
- Multiple permit types (Cold, Hot Work, Confined Spaces, etc.)
- Permit workflow
- Archive functionality

### 9. Inspections
- Inspection scheduling and tracking
- Findings management
- Export functionality

### 10. Workers Management
- Worker database with French column names
- Qualification tracking
- Training records per worker

### 11. Excel Export System
- **HSE Weekly Export** with multiple sheets:
  - Info Projet (uses project's HSE responsable, not admin)
  - Reporting HSE (flipped layout: indicators as rows, days as columns)
  - Incidents & Accidents (flipped layout)
  - Relevé des Écarts SGTM
  - Relevé des Écarts Sous-traitants
  - Habilitations
  - Suivi des Collaborateurs
  - Permis de Travail
  - Sensibilisation & Formation
- Custom styling with SGTM branding
- Logo integration

### 12. Notifications
- Real-time notification system
- Mark as read functionality
- Notification types for various events

### 13. Internationalization (i18n)
- Full French and English support
- Language switcher in UI
- All labels, messages, and content translated

---

## Data Relationships & Logic

### Connected Data Flow
```
Projects
├── Users (with roles)
├── Workers
│   └── Trainings
├── Daily KPI Snapshots
├── Weekly KPI Reports
├── SOR Reports
│   ├── Submitter (User)
│   └── Closer (User)
├── Trainings
├── Awareness Sessions
├── Work Permits
└── Inspections
```

### Auto-Population Logic
When creating a KPI report, the system can auto-fill from:
- `unsafe_conditions_reported` ← SOR reports count
- `employees_trained` ← Training participants
- `training_hours` ← Training hours sum
- `toolbox_talks` ← Awareness sessions count
- `work_permits` ← Work permits count
- `inspections_completed` ← Inspections count
- `hours_worked` ← Active workers count

---

## Files Structure

```
My-SGTM-KPI/
├── backend/                    # Laravel Backend
│   ├── app/
│   │   ├── Exports/           # Excel export classes
│   │   ├── Http/Controllers/  # API controllers
│   │   ├── Models/            # Eloquent models
│   │   └── Services/          # Business logic
│   ├── database/
│   │   ├── migrations/        # Database schema
│   │   └── seeders/           # Test data
│   ├── public/                # Web root (frontend assets copied here)
│   ├── resources/views/       # Blade templates
│   ├── routes/api.php         # API routes
│   └── storage/app/public/    # Uploaded files
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── i18n/              # Translations (en.js, fr.js)
│   │   ├── layouts/           # Page layouts
│   │   ├── pages/             # Page components
│   │   ├── services/          # API service layer
│   │   ├── store/             # Zustand stores
│   │   └── utils/             # Helper functions
│   └── dist/                  # Built assets
│
├── server-launcher.bat        # Windows batch launcher
├── server-launcher.ps1        # PowerShell launcher with monitoring
├── HTTPS_SETUP.md             # HTTPS configuration guide
└── WHAT_HAVE_I_DONE.md        # This file
```

---

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### KPI Reports
- `GET /api/kpi-reports` - List reports
- `POST /api/kpi-reports` - Create report
- `GET /api/kpi-reports/auto-populate` - Get auto-populated data
- `POST /api/kpi-reports/{id}/approve` - Approve report
- `POST /api/kpi-reports/{id}/reject` - Reject report

### SOR Reports
- `GET /api/sor-reports` - List SOR reports
- `POST /api/sor-reports` - Create SOR report
- `POST /api/sor-reports/{id}/close` - Close with corrective action

### Export
- `GET /api/export/hse-weekly` - Export HSE weekly Excel

---

## Performance Optimizations

1. **Lazy Loading:** React components are code-split for faster initial load
2. **API Caching:** Laravel response caching for frequently accessed data
3. **Image Optimization:** Uploaded images stored in public storage with symlink
4. **Database Indexes:** Proper indexing on frequently queried columns
5. **Pagination:** All list endpoints support pagination

---

## Security Features

1. **CSRF Protection:** Laravel CSRF tokens
2. **API Authentication:** Sanctum token-based auth
3. **Role-Based Access:** Middleware for admin-only routes
4. **Input Validation:** Server-side validation on all inputs
5. **SQL Injection Prevention:** Eloquent ORM with parameterized queries
6. **XSS Prevention:** React's built-in escaping + Content Security Policy ready

---

## Deployment Notes

### Server Requirements
- PHP 8.1+
- MySQL 5.7+
- Node.js 18+
- Composer
- Apache/Nginx

### Deployment Steps
1. Clone repository
2. Run `composer install` in backend
3. Run `npm install && npm run build` in frontend
4. Copy `frontend/dist/*` to `backend/public/`
5. Configure `.env` file
6. Run `php artisan migrate`
7. Run `php artisan storage:link`
8. Start server with `server-launcher.bat`

---

## Known Issues & Future Improvements

### Current Limitations
- Excel export may be slow for large datasets
- Real-time notifications require polling (no WebSocket)

### Suggested Improvements
- Add WebSocket for real-time updates
- Implement report scheduling
- Add PDF export option
- Mobile app version
- Offline mode support

---

## Credits

Built with ❤️ for SGTM

**Technologies Used:**
- Laravel, React, TailwindCSS, Vite
- Maatwebsite Excel, PhpSpreadsheet
- Lucide Icons, Recharts
- Zustand, React Hot Toast

---

*Last Updated: December 2025*
