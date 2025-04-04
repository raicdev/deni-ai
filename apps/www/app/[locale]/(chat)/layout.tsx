import { Loading } from "@/components/loading";
import { Suspense } from "react";
import { ThemeProvider } from "@repo/ui/components/theme-provider";

import { ChatSessionsProvider } from "@/hooks/use-chat-sessions";
import { SidebarProvider } from "@repo/ui/components/sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { AuthProvider } from "@/context/AuthContext";
import { cookies } from "next/headers";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <div className="w-full h-full">
      <SidebarProvider defaultOpen={defaultOpen}>
        <AuthProvider>
          <ChatSessionsProvider>
            <div className="w-full flex">
              <ChatSidebar />
              <Suspense fallback={<Loading />}>{children}</Suspense>
            </div>
          </ChatSessionsProvider>
        </AuthProvider>
      </SidebarProvider>{" "}
    </div>
  );
}
