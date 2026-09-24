// Medición de marketing de la landing.
//
// Qué se mide: visitas, de dónde llegan (LinkedIn, WhatsApp, Google, campañas con UTM),
// qué secciones ven, en qué botones hacen clic, qué preguntas frecuentes abren,
// y si usan la herramienta (cargó un archivo / vio el ejemplo / descargó el Excel).
//
// Qué NUNCA se mide: el contenido del presupuesto, el nombre del archivo, montos,
// partidas, totales ni ningún resultado del análisis. Los eventos solo llevan un nombre
// y, a lo sumo, la ubicación del botón en la página.
//
// Herramienta: Umami Cloud (sin cookies, plan gratuito para sitios pequeños). Mientras
// UMAMI_WEBSITE_ID esté vacío, no se carga nada y registrarEvento() no hace nada.
// Para activarlo: crea la cuenta en https://cloud.umami.is, agrega el sitio www.cimbrapro.com
// y pega aquí el "Website ID" que te da Umami.
export const UMAMI_WEBSITE_ID = "";

const DOMINIOS = "www.cimbrapro.com,cimbrapro.com"; // no mide las pruebas locales
let cola = [];
let cargado = false;

export function iniciarMedicion() {
  if (!UMAMI_WEBSITE_ID || cargado || typeof document === "undefined") return;
  cargado = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  s.setAttribute("data-domains", DOMINIOS);
  s.onload = () => {
    const pendientes = cola;
    cola = [];
    pendientes.forEach(([n, d]) => enviar(n, d));
  };
  document.head.appendChild(s);
}

function enviar(nombre, datos) {
  try {
    if (window.umami && typeof window.umami.track === "function") {
      datos ? window.umami.track(nombre, datos) : window.umami.track(nombre);
      return true;
    }
  } catch (e) {
    /* la medición nunca debe romper la página */
  }
  return false;
}

// datos: solo textos cortos de navegación (p. ej. { ubicacion: "encabezado" }).
export function registrarEvento(nombre, datos) {
  if (!UMAMI_WEBSITE_ID) return;
  if (!enviar(nombre, datos) && cola.length < 50) cola.push([nombre, datos]);
}

// Registra una sola vez cada sección cuando el visitante la ve (profundidad de lectura).
export function observarSecciones(ids) {
  if (!UMAMI_WEBSITE_ID || typeof IntersectionObserver === "undefined") return () => {};
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
