// Medición de marketing de OBRALYT (propia, sin cookies y sin terceros).
//
// Qué se mide: visitas y de dónde llegan (LinkedIn, WhatsApp, Google, campañas con UTM),
// qué secciones se ven (hasta dónde llega cada visitante), en qué botones hace clic, qué
// preguntas frecuentes abre y si usa la herramienta (cargó un archivo / vio el ejemplo /
// navegó los resultados / descargó el Excel).
//
// Qué NUNCA se mide: el contenido del presupuesto, el nombre del archivo, montos, partidas,
// totales ni ningún resultado del análisis. Los eventos solo llevan un nombre y, a lo sumo,
// la ubicación del botón o la sección de la página.
//
// Cómo funciona: cada visita recibe un identificador al azar que vive solo mientras la pestaña
// está abierta (sessionStorage); no hay cookies ni seguimiento entre visitas o entre sitios.
// Los eventos se envían en lotes a /api/evento (Cloudflare Pages Functions + base D1).

const ENDPOINT = "/api/evento";
const DOMINIOS_MEDIDOS = /(^|\.)obralyt\.com$|\.pages\.dev$/;

let cola = [];
let iniciado = false;
let temporizador = null;
let contexto = null;

function activo() {
  if (typeof window === "undefined") return false;
  if (!DOMINIOS_MEDIDOS.test(window.location.hostname) && !/[?&]medir=1/.test(window.location.search)) return false; // no mide pruebas locales
  return true;
}

// Modo interno: las visitas del equipo (Carlos, Jacob) y sus pruebas NO cuentan en las estadísticas.
// Sus eventos se guardan aparte (tabla eventos_excluidos) para poder verificar enlaces sin ensuciar los datos.
//   obralyt.com/?interno=activar     → este navegador queda marcado como del equipo (permanente)
//   obralyt.com/?interno=1           → solo esta pestaña/sesión es una prueba
//   obralyt.com/?interno=desactivar  → quita la marca
// El navegador de quien entra al panel privado también queda marcado (obralyt_no_medir).
let interno = null;
export function modoInterno() {
  if (interno !== null) return interno;
  interno = "";
  if (typeof window === "undefined") return interno;
  try {
    const p = new URLSearchParams(window.location.search);
    const orden = (p.get("interno") || "").toLowerCase();
    if (orden === "activar") localStorage.setItem("obralyt_no_medir", "1");
    else if (orden === "desactivar") { localStorage.removeItem("obralyt_no_medir"); sessionStorage.removeItem("obralyt_interno"); }
    else if (orden === "1" || orden === "prueba") sessionStorage.setItem("obralyt_interno", "1");
    if (localStorage.getItem("obralyt_no_medir")) interno = "equipo";
    else if (sessionStorage.getItem("obralyt_interno")) interno = "prueba";
  } catch (e) { /* sin almacenamiento */ }
  return interno;
}

// Quita ?interno=... de la barra de direcciones (después de leer los UTM) y muestra un aviso discreto.
function prepararModoInterno() {
  try {
    contextoVisita();
    const url = new URL(window.location.href);
    if (url.searchParams.has("interno")) {
      url.searchParams.delete("interno");
      window.history.replaceState(window.history.state, "", url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash);
    }
    if (!modoInterno()) return;
    const aviso = document.createElement("div");
    aviso.textContent = modoInterno() === "equipo" ? "Modo interno · no cuenta en estadísticas" : "Prueba interna · no cuenta en estadísticas";
    aviso.setAttribute("aria-hidden", "true");
    aviso.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#1C2B39;color:#fff;font:600 11px/1.2 system-ui,sans-serif;padding:5px 8px;border-radius:6px;opacity:.85;pointer-events:none";
    document.body.appendChild(aviso);
  } catch (e) { /* nunca romper la página */ }
}

export function idSesion() {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("obralyt_sesion");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12));
      sessionStorage.setItem("obralyt_sesion", id);
    }
    return id;
  } catch (e) {
    if (!window.__obralytSesion) window.__obralytSesion = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    return window.__obralytSesion;
  }
}

// De dónde llegó la visita: dominio de referencia (sin rutas ni parámetros) y UTM de campañas.
export function contextoVisita() {
  if (contexto) return contexto;
  let referencia = "";
  try {
    if (document.referrer) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (!/obralyt\.com$/.test(h)) referencia = h;
    }
  } catch (e) { /* sin referencia */ }
  const p = new URLSearchParams(window.location.search);
  const utm = { source: p.get("utm_source") || "", medium: p.get("utm_medium") || "", campaign: p.get("utm_campaign") || "", content: p.get("utm_content") || "" };
  contexto = { referencia, utm };
  return contexto;
}

function enviar(usarBeacon) {
  if (!cola.length) return;
  const lote = cola.splice(0, 20);
  const { referencia, utm } = contextoVisita();
  const cuerpo = JSON.stringify({ sesion: idSesion(), referencia, utm, interno: modoInterno() || undefined, eventos: lote });
  try {
    if (usarBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([cuerpo], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, keepalive: true }).catch(() => {});
    }
  } catch (e) {
    /* la medición nunca debe romper la página */
  }
  if (cola.length) enviar(usarBeacon);
}

function programarEnvio() {
  if (temporizador) return;
  temporizador = setTimeout(() => { temporizador = null; enviar(false); }, 1500);
}

export function iniciarMedicion() {
  if (iniciado) return;
  modoInterno();
  if (typeof window !== "undefined") prepararModoInterno();
  if (!activo()) return;
  iniciado = true;
  registrarEvento("visita", { pagina: window.location.hash.startsWith("#/") ? window.location.hash.slice(2) : "inicio" });
  // Al cerrar o cambiar de pestaña se envía lo pendiente.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviar(true); });
  window.addEventListener("pagehide", () => enviar(true));
  // Tiempo en la página: marcas a los 30 s, 2 min y 5 min (solo si la pestaña está visible).
  [30, 120, 300].forEach((s) => setTimeout(() => { if (document.visibilityState === "visible") registrarEvento("tiempo_en_pagina", { segundos: s }); }, s * 1000));
}

// datos: solo textos cortos de navegación (p. ej. { ubicacion: "encabezado" }).
export function registrarEvento(nombre, datos) {
  if (!activo()) return;
  if (cola.length >= 100) return;
  cola.push(datos ? { n: nombre, d: datos } : { n: nombre });
  programarEnvio();
}

// Registra una sola vez cada sección cuando el visitante la ve (profundidad de lectura).
export function observarSecciones(ids) {
  if (!activo() || typeof IntersectionObserver === "undefined") return () => {};
  const vistas = new Set();
  const obs = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        const id = e.target.id;
        if (e.isIntersecting && !vistas.has(id)) {
          vistas.add(id);
          registrarEvento("seccion_vista", { seccion: id });
        }
      });
    },
    // Cuenta la sección cuando su borde superior entra en el 60% superior de la pantalla
    // (funciona también con secciones más altas que la pantalla, como la herramienta).
    { threshold: 0, rootMargin: "0px 0px -40% 0px" }
  );
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
  return () => obs.disconnect();
}
