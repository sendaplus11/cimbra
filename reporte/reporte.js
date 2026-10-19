// Reporte automático de OBRALYT: resumen diario y semanal por correo.
// Usa solo datos de navegación y contactos voluntarios (nunca presupuestos ni montos).
import { EmailMessage } from "cloudflare:email";

const fuente = `COALESCE(NULLIF(utm_source,''), CASE WHEN referencia IS NULL OR referencia = '' THEN 'directo' ELSE referencia END)`;

async function datos(db, dias) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const q = (sql, ...a) => db.prepare(sql).bind(...a).all().then((r) => r.results || []);
  const uno = (sql, ...a) => db.prepare(sql).bind(...a).first();
  const sesiones = (cond) => uno(`SELECT COUNT(DISTINCT sesion) AS n FROM eventos WHERE creado >= ? AND ${cond}`, desde).then((r) => (r ? r.n : 0));
  const [visitas, cargas, completados, ejemplos, leadsN, fuentes, activaciones, prospeccion, leads] = await Promise.all([
    sesiones("nombre = 'visita'"),
    sesiones("nombre = 'presupuesto_cargado'"),
    sesiones("nombre = 'analisis_completado' AND json_extract(datos,'$.origen') = 'archivo'"),
    sesiones("nombre = 'ejemplo_cargado'"),
    uno("SELECT COUNT(*) AS n FROM leads WHERE creado >= ? AND estado <> 'prueba'", desde).then((r) => (r ? r.n : 0)),
    q(`SELECT ${fuente} AS fuente, COUNT(DISTINCT sesion) AS n FROM eventos WHERE creado >= ? AND nombre = 'visita' GROUP BY fuente ORDER BY n DESC LIMIT 8`, desde),
    q(`SELECT ${fuente} AS fuente, COUNT(DISTINCT sesion) AS n FROM eventos WHERE creado >= ? AND nombre = 'analisis_completado' AND json_extract(datos,'$.origen') = 'archivo' GROUP BY fuente ORDER BY n DESC LIMIT 8`, desde),
    q(`SELECT utm_content AS empresa,
       COUNT(DISTINCT CASE WHEN nombre = 'visita' THEN sesion END) AS visitas,
       COUNT(DISTINCT CASE WHEN nombre = 'presupuesto_cargado' THEN sesion END) AS cargas,
       COUNT(DISTINCT CASE WHEN nombre = 'analisis_completado' AND json_extract(datos,'$.origen') = 'archivo' THEN sesion END) AS completados
       FROM eventos WHERE creado >= ? AND utm_medium = 'prospeccion' AND COALESCE(utm_content,'') <> ''
       GROUP BY utm_content ORDER BY completados DESC, cargas DESC, visitas DESC LIMIT 15`, desde),
    q("SELECT creado, nombre, correo, empresa, utm_source, utm_content FROM leads WHERE creado >= ? AND estado <> 'prueba' ORDER BY creado DESC LIMIT 15", desde),
  ]);
  return { dias, visitas, cargas, completados, ejemplos, leadsN, fuentes, activaciones, prospeccion, leads };
}

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");

