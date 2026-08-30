import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BBQ Town Buffet Operations",
  description: "Tablet-friendly buffet refill and food safety operations for BBQ Town Dickson.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
