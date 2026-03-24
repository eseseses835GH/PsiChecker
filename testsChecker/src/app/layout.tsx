import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/client/context/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoGrade Classroom",
  description: "Teacher-only AI-assisted code grading workflow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-theme="indigo" suppressHydrationWarning>
      <body className="app-body antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
