import { Metadata } from "next";
import AdminAuthGate from "../../components/admin/AdminAuthGate";

// El panel admin no debe indexarse ni aparecer en resultados de búsqueda.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
