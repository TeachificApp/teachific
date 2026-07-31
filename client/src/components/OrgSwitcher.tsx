import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronDown,
  Plus,
  Link2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  isCollapsed?: boolean;
}

export function OrgSwitcher({ isCollapsed }: OrgSwitcherProps) {
  const [, setLocation] = useLocation();
  const { orgId, adminOrgs, isOrgAdmin, setSelectedOrgId } = useOrgScope();
  const [open, setOpen] = useState(false);

  // Get the active org details
  const activeOrg = adminOrgs?.find((o: any) => o.id === orgId) ?? adminOrgs?.[0];

  if (!isOrgAdmin || !adminOrgs || adminOrgs.length === 0) return null;

  const handleSwitch = async (id: number) => {
    if (id === orgId) { setOpen(false); return; }
    await setSelectedOrgId(id);
    setOpen(false);
    // Reload the LMS dashboard for the new org context
    window.location.href = "/lms";
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 hover:bg-sidebar-accent transition-colors focus:outline-none text-left",
            isCollapsed && "justify-center px-1"
          )}
          title={isCollapsed ? (activeOrg?.name ?? "Switch Organization") : undefined}
        >
          <Avatar className="h-6 w-6 shrink-0 rounded-md border border-sidebar-border/40">
            {activeOrg?.logoUrl ? (
              <img src={activeOrg.logoUrl} alt={activeOrg.name} className="h-full w-full object-cover rounded-md" />
            ) : (
              <AvatarFallback className="rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                {activeOrg ? initials(activeOrg.name) : <Building2 className="h-3 w-3" />}
              </AvatarFallback>
            )}
          </Avatar>
          {!isCollapsed && (
            <>
              <span className="flex-1 min-w-0 text-xs font-medium truncate text-sidebar-foreground">
                {activeOrg?.name ?? "Select Organization"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50 shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isCollapsed ? "end" : "start"}
        side="right"
        className="w-60"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your Organizations
        </DropdownMenuLabel>
        {adminOrgs.map((org: any) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <Avatar className="h-6 w-6 shrink-0 rounded-md border border-border/40">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover rounded-md" />
              ) : (
                <AvatarFallback className="rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                  {initials(org.name)}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{org.name}</p>
              {org.slug && (
                <p className="text-[10px] text-muted-foreground truncate">{org.slug}</p>
              )}
            </div>
            {org.id === orgId && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { setOpen(false); setLocation("/create-organization"); }}
          className="cursor-pointer text-primary focus:text-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Organization
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => { setOpen(false); setLocation("/link-organization"); }}
          className="cursor-pointer"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Link Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
