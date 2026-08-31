import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Table Timers · BBQ Town Dickson",
  description: "20-table service timers for BBQ Town Dickson.",
};

export default function TablesPage() {
  redirect("/tables.html");
}
