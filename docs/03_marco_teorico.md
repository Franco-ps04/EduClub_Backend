# 03. Marco teórico

## 1. Introducción

El desarrollo de una plataforma web para la gestión de talleres extracurriculares para estudiantes de quinto de secundaria requiere integrar tecnologías de frontend, backend, persistencia de datos, autenticación, geolocalización, servicios en la nube y control de versiones.

## 2. Desarrollo web y frontend

El frontend corresponde a la parte visual con la que interactúan los usuarios. En el proyecto se emplean HTML, CSS y JavaScript para estructurar, presentar y dotar de interactividad a la interfaz web.

También se utiliza Angular como framework para el desarrollo de aplicaciones web modernas. Angular permite organizar la aplicación mediante componentes reutilizables y favorece una estructura mantenible para las diferentes vistas y funcionalidades de EduTaller.

## 3. Backend y gestión de datos

El backend contiene la lógica del sistema y se implementa utilizando JavaScript con Node.js. Node.js permite atender solicitudes del sistema mediante un modelo de ejecución asíncrono.

Para la persistencia de información se utiliza PostgreSQL mediante Supabase. La base de datos permite almacenar de forma estructurada la información de usuarios, talleres, participaciones, ubicaciones, roles y otros datos requeridos por la plataforma.

## 4. Autenticación y autorización

La seguridad y la autenticación son componentes fundamentales de la plataforma. El proyecto contempla la infraestructura JWT para gestionar sesiones mediante tokens y mantener la autenticación sin necesidad de almacenar sesiones en el servidor.

Asimismo, se emplea Auth0 para la autenticación y autorización de usuarios, permitiendo validar identidades y controlar el acceso a los diferentes módulos según los permisos establecidos.

## 5. Geolocalización y mapas interactivos

La plataforma incorpora herramientas de geolocalización para facilitar la visualización de los lugares donde se desarrollan los talleres. Leaflet.js y OpenStreetMap se utilizan para representar mapas interactivos, visualizar ubicaciones y apoyar la selección del lugar de cada actividad.

## 6. Control de versiones y colaboración

Git es utilizado como sistema de control de versiones para registrar, administrar y realizar seguimiento de los cambios del proyecto. Entre los comandos mencionados en el APF1 se encuentran `git init`, `git add`, `git commit`, `git pull` y `git push`.

GitHub funciona como repositorio remoto y como plataforma de colaboración. Permite centralizar el código del frontend y backend, mantener un historial de cambios y trabajar con ramas, incidencias, versiones y procesos de integración.

## 7. Servicios de despliegue y operación

### Vercel

Vercel se utiliza para publicar el frontend desarrollado con Angular. La integración con GitHub permite automatizar el proceso de despliegue y mantener la aplicación disponible en línea.

### Render

Render se utiliza para alojar el backend. El servicio ejecuta la lógica interna, procesa solicitudes de la API y permite la comunicación con la base de datos.

### Supabase

Supabase proporciona la base de datos PostgreSQL utilizada por el sistema y servicios complementarios, incluyendo almacenamiento para información e imágenes.

### Resend

Resend es utilizado para automatizar el envío de correos electrónicos relacionados con el funcionamiento del sistema, fortaleciendo la comunicación con los usuarios.

### UptimeRobot

UptimeRobot se utiliza para monitorear la disponibilidad del backend alojado en Render y realizar solicitudes periódicas que permitan comprobar la respuesta de la API.

## 8. Integración tecnológica

Las tecnologías se integran de manera complementaria: Angular construye la interfaz, Node.js implementa la lógica del servidor, PostgreSQL mediante Supabase gestiona los datos, JWT y Auth0 apoyan la autenticación y autorización, Leaflet.js y OpenStreetMap proporcionan el mapa interactivo, Git y GitHub gestionan las versiones, Vercel y Render permiten el despliegue, Resend automatiza el correo y UptimeRobot contribuye al monitoreo del servicio.

## Referencia bibliográfica

Organización para la Cooperación y el Desarrollo Económicos. (2023). *OECD digital education outlook 2023: Towards an effective digital education ecosystem*. OECD Publishing. https://doi.org/10.1787/c74f03de-en
