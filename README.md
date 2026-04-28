# UTS Enterprise - Plataforma Académica

![UTS Logo](https://www.uts.edu.co/sitio/wp-content/uploads/2019/10/Logo-UTS-1.png)

Una plataforma web "Designer Grade" diseñada para los estudiantes de las Unidades Tecnológicas de Santander. Permite la gestión, seguimiento y auditoría de los 52 proyectos/requisitos académicos necesarios para la graduación.

## ✨ Características Principales

- **Diseño "Bento Grid" Premium**: Una interfaz de usuario limpia, profesional y moderna que utiliza el popular layout de cuadrícula estilo "Bento".
- **Mobile-First Experience**: Navegación adaptada a dispositivos móviles con una barra inferior "Tab Bar" moderna (Glassmorphism), eliminando el obsoleto menú de hamburguesa.
- **Sincronización en Tiempo Real**: Desarrollado sobre Google Firebase (Firestore), los proyectos y datos de usuario se sincronizan al instante en todos los dispositivos conectados.
- **Gestor de Proyectos**: Añade, categoriza y monitorea proyectos con cálculo dinámico de porcentajes de progreso.
- **Catálogo Académico**: Visualización de cursos oficiales y certificaciones de vanguardia.
- **Centro de Auditoría**: Área para la previsualización y futura generación de reportes consolidados en PDF.

## 🚀 Prueba del Sistema (Modo Demo)

Se ha habilitado un modo de prueba ("Bypass Auth") para que invitados puedan experimentar la plataforma sin necesidad de registrarse en la base de datos de Firebase.

**Credenciales de Acceso:**
- **Usuario:** `admin` (o cualquier correo terminado en `@uts.edu.co`)
- **Contraseña:** `admin123`

*Instrucciones de prueba:*
1. Abre el archivo `index.html` en tu navegador para ver la página de presentación.
2. Haz clic en "Prueba el Sistema".
3. Ingresa las credenciales arriba indicadas y accederás inmediatamente al dashboard.

## 🛠️ Tecnologías Utilizadas

- **Frontend Core**: HTML5 Semántico, Vanilla JavaScript (ES6+), CSS3 Avanzado (Variables, Grid, Flexbox, Media Queries).
- **Tipografía y UI**: Plus Jakarta Sans (Google Fonts), FontAwesome 6.
- **Backend as a Service (BaaS)**: 
  - *Firebase Authentication*: Para gestión real de usuarios.
  - *Firebase Firestore*: Base de datos NoSQL para almacenamiento en tiempo real.
- **Integración Modular**: Uso de Import Maps para cargar librerías ES Modules directamente en el navegador sin empaquetadores complejos.

## 📁 Estructura del Proyecto

```text
/
├── index.html              # Página de presentación / Landing Page (Punto de entrada)
├── login.html              # Pantalla de autenticación
├── dashboard.html          # Vista General (Bento Grid Layout)
├── proyectos.html          # Gestor CRUD de proyectos
├── cursos.html             # Catálogo de formación continua
├── reportes.html           # Centro de generación de PDFs
├── configuracion.html      # Perfil de usuario y seguridad
├── .env                    # Entorno (Ref para configuración Firebase)
├── css/
│   └── style.css           # Sistema de diseño global (Design Tokens, Responsive)
└── js/
    ├── app.js              # Lógica de sincronización, Auth y UI dinámica
    └── firebase-config.js  # Credenciales de conexión a Firebase
```

## ⚙️ Notas de Desarrollo

- Si deseas probar el sistema de autenticación real, asegúrate de añadir tu dominio local (`127.0.0.1` o `localhost`) en la sección **Authorized Domains** dentro de *Firebase Console -> Authentication -> Settings*.
- El proyecto actualmente funciona como una MPA (Multi-Page Application) sin frameworks, demostrando la capacidad del JavaScript moderno para construir aplicaciones reactivas y escalables en arquitecturas tradicionales.

---
*Desarrollado con altos estándares de calidad para la excelencia académica.*
