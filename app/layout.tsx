import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "RuralClass AI · A little attention. A world of possibility.",
  description: "One Teacher. Multiple Grades. Continuous Learning.",
  manifest: "/manifest.json",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
