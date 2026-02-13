"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrchestrationSessionProvider } from "@/lib/orchestration-session";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            retry: 2,
          },
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OrchestrationSessionProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0F1726",
              color: "#D6E2FF",
              border: "1px solid #22324E",
            },
          }}
        />
      </OrchestrationSessionProvider>
    </QueryClientProvider>
  );
}
