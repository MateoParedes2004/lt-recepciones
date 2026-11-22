import { Metadata } from "next";
import AdminAuthGate from "../../components/admin/AdminAuthGate";
import PanelPwa from "../../components/admin/PanelPwa";
import { PANEL_APP_METADATA } from "../../lib/panel-app";

// El panel no debe indexarse ni aparecer en resultados de búsqueda; en el
// iPhone, agregado al inicio, se llama "LT Panel" con su propio ícono.
export const metadata: Metadata = PANEL_APP_METADATA;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PanelPwa />
      <AdminAuthGate>{children}</AdminAuthGate>
    </>
  );
}
