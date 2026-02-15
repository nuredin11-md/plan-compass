# Plan Compass

A comprehensive health performance planning and monitoring application designed to track hospital and health facility indicators against strategic plans. Plan Compass provides real-time dashboards, data visualization, and performance analytics to support evidence-based decision-making in healthcare systems.

## 📋 Features

- **Dashboard Analytics** - Real-time performance overview with status indicators (On Track/At Risk/Off Track)
- **Master Plan Management** - Define, configure, and manage health indicators and targets
- **Monthly Data Tracking** - Record and update monthly performance metrics
- **DHIS2 Integration** - Import data directly from DHIS2 health information systems
- **Multi-Year Comparison** - Compare performance across different fiscal/calendar years
- **Performance Analysis** - Advanced analytics and trend visualization
- **Data Export** - Export reports and data to PDF and other formats
- **Role-based Access Control** - Support for multiple user roles with appropriate permissions
- **Secure Authentication** - Supabase-powered authentication and authorization

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm** or **bun** package manager
- [nvm](https://github.com/nvm-sh/nvm) is recommended for Node.js management

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd plan-compass

# Install dependencies
npm install
# or with bun
bun install

# Start development server
npm run dev
# The app will be available at http://localhost:5173
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run lint         # Run ESLint checks
npm run preview      # Preview production build locally
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
```

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── DashboardTab.tsx          # Main dashboard with charts
│   ├── MasterPlanTab.tsx         # Indicator management
│   ├── MonthlyDataTab.tsx        # Monthly data entry
│   ├── DHIS2ImportTab.tsx        # DHIS2 integration
│   ├── AnalysisTab.tsx           # Advanced analytics
│   ├── YearComparisonTab.tsx     # Year-over-year comparison
│   ├── FeedbackTab.tsx           # User feedback
│   ├── ExportButton.tsx          # Data export functionality
│   ├── AppSidebar.tsx            # Main navigation sidebar
│   └── ui/                       # shadcn/ui components
├── data/
│   └── hospitalIndicators.ts     # Indicator definitions and data
├── pages/
│   ├── Auth.tsx                  # Authentication page
│   ├── Index.tsx                 # Main app interface
│   └── NotFound.tsx              # 404 page
├── hooks/
│   ├── useAuth.tsx               # Authentication hook
│   └── use-toast.ts              # Toast notifications
├── integrations/
│   └── supabase/
│       ├── client.ts             # Supabase client configuration
│       └── types.ts              # Type definitions
├── lib/
│   ├── exportUtils.ts            # Export functionality
│   └── utils.ts                  # Utility functions
└── main.tsx                      # Entry point
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **UI Component Library** | shadcn/ui + Radix UI |
| **Styling** | Tailwind CSS + PostCSS |
| **Data Visualization** | Recharts |
| **State Management** | React Query (TanStack Query) |
| **Routing** | React Router v6 |
| **Authentication** | Supabase |
| **Form Handling** | React Hook Form |
| **CSV Processing** | PapaParse |
| **PDF Generation** | jsPDF + jspdf-autotable |
| **Notifications** | Sonner |
| **Testing** | Vitest |
| **Linting** | ESLint |

## 📊 Key Modules

### Dashboard Tab
Displays overall health system performance with:
- Performance status breakdown (green/yellow/red indicators)
- Program area summaries
- Trend visualizations
- Monthly performance tracking

### Master Plan Management
Configure and maintain:
- Health indicators and KPIs
- Performance targets and baselines
- Program area categorization
- Year-specific target overrides

### Monthly Data Entry
Record operational data:
- Monthly indicator values
- Data validation and consistency checks
- Historical data tracking

### DHIS2 Integration
Enable seamless data integration:
- Direct import from DHIS2 instances
- Automatic data mapping
- Bulk data uploads

### Analysis Tools
Advanced performance insights:
- Trend analysis
- Variance calculations
- Performance forecasting

### Year Comparison
Compare performance metrics:
- Side-by-side year analysis
- Growth tracking
- Target achievement analysis

## 🔐 Authentication & Authorization

Plan Compass uses Supabase for secure authentication with:
- Email/password login
- Role-based access control
- Session management
- Protected routes

## 📦 Export Functionality

Export capabilities include:
- **PDF Reports** - Generate formatted performance reports
- **CSV Export** - Export raw data for analysis
- **Customizable Templates** - Tailor exports to reporting requirements

## 🌐 Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 Testing

The project uses Vitest for unit and integration testing:

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

Test files are located in `src/test/` directory.

## 📝 Development Workflow

1. **Create a feature branch** from `main`
2. **Make changes** and test locally with `npm run dev`
3. **Run linting** with `npm run lint` before committing
4. **Create a pull request** with clear description of changes
5. **Get review** and merge to main

## 🚨 Troubleshooting

### Port Already in Use
If port 5173 is already in use, Vite will automatically use the next available port.

### Build Issues
```bash
# Clear dependencies and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Hot Module Reload Not Working
Ensure your editor has Vite/ESM module support enabled.

## 📚 Resources

- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com)

## 🤝 Contributing

Contributions are welcome! Please ensure:

- Code follows project lint rules
- Changes are well-tested
- Documentation is updated
- Commit messages are descriptive

## 📄 License

This project is proprietary. All rights reserved.

## 📧 Support

For issues, questions, or feature requests, please create an issue in the repository or contact the development team.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
