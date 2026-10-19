// Recorrido completo del sitio en un navegador real: enlaces, redirecciones, imágenes, video,
// botones, secciones, páginas legales, herramienta y mediciones que se envían a /api/evento.
//
//   node pruebas/recorrido-sitio.mjs http://localhost:8788      (copia local con wrangler pages dev)
//   node pruebas/recorrido-sitio.mjs https://obralyt.com         (sitio público, en modo prueba interna)
//
// En el sitio público se agrega ?interno=1: las visitas de esta prueba van a la tabla de excluidos
// y no ensucian las estadísticas. Requiere Playwright y Chromium (PLAYWRIGHT_BROWSERS_PATH).
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch (e) { playwright = createRequire("/opt/node-tools/node_modules/")("playwright"); }
const { chromium } = playwright;

const BASE = (process.argv[2] || "http://localhost:8788").replace(/\/$/, "");
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const MARCA = LOCAL ? "medir=1&interno=1" : "interno=1";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const EJEMPLO = new URL("./archivos/secop_idiger_formulario1.xlsx", import.meta.url).pathname;

const problemas = [];
let h264Global = true;
const ok = [];
const fallo = (que, detalle) => problemas.push(que + (detalle ? " → " + detalle : ""));
const bien = (que) => { ok.push(que); if (process.env.DETALLE) console.log("✓ " + que); };

// Detrás de un proxy (HTTPS_PROXY), Chromium debe usarlo explícitamente para salir a internet.
const proxy = process.env.HTTPS_PROXY && !LOCAL ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", proxy });

