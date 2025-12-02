# HSE KPI Tracker - SGTM

A comprehensive Health, Safety & Environment (HSE) KPI tracking system built with **React + Tailwind CSS** frontend and **Laravel** backend.

## 🚀 Features

### Authentication
- Secure login with email/password
- Password reset functionality
- Role-based access control (Admin / Responsable)
- Session management with Laravel Sanctum

### Admin Dashboard
- Overview of all projects and KPIs
- Summary charts (accidents, trainings, inspections, TF, TG)
- User management (create, edit, delete, activate/deactivate)
- Project management
- Filter data by project, user, or date range
- Export reports to Excel/PDF

### User Dashboard
- View assigned projects only
- Submit monthly KPI reports
- View historical submissions
- Track report approval status
- Visual KPI summaries and charts

### KPI Metrics Tracked
- **Accidents**: Total, fatal, serious, minor, near misses, first aid cases
- **Training**: Conducted, planned, employees trained, hours, toolbox talks
- **Inspections**: Completed, planned, findings open/closed, corrective actions
- **Safety Rates**: TF (Frequency Rate), TG (Severity Rate)
- **Additional**: Unsafe acts, unsafe conditions, emergency drills, PPE compliance

## 📁 Project Structure

```
├── backend/                 # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   ├── Models/
│   │   └── Exports/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/api.php
│
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── index.html
```

## 🛠️ Installation

### Prerequisites
- PHP 8.1+
- Composer
- Node.js 18+
- npm or yarn
- MySQL 8.0+

### Backend Setup

```bash
cd backend

# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database in .env file
# DB_DATABASE=hse_kpi_tracker
# DB_USERNAME=your_username
# DB_PASSWORD=your_password

# Run migrations
php artisan migrate

# Seed sample data
php artisan db:seed

# Start the server
php artisan serve
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000/api" > .env

# Start development server
npm run dev
```

## 🔑 Demo Credentials

After running the seeders:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hse-kpi.com | password123 |
| User | mohammed.alami@hse-kpi.com | password123 |
| User | fatima.bennani@hse-kpi.com | password123 |

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/profile` - Update profile

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (Admin)
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project (Admin)
- `DELETE /api/projects/{id}` - Delete project (Admin)

### KPI Reports
- `GET /api/kpi-reports` - List reports
- `POST /api/kpi-reports` - Create report
- `GET /api/kpi-reports/{id}` - Get report
- `PUT /api/kpi-reports/{id}` - Update report
- `DELETE /api/kpi-reports/{id}` - Delete report
- `POST /api/kpi-reports/{id}/approve` - Approve (Admin)
- `POST /api/kpi-reports/{id}/reject` - Reject (Admin)

### Dashboard
- `GET /api/dashboard/admin` - Admin dashboard data
- `GET /api/dashboard/user` - User dashboard data
- `GET /api/dashboard/charts/*` - Chart data

### Export
- `GET /api/export/excel` - Export to Excel
- `GET /api/export/pdf` - Export to PDF

## 🎨 Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router v6
- Zustand (State Management)
- Recharts (Charts)
- Lucide Icons
- React Hot Toast

### Backend
- Laravel 10
- Laravel Sanctum (Authentication)
- Maatwebsite Excel
- DomPDF
- MySQL

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🔒 Security Features

- CSRF Protection
- API Rate Limiting
- Password Hashing
- Role-based Access Control
- Input Validation
- SQL Injection Prevention

## 📈 Future Enhancements

- [ ] Real-time notifications
- [ ] Multi-language support (FR/AR/EN)
- [ ] Advanced analytics dashboard
- [ ] Automated report generation
- [ ] Mobile app (React Native)
- [ ] Integration with external systems

## 📄 License

MIT License - Feel free to use for personal or commercial projects.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ for SGTM HSE Management
