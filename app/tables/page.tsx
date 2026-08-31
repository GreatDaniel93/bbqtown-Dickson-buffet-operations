import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Table Timers · BBQ Town Dickson",
  description: "20-table service timers for BBQ Town Dickson.",
};

export default function TablesPage() {
  return (
    <main style={{ width: "100vw", height: "100dvh", margin: 0, padding: 0 }}>
      <iframe
        title="BBQ Town Table Timers"
        src="/tables.html"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </main>
  );
}
