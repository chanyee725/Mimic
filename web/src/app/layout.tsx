import { NavLink, Outlet, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { APP_NAME, NAV, type NavItem } from "@/app/nav"
import { STATION } from "@/dummy/station"

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to)
}

function NavBadge({ badge }: { badge: NavItem["badge"] }) {
  if (badge === undefined) return null
  if (badge === "rec") {
    return (
      <SidebarMenuBadge className="rounded-sm bg-bad-muted px-1.5 text-[11px] font-medium text-bad">
        REC
      </SidebarMenuBadge>
    )
  }
  return <SidebarMenuBadge className="font-mono text-muted-foreground">{badge}</SidebarMenuBadge>
}

function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<NavLink to="/" />}>
                <div className="grid text-left leading-tight">
                  <span className="truncate font-semibold tracking-tight">{APP_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {STATION.id} · {STATION.robot}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="shrink-0 text-muted-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<NavLink to={item.to} />}
                      isActive={isActive(pathname, item.to)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    <NavBadge badge={item.badge} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