function tabla(titulo, cabeceras, filas) {
  if (!filas.length) return `<h3 style="font-size:14px;margin:18px 0 6px">${titulo}</h3><p style="color:#888;font-size:13px;margin:0">Sin datos.</p>`;
  return `<h3 style="font-size:14px;margin:18px 0 6px">${titulo}</h3><table style="border-collapse:collapse;font-size:13px">
<tr>${cabeceras.map((h) => `<th style="text-align:left;padding:4px 12px 4px 0;color:#666;border-bottom:1px solid #ddd">${h}</th>`).join("")}</tr>
${filas.map((f) => `<tr>${f.map((c) => `<td style="padding:4px 12px 4px 0;border-bottom:1px solid #eee">${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
}

function html(d, etiqueta) {
  const kpi = [["Visitas", d.visitas, ""], ["Cargaron su presupuesto", d.cargas, pct(d.cargas, d.visitas)], ["Completaron el análisis", d.completados, pct(d.completados, d.visitas)], ["Vieron el ejemplo", d.ejemplos, ""], ["Dejaron su correo", d.leadsN, ""]];
  return `<div style="font-family:system-ui,Arial,sans-serif;color:#1C2B39;max-width:640px">
<h2 style="margin:0 0 4px">OBRALYT · ${etiqueta}</h2>
<p style="margin:0 0 14px;color:#666;font-size:13px">Últimos ${d.dias} día${d.dias > 1 ? "s" : ""}. Sin equipo ni pruebas internas.</p>
<table style="border-collapse:collapse"><tr>${kpi.map(([t, v, p], i) => `<td style="padding:8px 14px 8px 0;vertical-align:top"><div style="font-size:24px;font-weight:700;color:${i === 2 ? "#C9922B" : "#1C2B39"}">${v}</div><div style="font-size:12px;color:#555">${t}</div>${p ? `<div style="font-size:11px;color:#999">${p} de las visitas</div>` : ""}</td>`).join("")}</tr></table>
${tabla("De dónde llegan", ["Canal", "Visitas"], d.fuentes.map((f) => [f.fuente, f.n]))}
${tabla("Análisis completados por canal", ["Canal", "Completados"], d.activaciones.map((f) => [f.fuente, f.n]))}
${tabla("Prospección por empresa (enlaces /c/)", ["Empresa", "Abrió", "Cargó", "Completó"], d.prospeccion.map((p) => [p.empresa, p.visitas, p.cargas, p.completados]))}
${tabla("Contactos nuevos", ["Fecha", "Nombre", "Correo", "Empresa", "Llegó desde"], d.leads.map((l) => [l.creado.slice(0, 10), l.nombre, l.correo, l.empresa, [l.utm_source, l.utm_content].filter(Boolean).join(" · ") || "directo"]))}
<p style="margin-top:18px;font-size:12px;color:#999">Detalle completo en el panel privado: obralyt.com/#/panel</p></div>`;
}

function mime(remitente, para, asunto, cuerpo) {
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const lineas = b64(cuerpo).match(/.{1,76}/g).join("\r\n");
  return [
    `From: OBRALYT Reportes <${remitente}>`,
    `To: ${para}`,
    `Subject: =?UTF-8?B?${b64(asunto)}?=`,
    `Message-ID: <${crypto.randomUUID()}@obralyt.com>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    lineas,
  ].join("\r\n");
}

async function enviarReporte(env, dias, etiqueta) {
  const d = await datos(env.DB, dias);
  const asunto = `OBRALYT ${etiqueta}: ${d.visitas} visitas · ${d.completados} análisis · ${d.leadsN} contactos`;
  const cuerpo = html(d, etiqueta);
  for (const para of (env.DESTINATARIOS || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    await env.CORREO.send(new EmailMessage(env.REMITENTE, para, mime(env.REMITENTE, para, asunto, cuerpo)));
  }
  return d;
}

export default {
  async scheduled(evento, env, ctx) {
    const semanal = evento.cron === "10 12 * * 1";
    ctx.waitUntil(enviarReporte(env, semanal ? 7 : 1, semanal ? "Reporte semanal" : "Reporte diario"));
  },
  // Prueba manual: https://obralyt-reporte.<cuenta>.workers.dev/?clave=...&dias=7
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.CLAVE_PRUEBA || url.searchParams.get("clave") !== env.CLAVE_PRUEBA) return new Response("No autorizado", { status: 401 });
    const dias = Math.min(90, Math.max(1, Number(url.searchParams.get("dias")) || 7));
    const d = await enviarReporte(env, dias, "Reporte de prueba");
    return new Response(`Enviado: ${d.visitas} visitas, ${d.completados} análisis, ${d.leadsN} contactos`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};
