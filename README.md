# LT Recepciones 🥂 
> [cite_start]Sistema web profesional de recepción y gestión de usuarios. [cite: 1, 2]

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[cite_start]Este es un proyecto **Full Stack** desarrollado de forma independiente, abarcando desde el diseño de la arquitectura hasta el despliegue final.  [cite_start]El sistema permite gestionar de manera eficiente el flujo de clientes desde un panel administrativo y facilitar la comunicación directa vía WhatsApp para atención inmediata. [cite: 3]

##  Demo de Producción
[cite_start] [Próximamente: Link del deploy] [cite: 6]

---

## [cite_start] Funcionalidades Destacadas [cite: 7]
* **Gestión de Catálogo Inteligente:** Implementación de lógica de ordenamiento alfabético desde la base de datos para garantizar una navegación fluida.
* **Experiencia de Usuario (UX) de Alto Nivel:** Desarrollo de selectores de cantidad dinámicos con validación de inventario en tiempo real y alertas visuales.
* [cite_start]**Sistema de Recepción:** Formulario de registro automatizado con redirección inteligente a WhatsApp. [cite: 8, 9, 10]
* [cite_start]**Panel Administrativo Proporcional:** Dashboard para la visualización de registros y analíticas de visitas diarias. [cite: 11]
* [cite_start]**Arquitectura Responsive:** Interfaz adaptada minuciosamente para escritorio y dispositivos móviles, respetando la identidad visual corporativa. [cite: 12, 13]

## [cite_start] Stack Tecnológico [cite: 16]

### [cite_start]Frontend [cite: 17]
* [cite_start]**React / Next.js:** [cite: 18] Interfaz dinámica con renderizado optimizado.
* **Tailwind CSS:** Diseño moderno basado en componentes.
* [cite_start]**TypeScript:** [cite: 19] Tipado estático estricto en el 98% del código para máxima estabilidad.

### [cite_start]Backend [cite: 20]
* [cite_start]**NestJS:** [cite: 21] Framework estructurado para una lógica de negocio escalable.
* **Prisma ORM:** Manejo avanzado de entidades y consultas eficientes a la base de datos.
* [cite_start]**PostgreSQL:** [cite: 22] Base de datos relacional para la persistencia segura de la información.

### [cite_start]DevOps & Calidad [cite: 24]
* [cite_start]**Docker & Docker Compose:** [cite: 25] Contenedorización completa del entorno de desarrollo.
* [cite_start]**Git/GitHub:** [cite: 26] Control de versiones bajo estándares de la industria.

---

## [cite_start] Estructura del Sistema [cite: 27, 28]
```text
lt-recepciones/
[cite_start]├── frontend/       # Aplicación React + TypeScript [cite: 29, 31]
[cite_start]├── backend/        # API REST con NestJS [cite: 30, 32]
[cite_start]├── docker-compose.yml # Orquestación de infraestructura [cite: 33]
└── .gitignore      # Protección de secretos y variables de entorno