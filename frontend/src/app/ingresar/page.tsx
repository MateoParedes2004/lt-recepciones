import type { Metadata } from "next";
import LoginForm from "../../components/admin/LoginForm";
import PanelPwa from "../../components/admin/PanelPwa";
import { PANEL_APP_METADATA } from "../../lib/panel-app";

export const metadata: Metadata = { ...PANEL_APP_METADATA, title: "Ingresar · LT Panel" };

// Ingreso a la app del panel (panel.…/ingresar). Igual que /iniciar-sesion pero
// sin el encabezado ni los enlaces de la tienda.
export default function IngresarApp() {
  return (
    <>
      <PanelPwa />
      <LoginForm variant="app" />
    </>
  );
}
