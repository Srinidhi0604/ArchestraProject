"use client";

import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
