# 🧭 Plan Compass

A comprehensive health performance planning and monitoring application designed to track hospital and health facility indicators against strategic plans. Plan Compass provides real-time dashboards, data visualization, and performance analytics to support evidence-based decision-making in healthcare systems.

## 📋 Features

- **Dashboard Analytics** - Real-time performance overview with status indicators (On Track/At Risk/Off Track).
- **Master Plan Management** - Advanced tools to define, configure, and manage health indicators.
- **Inline Editing** - Edit indicator names, baselines, and targets directly within the table for a seamless workflow.
- **Indicator Deletion** - Easily remove obsolete or accidental indicators with a single click.
- **Fullscreen Mode** - Expand data tables to full screen for better visibility of complex datasets.
- **Monthly Data Tracking** - Record and update monthly performance metrics.
- **DHIS2 Integration** - Import data directly from DHIS2 health information systems.
- **Multi-Year Comparison** - Compare performance across different fiscal/calendar years.
- **Data Export** - Export reports and data to PDF and other formats.
- **Secure Authentication** - Supabase-powered authentication with role-based access control.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm** or **bun** package manager.

### Installation
```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd plan-compass

# Install dependencies
npm install
🏗️ Project Structure
src/
├── components/          # React components
│   ├── MasterPlanTab.tsx     # Enhanced: Inline edit, Delete, Fullscreen
│   ├── DashboardTab.tsx      # Main dashboard with charts
│   ├── MonthlyDataTab.tsx    # Monthly data entry
│   └── ui/                   # shadcn/ui components
├── data/                # Static data & Indicator definitions
├── hooks/               # Custom hooks (useDatabase, useAuth)
└── lib/                 # Export and utility functions
🛠️ Tech Stack
Frontend: React 18, TypeScript, Vite

UI & Styling: shadcn/ui, Tailwind CSS, Lucide Icons

Backend/Auth: Supabase

Charts: Recharts

PDF Export: jsPDF, jspdf-autotable

📊 Latest Updates (v1.0.0)
✅ Dynamic Row Actions: Added Pencil (Edit) and Trash (Delete) icons for every indicator.

✅ Responsive Table UI: Fixed headers and code columns for easier horizontal scrolling.

✅ Persistence: Integrated database calls to ensure edits and deletions are saved permanently.

✅ Target Overrides: Improved logic for handling year-specific indicator targets.

🤝 Contributing
Contributions are welcome! Please ensure code follows project lint rules and all changes are well-tested.

📄 License
This project is proprietary. All rights reserved.

© 2026 Plan Compass Development Team.
# Start development server
npm run dev
