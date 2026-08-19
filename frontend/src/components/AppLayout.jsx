import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
