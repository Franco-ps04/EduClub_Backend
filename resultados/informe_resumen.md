# Informe de Resultados - EduTaller

## 1. Resumen de resultados

El desarrollo de EduTaller permitió consolidar una plataforma web orientada a centralizar la gestión e inscripción de talleres extracurriculares para estudiantes de quinto de secundaria. De acuerdo con el proyecto entregado y con la documentación del APF1, la solución integra un frontend desarrollado con Angular, un backend implementado con Node.js y una base de datos PostgreSQL administrada mediante Supabase.

En el **frontend** se cuenta con interfaces diferenciadas para alumnos, docentes y administradores. Entre las funcionalidades identificadas se encuentran el inicio de sesión, recuperación de contraseña, consulta de talleres y eventos, dashboard del alumno, anuncios, mensajería, contacto, gestión administrativa de talleres, inscripciones, usuarios y reportes. También se incorporan componentes relacionados con la visualización y selección de ubicaciones mediante mapas.

En el **backend** se implementó una API organizada mediante rutas, controladores, servicios, DAO y middlewares. La estructura incluye funcionalidades para autenticación, usuarios, talleres, inscripciones, sesiones, asistencia, notificaciones, mensajería, recursos, reportes, diplomas, reconocimientos y contacto. Asimismo, se incorporan mecanismos de autenticación mediante JWT y control de acceso según roles.

La documentación del proyecto plantea además el uso de Leaflet.js y OpenStreetMap para el componente cartográfico, Resend para el envío de correos, Vercel para el frontend, Render para el backend y UptimeRobot para el monitoreo. Estas tecnologías forman parte de la arquitectura descrita en el APF1.

## 2. Análisis e interpretación

Los resultados obtenidos muestran que la propuesta responde a la problemática planteada inicialmente: la dispersión de información, la dificultad para gestionar las inscripciones y la necesidad de realizar un seguimiento de la participación de los estudiantes.

La separación entre frontend y backend permite organizar la solución en componentes independientes y facilita la interacción entre la interfaz de usuario, la lógica de negocio y la persistencia de datos. La incorporación de autenticación y autorización por roles contribuye a diferenciar las funciones disponibles para alumnos, docentes y administradores.

Asimismo, la integración de módulos de talleres, inscripciones, sesiones, asistencia, comunicación y reconocimientos permite cubrir las principales necesidades definidas en los objetivos del proyecto. El uso de un mapa interactivo complementa la gestión de ubicaciones y facilita la consulta visual de los talleres.

De acuerdo con el APF1, el resultado esperado es una plataforma funcional, accesible y organizada que centralice los procesos relacionados con la gestión de talleres y facilite la participación de los estudiantes. La versión entregada presenta una estructura técnica alineada con esa finalidad.

## 3. Conclusiones

1. EduTaller integra en una sola plataforma los principales procesos relacionados con la publicación, gestión e inscripción a talleres extracurriculares.
2. La solución presenta una separación entre frontend y backend que favorece la organización del desarrollo y la comunicación entre la interfaz y la API.
3. La implementación de autenticación, autorización por roles y distintos módulos funcionales permite adaptar el acceso a las necesidades de alumnos, docentes y administradores.
4. La incorporación de mapas, asistencia, comunicación, reportes y reconocimientos amplía la solución más allá de un simple sistema de inscripción y permite realizar un seguimiento de la participación estudiantil.
5. El proyecto mantiene coherencia con los objetivos y la solución planteados en el APF1.
