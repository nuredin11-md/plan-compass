import {
  Activity,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Upload,
  TrendingUp,
  GitCompareArrows,
  MessageSquareText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "masterplan", label: "Master Plan", icon: ClipboardList },
  { id: "monthly", label: "Monthly Entry", icon: CalendarDays },
  { id: "import", label: "DHIS2 Import", icon: Upload },
  { id: "analysis", label: "Analysis", icon: TrendingUp },
  { id: "comparison", label: "YoY Compare", icon: GitCompareArrows },
  { id: "feedback", label: "Dept. Feedback", icon: MessageSquareText },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-sidebar-primary" />
          <div>
            <h2 className="text-sm font-bold text-sidebar-foreground">Hospital M&E</h2>
            <p className="text-xs text-muted-foreground">Performance Tracker</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
