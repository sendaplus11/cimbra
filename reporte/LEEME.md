# Reporte automático por correo

Worker aparte del sitio (las Pages Functions no tienen tareas programadas). Envía:

- **Diario** a las 12:05 UTC (7:05 a. m. de Miami en horario de invierno; 8:05 en verano): visitas, cargas de presupuesto, análisis completados, contactos, canales y empresas de prospección del día anterior.
- **Semanal** los lunes: lo mismo para los últimos 7 días.

**Estado:** publicado y funcionando desde el 19-oct-2026 (base D1 `obralyt`, ya anotada en `wrangler.toml`). No hace falta volver a instalarlo.

## Correo de obralyt.com (desde el 5-nov-2026)

| Qué | Dónde |
|---|---|
| Correo de personas (carlos@obralyt.com y su alias contacto@obralyt.com) | **Zoho Mail**, plan gratuito |
| Reporte automático (remitente `reportes@avisos.obralyt.com`, destino `obralyt.soporte@gmail.com`) | **Cloudflare Email Routing** del subdominio `avisos.obralyt.com` |

DNS en Cloudflare (zona obralyt.com):

- **Raíz `obralyt.com`, de Zoho:** MX `mx.zoho.com` (10), `mx2.zoho.com` (20) y `mx3.zoho.com` (50); SPF `v=spf1 include:zohomail.com include:_spf.mx.cloudflare.net ~all`; DKIM `zmail._domainkey`; TXT de verificación de Zoho.
- **Subdominio `avisos`, de Cloudflare Email Routing:** sus MX y TXT los creó Cloudflare y están bloqueados. **No borrarlos ni editarlos.**
- **Email Routing de la zona debe seguir activo:** si se desactiva, el reporte deja de salir.

## Instalación (ya hecha; solo para reinstalar desde cero)

1. **Email Routing** (Cloudflare → obralyt.com → Email → Email Routing): activarlo, agregar el subdominio `avisos` en Settings → Subdomains y verificar como destino `obralyt.soporte@gmail.com` (llega un correo de confirmación).
2. **Datos de la base**: Cloudflare → Storage & Databases → D1 → la base que usa el sitio. Copiar su nombre y su *Database ID* en `wrangler.toml`.
3. **Publicar** desde esta carpeta:
   ```
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put CLAVE_PRUEBA      # una clave cualquiera para la prueba manual
   ```
4. **Probar**: abrir `https://obralyt-reporte.<tu-cuenta>.workers.dev/?clave=LA_CLAVE&dias=7`. Debe llegar el correo en un minuto.

Un cambio solo en `reporte.js` llega al Worker con `npx wrangler deploy`; publicar el sitio (Pages) no lo actualiza.

Para agregar a Jacob: verificar su correo en Email Routing y sumarlo en `allowed_destination_addresses` y en `DESTINATARIOS`.
