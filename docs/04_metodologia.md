# 04. Metodología

## 1. Enfoque y modelo de desarrollo

Para el desarrollo de EduTaller se seleccionó una metodología de desarrollo de software ágil, complementada con un enfoque iterativo e incremental. Este enfoque permite gestionar cambios en los requisitos, realizar entregas funcionales en periodos cortos y promover la mejora continua de la plataforma.

Se adoptó un marco de trabajo ágil inspirado en Scrum, organizado mediante Sprints o iteraciones cortas. El sistema se divide en módulos independientes, como autenticación, gestión de talleres, mapa interactivo y notificaciones, con el propósito de facilitar el control del desarrollo y su posterior integración.

## 2. Tipo de investigación

El APF1 no especifica de manera nominal un tipo de investigación (por ejemplo, descriptiva, aplicada, experimental o cualitativa). Por ello, este apartado se mantiene limitado a lo que sí declara el documento: se trata de un proyecto de desarrollo de software orientado a diseñar y desarrollar una plataforma web para atender una problemática concreta.

## 3. Técnicas y actividades utilizadas

A partir de las fases descritas en el APF1, las principales actividades metodológicas comprenden:

- Identificación y levantamiento de la problemática relacionada con la difusión y gestión de talleres extracurriculares.
- Definición de objetivos y requerimientos.
- Diseño de interfaces y prototipo UI/UX.
- Modelado de la base de datos relacional.
- Definición de endpoints del backend y mecanismos de seguridad.
- Implementación del frontend y backend.
- Integración de servicios externos.
- Pruebas unitarias y de integración.
- Despliegue en la nube y monitoreo del servicio.

## 4. Materiales y herramientas tecnológicas

Las herramientas y tecnologías declaradas en el APF1 son:

- Angular para el frontend.
- HTML, CSS y JavaScript para la interfaz web.
- Node.js para el backend.
- PostgreSQL mediante Supabase para la base de datos.
- JWT y Auth0 para autenticación y autorización.
- Leaflet.js y OpenStreetMap para el mapa interactivo.
- Git y GitHub para control de versiones y colaboración.
- Figma para el prototipo completo de la aplicación.
- Vercel para el despliegue del frontend.
- Render para el despliegue del backend.
- Resend para el envío automatizado de correos.
- UptimeRobot para monitoreo de disponibilidad.

## 5. Instrumentos

El APF1 no presenta una relación formal de instrumentos de investigación. Para el desarrollo tecnológico se emplearon las herramientas antes descritas, además de pruebas unitarias y de integración para verificar funcionalidades como registro, control de cupos y asistencia por sesión.

## 6. Fases del proceso de desarrollo

### Fase 1: Planificación y análisis de requisitos

- Identificación y levantamiento de la problemática.
- Definición de objetivos generales y específicos.
- Elaboración del diagrama de arquitectura y selección del stack tecnológico.

### Fase 2: Diseño del sistema y modelado de datos

- Diseño de la interfaz de usuario (UI/UX).
- Modelado de la base de datos relacional en Supabase.
- Definición de endpoints del backend y mecanismos de seguridad basados en JWT y autenticación segura.

### Fase 3: Implementación (codificación)

- Desarrollo del frontend con Angular, HTML, CSS y JavaScript.
- Integración de Leaflet.js y OpenStreetMap.
- Desarrollo del backend con Node.js.
- Configuración de rutas de la API y conexión con la base de datos.
- Integración de servicios externos como Resend.

### Fase 4: Pruebas y despliegue

- Pruebas unitarias y de integración.
- Despliegue del frontend en Vercel.
- Despliegue del backend en Render.
- Integración con la base de datos en Supabase.
- Monitoreo mediante UptimeRobot.
