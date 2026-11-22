import { SetMetadata } from '@nestjs/common';

/**
 * Roles del panel:
 *  - ADMIN: el dueño. Entra a todo, siempre.
 *  - VENDEDOR: presupuestos, alquileres, pedidos por WhatsApp, anular y
 *    facturar. No ve ingresos ni estadísticas, no toca el catálogo, las zonas,
 *    la galería, las rutas ni los usuarios.
 *
 * Cerrado por defecto: una ruta protegida sin @AllowRoles es SOLO del dueño.
 * Así, algo nuevo que se agregue sin pensar en permisos queda protegido.
 */
export const ROLES = ['ADMIN', 'VENDEDOR'] as const;
export type Role = (typeof ROLES)[number];

export const ALLOW_ROLES_KEY = 'allowRoles';

/**
 * Además del dueño, deja pasar a estos roles. En un controlador aplica a todas
 * sus rutas; en una ruta, reemplaza lo del controlador (`@AllowRoles()` vacío =
 * solo el dueño, aunque el controlador permita más).
 */
export const AllowRoles = (...roles: Role[]) =>
  SetMetadata(ALLOW_ROLES_KEY, roles);

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);