// ---------------------------------------------------------------- 1. redirecciones y archivos públicos
const ctxHttp = await browser.newContext({ userAgent: UA });
const http = ctxHttp.request;
const REDIRECCIONES = [
  ["/c/900511471", "/?utm_source=secop&utm_medium=prospeccion&utm_content=900511471"],
  ["/in", "/?utm_source=linkedin&utm_medium=social"],
  ["/in/post-1", "/?utm_source=linkedin&utm_medium=social&utm_content=post-1"],
  ["/ig", "/?utm_source=instagram&utm_medium=bio"],
  ["/ig/reel-1", "/?utm_source=instagram&utm_medium=social&utm_content=reel-1"],
  ["/yt", "/?utm_source=youtube&utm_medium=canal"],
  ["/yt/557-partidas", "/?utm_source=youtube&utm_medium=video&utm_content=557-partidas"],
  ["/empresa", "/?utm_source=linkedin&utm_medium=empresa"],
  ["/privacidad", "/#/privacidad"],
  ["/terminos", "/#/terminos"],
];
for (const [desde, hacia] of REDIRECCIONES) {
  const r = await http.get(BASE + desde, { maxRedirects: 0 });
  const loc = r.headers()["location"] || "";
  if (![301, 302].includes(r.status()) || !loc.endsWith(hacia)) fallo("Redirección " + desde, r.status() + " " + loc);
  else bien("Redirección " + desde + " → " + hacia);
}
for (const [ruta, tipo] of [["/", "text/html"], ["/robots.txt", "text/plain"], ["/sitemap.xml", "xml"], ["/og-image.png", "image/png"], ["/apple-touch-icon.png", "image/png"], ["/video/obralyt-como-funciona.jpg", "image/jpeg"], ["/video/obralyt-como-funciona.mp4?v=audio3-faststart", "video/mp4"]]) {
  const r = await http.get(BASE + ruta);
  const ct = r.headers()["content-type"] || "";
  if (r.status() !== 200 || !ct.includes(tipo)) fallo("Archivo " + ruta, r.status() + " " + ct);
  else bien("Archivo " + ruta);
}
const html = await (await http.get(BASE + "/")).text();
for (const [nombre, re] of [["título", /<title>[^<]{10,}<\/title>/], ["descripción", /<meta\s+name="description"\s+content="[^"]{30,}"/], ["og:image", /property="og:image" content="https:\/\/obralyt\.com\/og-image\.png"/], ["canonical", /rel="canonical" href="https:\/\/obralyt\.com\/"/]]) {
  if (re.test(html)) bien("Etiqueta " + nombre); else fallo("Etiqueta " + nombre, "no está o está mal");
}
await ctxHttp.close();

// ---------------------------------------------------------------- 2. recorrido en computador y celular
for (const vista of [{ nombre: "computador", viewport: { width: 1366, height: 900 } }, { nombre: "celular", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
  const ctx = await browser.newContext({ viewport: vista.viewport, isMobile: vista.isMobile, hasTouch: vista.hasTouch, userAgent: UA, acceptDownloads: true });
  // Los sitios externos (redes, LinkedIn) no se cargan: basta con comprobar que el clic abre su dirección.
  await ctx.route((url) => !url.href.startsWith(BASE) && !url.href.startsWith("data:") && !url.href.startsWith("blob:"), (ruta) => ruta.abort());
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  const errores = [];
  const eventos = [];
  const fallidas = [];
  p.on("pageerror", (e) => errores.push(e.message));
  // Un recurso externo que no carga (p. ej. el beacon de Cloudflare Web Analytics bloqueado por la red
  // de pruebas) no es un error del sitio.
  p.on("console", (m) => { if (m.type() === "error" && !(/Failed to load resource/.test(m.text()) && !(m.location().url || "").startsWith(BASE))) errores.push(m.text()); });
  p.on("requestfailed", (r) => { if (r.url().startsWith(BASE) && !/\/api\/evento|\.mp4/.test(r.url()) && !/ERR_ABORTED/.test((r.failure() || {}).errorText)) fallidas.push(r.url() + " " + (r.failure() || {}).errorText); });
  p.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) fallidas.push(r.status() + " " + r.url()); });
  // Mediciones: se leen del cuerpo de cada envío a /api/evento (fetch o sendBeacon).
  await ctx.route("**/api/evento", (ruta) => {
    try { for (const e of JSON.parse(ruta.request().postData() || "{}").eventos || []) eventos.push(e.n || e.nombre); } catch (e) { /* cuerpo ilegible */ }
    ruta.continue();
  });
  // Direcciones externas que el navegador intentó abrir (las redes no se cargan: se bloquean arriba).
  const externasPedidas = [];
  ctx.on("request", (r) => { if (!r.url().startsWith(BASE)) externasPedidas.push(r.url()); });
  const v = "[" + vista.nombre + "] ";

  await p.goto(BASE + "/?utm_source=prueba&utm_medium=recorrido&" + MARCA, { waitUntil: "networkidle" });

  // Desborde horizontal (la página no debe moverse de lado en el celular).
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  if (ancho > vista.viewport.width + 1) fallo(v + "La página se desborda a lo ancho", ancho + "px");
  else bien(v + "Sin desborde horizontal");

  // Imágenes: todas deben cargar.
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(800);
  const imgs = await p.$$eval("img", (l) => l.map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, alt: i.alt })));
  for (const i of imgs) { if (!i.ok) fallo(v + "Imagen rota", i.src); }
  if (imgs.length && imgs.every((i) => i.ok)) bien(v + imgs.length + " imágenes cargan");
  const sinAlt = imgs.filter((i) => !i.alt);
  if (sinAlt.length) fallo(v + sinAlt.length + " imágenes sin texto alternativo", sinAlt.map((i) => i.src).join(", "));

  // Enlaces: anclas internas que existan, externos con destino correcto y target seguro.
  const enlaces = await p.$$eval("a[href]", (l) => l.map((a) => ({ href: a.getAttribute("href"), abs: a.href, texto: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 40), target: a.target, rel: a.rel, visible: !!(a.offsetWidth || a.offsetHeight) })));
  for (const a of enlaces) {
    if (a.href.startsWith("#") && !a.href.startsWith("#/")) {
      const existe = a.href.length > 1 && (await p.evaluate((id) => !!document.getElementById(id), decodeURIComponent(a.href.slice(1))));
      if (a.href.length > 1 && !existe) fallo(v + "Ancla sin destino", a.href + " («" + a.texto + "»)");
    } else if (/^https?:/.test(a.href) && !a.abs.startsWith(BASE)) {
      if (a.target !== "_blank" || !/noopener/.test(a.rel)) fallo(v + "Enlace externo sin abrir en pestaña nueva segura", a.href);
    }
  }
  const externos = [...new Set(enlaces.filter((a) => /^https?:/.test(a.href) && !a.abs.startsWith(BASE)).map((a) => a.href))];
  const correos = [...new Set(enlaces.filter((a) => a.href.startsWith("mailto:")).map((a) => a.href))];
  bien(v + enlaces.length + " enlaces revisados; externos: " + externos.join(", ") + "; correos: " + correos.join(", "));
  fs.writeFileSync((process.env.SALIDA || "/tmp") + "/enlaces-" + vista.nombre + ".json", JSON.stringify(enlaces, null, 1));

  // Clic en cada enlace medido: abre pestaña nueva (redes, LinkedIn) o mailto, sin romper la página.
  for (const a of enlaces.filter((x) => x.visible && (/^https?:/.test(x.href) && !x.abs.startsWith(BASE)))) {
    const loc = p.locator(`a[href="${a.href}"]`).first();
    const [nueva] = await Promise.all([ctx.waitForEvent("page", { timeout: 4000 }).catch(() => null), loc.click({ modifiers: [] }).catch((e) => fallo(v + "No se pudo hacer clic en " + a.href, e.message))]);
    if (nueva) {
      await p.waitForTimeout(300);
      await nueva.close();
      if (!externasPedidas.some((u) => u.startsWith(a.href.replace(/\/$/, "")))) fallo(v + "El clic no abrió la dirección del enlace", a.href);
      else bien(v + "Clic abre " + a.href);
    }
    else fallo(v + "El enlace no abrió pestaña nueva", a.href);
  }

  // Preguntas frecuentes: abrir cada una.
  const preguntas = p.locator("details summary");
  const nPreg = await preguntas.count();
  for (let i = 0; i < nPreg; i++) await preguntas.nth(i).click();
  bien(v + nPreg + " preguntas frecuentes abiertas");

  // Video: debe reproducirse.
  const video = p.locator("video").first();
  const h264 = await p.evaluate(() => document.createElement("video").canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"'));
  h264Global = !!h264;
  if (await video.count() && !h264) {
    bien(v + "Video presente (este Chromium de pruebas no reproduce H.264; los navegadores reales sí)");
  } else if (await video.count()) {
    await video.scrollIntoViewIfNeeded();
    const reproduce = await video.evaluate(async (el) => {
      el.muted = true;
      const espera = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        await Promise.race([el.play(), espera(8000).then(() => { throw new Error("no arrancó en 8 s (readyState " + el.readyState + ")"); })]);
        await espera(1500);
        return el.currentTime > 0.2 && !el.error ? true : "currentTime " + el.currentTime + (el.error ? " error " + el.error.code : "");
      } catch (e) { return "error: " + e.message; }
    }).catch((e) => "error: " + e.message);
    if (reproduce === true) bien(v + "Video se reproduce"); else fallo(v + "Video no se reproduce", String(reproduce));
  } else fallo(v + "No hay video en la página");

  // Botones «Ver ejemplo» y la herramienta.
  await p.evaluate(() => window.scrollTo(0, 0));
  const verEjemplo = p.getByRole("link", { name: /^ver ejemplo$/i }).first();
  if (await verEjemplo.count()) {
    await verEjemplo.click();
    const visto = await p.getByText(/explican el 80% del valor/).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    visto ? bien(v + "«Ver ejemplo» muestra el análisis") : fallo(v + "«Ver ejemplo» no mostró el análisis");
  } else fallo(v + "No se encontró el botón «Ver ejemplo»");

  // Descargar el archivo de formato de ejemplo.
  const formato = p.getByRole("button", { name: /archivo de ejemplo/i }).first();
  if (await formato.count()) {
    const d = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), formato.click()]).then((x) => x[0]);
    d ? bien(v + "Descarga del formato de ejemplo: " + d.suggestedFilename()) : fallo(v + "El archivo de ejemplo no se descargó");
  }

  // Subir un presupuesto real.
  await p.setInputFiles('input[type=file][accept=".xlsx,.xls,.csv"]', EJEMPLO);
  const linea = await p.getByText(/17 de 81 partidas \(21%\) explican el 80% del valor/).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  linea ? bien(v + "Presupuesto subido: 17 de 81 partidas explican el 80 %") : fallo(v + "El presupuesto subido no dio 17 de 81");

  // Navegación de resultados y pestañas de módulos.
  const botonesTool = await p.$$eval("button", (l) => l.filter((b) => b.offsetParent && !b.disabled).map((b) => (b.innerText || b.getAttribute("aria-label") || "").trim()).filter(Boolean));
  for (const t of [...new Set(botonesTool)]) {
    if (/descargar|ejemplo|enviar|cerrar|×|probar con mi presupuesto/i.test(t)) continue;
    const b = p.getByRole("button", { name: t, exact: true }).first();
    try { await b.click({ timeout: 2000 }); } catch (e) { /* botones que se ocultan al cambiar de vista */ }
  }
  bien(v + "Clic en " + new Set(botonesTool).size + " botones de la herramienta");

  // Descargar el reporte: pide el correo la primera vez y luego descarga.
  await p.getByRole("button", { name: /descargar excel/i }).first().click();
  const form = p.locator("form").filter({ has: p.locator("input[type=email]") });
  if (await form.isVisible().catch(() => false)) {
    await form.locator("input[type=email]").fill("recorrido@prueba-obralyt.com");
    await form.locator("input[type=checkbox]").check();
    const d = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), form.locator("button[type=submit]").click()]).then((x) => x[0]);
    if (d) bien(v + "Formulario de contacto y descarga del reporte: " + d.suggestedFilename());
    else {
      const aviso = await form.locator("p").last().innerText().catch(() => "");
      await p.screenshot({ path: (process.env.SALIDA || "/tmp") + "/fallo-reporte-" + vista.nombre + ".png" });
      fallo(v + "El reporte no se descargó después del formulario", aviso);
    }
  } else fallo(v + "No apareció el formulario de contacto");

  // Páginas legales.
  for (const pag of ["privacidad", "terminos"]) {
    await p.goto(BASE + "/?" + MARCA + "#/" + pag);
    const t = await p.locator("h1").first().innerText().catch(() => "");
    await p.waitForTimeout(2000); // las mediciones salen en lotes cada 1,5 s
    t ? bien(v + "Página legal " + pag + ": «" + t + "»") : fallo(v + "Página legal " + pag + " sin título");
  }

  await p.goto(BASE + "/?" + MARCA);
  await p.waitForTimeout(2500);
  await ctx.close();

  if (errores.length) fallo(v + "Errores de JavaScript", [...new Set(errores)].join(" | "));
  else bien(v + "Sin errores de JavaScript");
  if (fallidas.length) fallo(v + "Peticiones fallidas", [...new Set(fallidas)].join(" | "));
  const unicos = [...new Set(eventos)];
  const esperados = ["visita", "seccion_vista", "pregunta_abierta", "video_reproducido", "clic_ver_ejemplo", "ejemplo_cargado", "presupuesto_cargado", "analisis_completado", "resultado_visto", "clic_descargar_excel", "formulario_contacto_visto", "reporte_excel_descargado", "pagina_legal_vista", "clic_linkedin", "clic_instagram", "clic_youtube", "formato_ejemplo_descargado"];
  const faltan = esperados.filter((e) => !unicos.includes(e) && !(e === "video_reproducido" && !h264Global));
  if (faltan.length) fallo(v + "Mediciones que no se enviaron", faltan.join(", "));
  else bien(v + "Mediciones enviadas: " + unicos.join(", "));
}

await browser.close();
console.log("\n=== BIEN (" + ok.length + ") ===\n" + ok.map((x) => "✓ " + x).join("\n"));
console.log("\n=== PROBLEMAS (" + problemas.length + ") ===\n" + (problemas.map((x) => "✗ " + x).join("\n") || "ninguno"));
process.exit(problemas.length ? 1 : 0);
