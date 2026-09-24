import { useEffect, useState } from "react";
import AnalisisPareto from "./AnalisisPareto.jsx";
import Legal from "./Legal.jsx";
import logoHero from "./assets/cimbra-web-hero.svg";
import logoHeader from "./assets/cimbra-web-header.svg";
import vistaEjemplo from "./assets/ejemplo-resultado.jpg";
import { LANDING as T, WHATSAPP_NUMERO, WHATSAPP_MENSAJE, CORREO_CONTACTO, LINKEDIN_URL } from "./textos.js";

const YEAR = new Date().getFullYear();
const whatsappUrl = WHATSAPP_NUMERO
  ? "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(WHATSAPP_MENSAJE)
  : null;

// Términos clave que nunca deben partirse entre dos renglones ("Cost / Drivers").
// Se unen con espacio duro y se resaltan en negrita dentro de los textos largos.
const TERMINOS_CLAVE = /(Cost Drivers|Compresión de Revisión)/g;
function Texto({ children }) {
  return String(children)
    .split(TERMINOS_CLAVE)
    .map((parte, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold text-cimbra-dark whitespace-nowrap">
          {parte.replace(/ /g, " ")}
        </strong>
      ) : (
        parte
      )
    );
}

const btnCta =
  "inline-block bg-cimbra-amber text-white font-medium rounded-lg hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark";
const btnSecundario =
  "inline-block border border-cimbra-dark text-cimbra-dark font-medium rounded-lg hover:bg-cimbra-dark hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark";

function usarHash() {
  const [hash, setHash] = useState(typeof window === "undefined" ? "" : window.location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(window.location.hash);
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);
  return hash;
}

// El botón "Ver ejemplo" le pide a la herramienta que cargue el presupuesto de ejemplo.
function verEjemplo(e) {
  e.preventDefault();
  window.dispatchEvent(new Event("cimbra:ejemplo"));
}

