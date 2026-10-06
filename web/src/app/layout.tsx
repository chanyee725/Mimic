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
import { useCaptureState } from "@/api/capture"
import { useServerEvents } from "@/api/events"
import { useTasks } from "@/api/tasks"
import { isCapturing } from "@/domain/capture"

import { EventToasts } from "./event-toasts"

// Light sidebar: regular weight and thin icons, only the active item is emphasised
const NAV_ITEM_CLASS =
  "text-[13px] font-normal text-sidebar-foreground/75 data-active:font-medium data-active:text-sidebar-foreground [&_svg]:size-[15px] [&_svg]:stroke-[1.75]"

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to)
}

/** REC while the station is capturing an episode (countdown, recording or review) */
function RecBadge() {
  const { data } = useCaptureState()
  if (!data || !isCapturing(data)) return null
  return <SidebarMenuBadge className="rounded-sm bg-bad-muted px-1.5 text-[10px] font-medium tracking-wide text-bad">REC</SidebarMenuBadge>
}

function TaskCountBadge() {
  const { data } = useTasks()
  if (!data) return null
  return <SidebarMenuBadge className="font-mono font-normal text-muted-foreground">{data.length}</SidebarMenuBadge>
}

function NavBadge({ badge }: { badge: NavItem["badge"] }) {
  if (badge === "rec") return <RecBadge />
  if (badge === "tasks") return <TaskCountBadge />
  return null
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
                <span className="truncate font-medium tracking-tight">{APP_NAME}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="shrink-0 text-muted-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-normal text-muted-foreground">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<NavLink to={item.to} />}
                      isActive={isActive(pathname, item.to)}
                      tooltip={item.label}
                      className={NAV_ITEM_CLASS}
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
  useServerEvents()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Outlet />
      </SidebarInset>
      <EventToasts />
    </SidebarProvider>
  )
}
