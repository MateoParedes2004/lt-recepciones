import LoginForm from "../../components/admin/LoginForm";

// Ingreso al panel desde el sitio. La app instalada usa /ingresar (misma lógica, sin enlace a la tienda).
export default function Login() {
  return <LoginForm variant="site" />;
}
