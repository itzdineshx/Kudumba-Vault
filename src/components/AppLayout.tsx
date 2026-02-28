import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useVault } from "@/context/VaultContext";
import { LayoutDashboard, Upload, FileText, Share2, Users, RefreshCw, ShieldAlert, LogOut, Shield, Menu, X } from "lucide-react";
import WalletStatus from "@/components/WalletStatus";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/sharing", label: "Sharing", icon: Share2 },
  { to: "/members", label: "Members", icon: Users },
  { to: "/recovery", label: "Recovery", icon: RefreshCw },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, familyName, userRole, userName } = useVault();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = userRole === "member"
    ? NAV_ITEMS.filter(i => ["/dashboard", "/documents"].includes(i.to))
    : NAV_ITEMS;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
            <Shield className="h-5 w-5 text-[hsl(var(--sidebar-primary-foreground))]" />
          </div>
          <div>
            <p className="text-sm font-bold">Family Vault</p>
            <p className="text-[11px] text-[hsl(var(--sidebar-foreground))]/60">{familyName || "Family Vault"}</p>
          </div>
        </div>
        {/* Mobile close button */}
        <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 lg:hidden hover:bg-[hsl(var(--sidebar-accent))]">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {visibleNav.map(item => {
          const active = location.pathname === item.to;
          return (
            <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`}>
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3 space-y-2">
        <WalletStatus />
        <div className="rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2">
          <p className="text-xs font-medium">Logged in as</p>
          <p className="text-[11px] text-[hsl(var(--sidebar-foreground))]/60">{userName || "User"} ({userRole === "owner" ? "Owner" : "Member"})</p>
        </div>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop: always visible, mobile: slide-in */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 ease-in-out lg:z-30 lg:w-60 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-60">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Family Vault</span>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
