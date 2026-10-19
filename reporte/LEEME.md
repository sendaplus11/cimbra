# Reporte automático por correo

Worker aparte del sitio (las Pages Functions no tienen tareas programadas). Envía:

- **Diario** a las 8:05 a. m. (Miami): visitas, cargas de presupuesto, análisis completados, contactos, canales y empresas de prospección del día anterior.
- **Semanal** los lunes: lo mismo para los últimos 7 días.

## Instalación (una sola vez, ~10 minutos)

1. **Email Routing de obralyt.com** (Cloudflare → obralyt.com → Email → Email Routing): activarlo y verificar como destino `cimbra.soporte@gmail.com` (llega un correo de confirmación).
2. **Datos de la base**: Cloudflare → Storage & Databases → D1 → la base que usa el sitio. Copiar su nombre y su *Database ID* en `wrangler.toml`.
3. **Publicar** desde esta carpeta:
   ```
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put CLAVE_PRUEBA      # una clave cualquiera para la prueba manual
   ```
4. **Probar**: abrir `https://obralyt-reporte.<tu-cuenta>.workers.dev/?clave=LA_CLAVE&dias=7`. Debe llegar el correo en un minuto.

Para agregar a Jacob: verificar su correo en Email Routing y sumarlo en `allowed_destination_addresses` y en `DESTINATARIOS`.
