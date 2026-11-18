import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Camera, LineChart, History, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const nav = [
  { to: "/home", label: "Today", icon: Home },
  { to: "/history", label: "Weeks", icon: History },
  { to: "/scan", label: "Add", icon: Camera, primary: true },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/settings", label: "Me", icon: User },
] as const;

function AuthedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-5 pb-32 pt-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-2xl items-end justify-around px-2 pt-2">
          {nav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            if ("primary" in n) {
              return (
                <Link key={n.to} to={n.to} className="-mt-6 flex flex-col items-center gap-1 text-xs font-medium">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                    <n.icon className="h-6 w-6" />
                  </span>
                  {n.label}
                </Link>
              );
            }
            return (
              <Link key={n.to} to={n.to} className={cn("flex w-16 flex-col items-center gap-1 py-1 text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