export default function App() {
  const hash = usarHash();
  if (hash === "#/privacidad") return <Legal tipo="privacidad" />;
  if (hash === "#/terminos") return <Legal tipo="terminos" />;

  return (
    <div className="min-h-screen bg-white text-cimbra-dark font-sans">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <img src={logoHeader} alt="Cimbra" className="h-9 w-auto" />
          <nav className="flex items-center gap-4 text-sm">
            <a href="#que-es" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Qué es</a>
            <a href="#caso-real" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Caso real</a>
            <a href="#preguntas" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Preguntas</a>
            <a href="#herramienta" className={btnCta + " text-sm px-4 py-1.5 rounded"}>{T.cta}</a>
          </nav>
        </div>
      </header>

      {/* Encabezado: logo, "inteligencia de costos" legible, mensaje de 10 segundos, apoyo y botones */}
      <section className="bg-[#F7F5F1] blueprint-grid border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-5 md:py-7 flex flex-col items-center text-center">
          <img src={logoHero} alt="Cimbra" className="h-24 md:h-28 w-auto" />
          <p className="mt-1 flex items-center gap-3 text-cimbra-dark font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-xs sm:text-sm md:text-base">
            <span aria-hidden="true" className="hidden sm:block h-px w-10 md:w-14 bg-cimbra-amber"></span>
            {T.etiqueta}
            <span aria-hidden="true" className="hidden sm:block h-px w-10 md:w-14 bg-cimbra-amber"></span>
          </p>
          <h1 className="mt-4 text-lg md:text-2xl font-semibold leading-snug max-w-2xl text-balance text-cimbra-dark">
            {T.mensaje10s}
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 max-w-xl leading-relaxed text-balance">{T.apoyo}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a href="#herramienta" className={btnCta + " px-5 py-2.5"}>{T.ctaPrincipal}</a>
            <a href="#herramienta" onClick={verEjemplo} className={btnSecundario + " px-5 py-2.5"}>{T.ctaEjemplo}</a>
          </div>
          <p className="mt-3 text-xs text-gray-500 max-w-xl">{T.lineaConfianza}</p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <h2 className="text-xl font-semibold mb-1 text-center">{T.pasosTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6">{T.pasosSubtitulo}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {T.pasos.map((p) => (
            <div key={p.n} className="border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-2xl font-semibold text-cimbra-amber leading-none mb-2">{p.n}</p>
              <h3 className="text-base font-semibold mb-1">{p.titulo}</h3>
              <p className="text-sm text-gray-700 leading-relaxed"><Texto>{p.texto}</Texto></p>
            </div>
          ))}
        </div>
      </section>

      {/* Caso de referencia: primera prueba concreta */}
      <section id="caso-real" className="max-w-5xl mx-auto px-4 py-8 scroll-mt-14">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-cimbra-amber mb-1">{T.casoEtiqueta}</p>
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-balance">{T.casoTitulo}</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {T.casoCifras.map((c) => (
              <div key={c.etiqueta} className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
                <p className="text-xl md:text-2xl font-semibold text-cimbra-amber leading-tight">{c.valor}</p>
                <p className="text-xs text-gray-500">{c.etiqueta}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed"><Texto>{T.casoTexto}</Texto></p>
          <p className="text-gray-700 text-sm leading-relaxed mt-2 font-medium">{T.casoDestacado}</p>
          <a href="#herramienta" className={btnCta + " mt-4 text-sm px-4 py-2"}>{T.casoCta}</a>
        </div>
      </section>

      {/* El núcleo */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <h2 className="text-xl font-semibold mb-1 text-center">{T.nucleoTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6">{T.nucleoSubtitulo}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {T.nucleo.map((f) => (
            <div key={f.titulo} className="border-l-4 border-cimbra-amber bg-white border border-gray-200 rounded-r-xl p-4">
              <h3 className="text-base font-semibold mb-1 whitespace-nowrap">{f.titulo.replace(/ /g, " ")}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{f.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Qué obtendrás: captura real del resultado */}
      <section className="bg-[#F7F5F1] border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-1 text-center">{T.vistaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-6 max-w-2xl mx-auto">{T.vistaSubtitulo}</p>
          <div className="grid md:grid-cols-7 gap-6 items-start">
            <ul className="md:col-span-2 space-y-2 text-sm text-gray-700 md:pt-4">
              {T.vistaElementos.map((x) => (
                <li key={x} className="flex gap-2"><span className="text-cimbra-amber font-semibold">✓</span><span><Texto>{x}</Texto></span></li>
              ))}
            </ul>
            <div className="md:col-span-5">
              <a href={vistaEjemplo} target="_blank" rel="noopener noreferrer" title="Abrir la captura en tamaño completo">
                <img src={vistaEjemplo} alt={T.vistaAlt} className="w-full rounded-lg border border-gray-200 shadow-sm bg-white" loading="lazy" />
              </a>
              <p className="text-center mt-3">
                <a href="#herramienta" onClick={verEjemplo} className={btnSecundario + " text-sm px-4 py-1.5"}>{T.ctaEjemplo} en vivo</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resultados complementarios */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-cimbra-amber text-center mb-1">{T.complementariosEtiqueta}</p>
        <h2 className="text-xl font-semibold mb-1 text-center">{T.complementariosTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6 max-w-2xl mx-auto">{T.complementariosSubtitulo}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {T.complementarios.map((c) => (
            <div key={c.titulo} className="border border-gray-200 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold mb-1">{c.titulo}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{c.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* La herramienta */}
      <section id="herramienta" className="bg-gray-50 border-t border-gray-100 scroll-mt-14">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-2 text-center">{T.herramientaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-8 max-w-2xl mx-auto">{T.herramientaTexto}</p>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <AnalisisPareto />
          </div>
        </div>
      </section>

      {/* Qué es Cimbra: información escaneable */}
      <section id="que-es" className="max-w-5xl mx-auto px-4 py-10 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-2 text-center">{T.quienesSomosTitulo}</h2>
        <p className="text-gray-600 text-sm text-center mb-6 max-w-2xl mx-auto">{T.problema}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {T.bloques.map((b) => (
            <div key={b.titulo} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <h3 className="text-base font-semibold mb-2">{b.titulo}</h3>
              <ul className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
                {b.puntos.map((x) => (
                  <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-cimbra-amber">•</span><span><Texto>{x}</Texto></span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Quién está detrás */}
      <section className="max-w-3xl mx-auto px-4 pb-10 text-center">
        <h2 className="text-lg font-semibold mb-2">{T.fundadorTitulo}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{T.fundadorTexto}</p>
        {LINKEDIN_URL && (
          <p className="mt-3">
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="text-cimbra-amber font-medium text-sm hover:underline">
              {T.fundadorEnlace} →
            </a>
          </p>
        )}
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-3xl mx-auto px-4 py-10 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-4 text-center">{T.faqTitulo}</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {T.faq.map((f) => (
            <details key={f.p} className="group py-3">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-sm">
                {f.p}
                <span className="text-cimbra-amber text-lg leading-none transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed"><Texto>{f.r}</Texto></p>
            </details>
          ))}
        </div>
        {whatsappUrl && (
          <div className="text-center mt-6">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block border border-cimbra-dark text-cimbra-dark text-sm font-medium px-5 py-2 rounded-lg hover:bg-cimbra-dark hover:text-white transition">
              {T.whatsappTexto}
            </a>
          </div>
        )}
        {CORREO_CONTACTO && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              {T.correoTitulo}{" "}
              <a href={"mailto:" + CORREO_CONTACTO} className="text-cimbra-amber font-medium hover:underline">
                {T.correoTexto} {CORREO_CONTACTO}
              </a>
            </p>
          </div>
        )}
      </section>

      {/* Llamado final */}
      <section className="bg-[#F7F5F1] border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <h2 className="text-xl md:text-2xl font-semibold mb-2 text-balance">{T.ctaFinalTitulo}</h2>
          <p className="text-sm text-gray-600 mb-4">{T.ctaFinalTexto}</p>
          <a href="#herramienta" className={btnCta + " px-5 py-2.5"}>{T.ctaFinalBoton}</a>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="py-8 text-center text-sm text-gray-400 border-t border-gray-100">
        <p>
          <a href="#/privacidad" className="hover:text-cimbra-dark">Privacidad</a>
          {" "}·{" "}
          <a href="#/terminos" className="hover:text-cimbra-dark">Términos de uso</a>
          {CORREO_CONTACTO && (
            <>
              {" "}·{" "}
              <a href={"mailto:" + CORREO_CONTACTO} className="hover:text-cimbra-dark">{CORREO_CONTACTO}</a>
            </>
          )}
        </p>
        <p className="mt-1">Cimbra · {YEAR}</p>
      </footer>
    </div>
  );
}
