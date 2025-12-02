# HSE KPI Tracker - Improvements Summary

## 1. Dark Mode Contrast Fixes

### Sidebar
- Change `dark:text-gray-400` to `dark:text-gray-200` for better readability
- Active link should have higher contrast background
- Hover states need better visibility

### Text Elements
- Labels: `dark:text-gray-300` → `dark:text-gray-200`
- Secondary text: `dark:text-gray-400` → `dark:text-gray-300`
- Disabled text: Ensure minimum 4.5:1 contrast ratio

### Cards & Backgrounds
- Card backgrounds: `dark:bg-gray-800` is good
- Borders: `dark:border-gray-700` → `dark:border-gray-600` for better definition

## 2. Admin Dashboard - HSE Themes

### Theme Structure
```javascript
const HSE_THEMES = [
  {
    id: 'overview',
    name: 'Executive Overview',
    icon: Activity,
    metrics: ['total_accidents', 'avg_tf', 'avg_tg', 'total_trainings'],
    charts: ['weeklyTrends', 'projectPerformance']
  },
  {
    id: 'safety',
    name: 'Safety Performance',
    icon: Shield,
    metrics: ['accidents', 'fatal_accidents', 'tf_rate', 'tg_rate'],
    charts: ['accidentTrends', 'accidentsByType', 'tfTgComparison']
  },
  {
    id: 'training',
    name: 'Training & Competence',
    icon: GraduationCap,
    metrics: ['total_trainings', 'employees_trained', 'training_hours'],
    charts: ['trainingTrends', 'trainingByProject', 'competenceMatrix']
  },
  {
    id: 'compliance',
    name: 'Compliance & Audits',
    icon: ClipboardCheck,
    metrics: ['inspections', 'hse_compliance_rate', 'medical_compliance_rate'],
    charts: ['complianceTrends', 'auditResults', 'nonConformities']
  },
  {
    id: 'environmental',
    name: 'Environmental Impact',
    icon: Leaf,
    metrics: ['water_consumption', 'electricity_consumption', 'waste_generated'],
    charts: ['resourceConsumption', 'wasteManagement', 'environmentalKPIs']
  }
]
```

### Theme Selector UI
- Horizontal scrollable buttons at top
- Active theme highlighted with theme color
- Smooth transitions between themes
- Icons + text for each theme

### Charts per Theme

#### Safety Theme
1. Accident Trends (Line chart - weekly)
2. TF vs TG Rates (Dual Y-axis bar chart)
3. Accidents by Severity (Pie chart)
4. Safety Performance by Project (Bar chart)

#### Training Theme
1. Training Hours Trend (Area chart)
2. Employees Trained vs Target (Progress bars)
3. Training by Category (Pie chart)
4. Training Completion Rate (Gauge chart)

#### Compliance Theme
1. Inspection Trends (Line chart)
2. Compliance Rates (Radar chart)
3. Audit Findings (Stacked bar chart)
4. Non-Conformities by Type (Pie chart)

#### Environmental Theme
1. Resource Consumption Trends (Multi-line chart)
2. Water vs Electricity (Dual Y-axis)
3. Waste Generation (Stacked area chart)
4. Environmental KPIs (Gauge charts)

#### Overview Theme
1. Key Metrics Cards (4-6 cards)
2. Weekly Trends (Multi-line chart)
3. Project Performance Table
4. Recent Activity Feed

## 3. Performance Optimizations

### React Optimizations
```javascript
// Use useMemo for expensive calculations
const chartData = useMemo(() => {
  return processChartData(data)
}, [data])

// Use React.memo for components
const ChartComponent = React.memo(({ data }) => {
  // ...
})

// Lazy load charts
const LazyChart = lazy(() => import('./charts/ComplexChart'))
```

### API Optimizations
- Cache dashboard data for 30 seconds
- Use AbortController for cancelled requests
- Implement request debouncing for filters

### Bundle Optimizations
- Code splitting by route
- Lazy load Recharts components
- Tree-shake unused icons

## 4. Implementation Priority

1. **High Priority**
   - Fix dark mode contrast issues (30 min)
   - Add theme selector UI (1 hour)
   - Implement Overview theme (1 hour)

2. **Medium Priority**
   - Implement Safety theme (1.5 hours)
   - Implement Training theme (1.5 hours)
   - Add performance optimizations (1 hour)

3. **Low Priority**
   - Implement Compliance theme (1.5 hours)
   - Implement Environmental theme (1.5 hours)
   - Advanced animations and transitions (1 hour)

## 5. Files to Modify

1. `frontend/src/index.css` - Dark mode contrast
2. `frontend/src/pages/admin/AdminDashboard.jsx` - Theme system
3. `frontend/src/layouts/DashboardLayout.jsx` - Sidebar contrast
4. `frontend/src/services/api.js` - Add caching
5. Backend: No changes needed (data already available)

## 6. Testing Checklist

- [ ] Dark mode contrast meets WCAG AA standards
- [ ] Theme switching is smooth and instant
- [ ] Charts render correctly in all themes
- [ ] Mobile responsive on all themes
- [ ] Performance: Dashboard loads < 1s
- [ ] No console errors or warnings
