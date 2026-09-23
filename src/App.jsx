import AnalisisPareto from "./AnalisisPareto.jsx";
import logoHero from "./assets/cimbra-web-hero.svg";
import logoHeader from "./assets/cimbra-web-header.svg";
import { LANDING as T, WHATSAPP_NUMERO, WHATSAPP_MENSAJE, CORREO_CONTACTO } from "./textos.js";

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
          {parte.replace(/ /g, "\u00A0")}
        </strong>
      ) : (
        parte
      )
    );
}

const btnCta =
  "inline-block bg-cimbra-amber text-white font-medium rounded-lg hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-cimbra-dark font-sans">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <img src={logoHeader} alt="Cimbra" className="h-9 w-auto" />
          <nav className="flex items-center gap-4 text-sm">
            <a href="#que-es" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Qué es</a>
            <a href="#preguntas" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Preguntas</a>
            <a href="#herramienta" className={btnCta + " text-sm px-4 py-1.5 rounded"}>{T.cta}</a>
          </nav>
        </div>
      </header>

      {/* Encabezado: logo, "inteligencia de costos" legible, mensaje de 10 segundos, apoyo y botón */}
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
          <a href="#herramienta" className={btnCta + " mt-4 px-5 py-2.5"}>{T.cta}</a>
        </div>
      </section>

      {/* Qué es Cimbra: toda la descripción en un solo lugar */}
      <section id="que-es" className="max-w-5xl mx-auto px-4 py-8 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-4 text-center">{T.quienesSomosTitulo}</h2>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 md:p-6">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
            {T.bloques.map((b, i) => (
              <div key={b.titulo} className={i === 0 ? "md:col-span-2 pb-5 border-b border-gray-200" : ""}>
                <h3 className="text-base font-semibold mb-1.5">{b.titulo}</h3>
                <p className="text-gray-700 text-sm leading-relaxed"><Texto>{b.texto}</Texto></p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-gray-200">
            <h3 className="text-base font-semibold mb-1.5">{T.casoTitulo}</h3>
            <div className="grid grid-cols-3 gap-3 my-3">
              {T.casoCifras.map((c) => (
                <div key={c.etiqueta} className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
                  <p className="text-xl md:text-2xl font-semibold text-cimbra-amber leading-tight">{c.valor}</p>
                  <p className="text-xs text-gray-500">{c.etiqueta}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed"><Texto>{T.casoTexto}</Texto></p>
          </div>
        </div>
      </section>

      {/* La herramienta */}
      <section id="herramienta" className="bg-gray-50 border-t border-gray-100 scroll-mt-14">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-2 text-center">{T.herramientaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-8">{T.herramientaTexto}</p>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <AnalisisPareto />
          </div>
        </div>
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

      {/* Pie de página */}
      <footer className="py-8 text-center text-sm text-gray-400 border-t border-gray-100">
        Cimbra · {YEAR}
        {CORREO_CONTACTO && (
          <>
            {" "}·{" "}
            <a href={"mailto:" + CORREO_CONTACTO} className="hover:text-cimbra-dark">
              {CORREO_CONTACTO}
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
