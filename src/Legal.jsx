import { useEffect } from "react";
import logoHeader from "./assets/cimbra-web-header.svg";
import { CORREO_CONTACTO } from "./textos.js";

// Páginas de Privacidad y Términos de uso. Se muestran con la dirección #/privacidad y #/terminos.
const FECHA = "24 de septiembre de 2026";

const PRIVACIDAD = [
  {
    t: "Tu presupuesto no sale de tu computadora",
    p: [
      "El análisis se realiza completamente en tu navegador. El archivo que cargas no se sube ni se envía a los servidores de Cimbra ni a servicios de terceros, y Cimbra no lo almacena.",
      "Cuando cierras o recargas la página, los datos del análisis desaparecen. Los reportes en Excel se generan en tu equipo y quedan guardados donde tú los descargues.",
    ],
  },
  {
    t: "Qué datos pueden registrarse",
    p: [
      "Como ocurre en cualquier sitio web, el servicio que aloja esta página (Cloudflare) puede registrar datos técnicos de la visita, como la dirección IP, el tipo de navegador y las páginas consultadas, con fines de seguridad y de funcionamiento del sitio.",
      "Actualmente el sitio no utiliza cookies de publicidad ni herramientas propias de análisis de uso. Si en el futuro incorporamos estadísticas de uso, actualizaremos esta página para informarlo.",
    ],
  },
  {
    t: "Si nos escribes",
    p: ["Si nos escribes a " + CORREO_CONTACTO + ", usaremos tu mensaje y tu dirección de correo únicamente para responderte."],
  },
  {
    t: "Cambios en esta política",
    p: ["Podemos actualizar esta página cuando cambie el funcionamiento del sitio. La fecha de la última actualización aparece arriba."],
  },
];

const TERMINOS = [
  {
    t: "Qué es Cimbra",
    p: ["Cimbra es una herramienta de análisis que muestra en qué partidas de un presupuesto de construcción se concentra el valor económico, y genera referencias iniciales de cronograma, flujo de caja y prioridades de procura. Actualmente se ofrece en fase de prueba, sin costo."],
  },
  {
    t: "Uso de la herramienta",
    p: ["Al usar Cimbra declaras que tienes derecho a analizar los archivos que cargas. Tu presupuesto sigue siendo tuyo, y los reportes que descargues puedes usarlos libremente en tu trabajo. El diseño, la marca y el software de Cimbra pertenecen a sus titulares."],
  },
  {
    t: "Los resultados son referencias, no asesoría profesional",
    p: [
      "Los resultados son aproximaciones que dependen de los datos de tu archivo. Cimbra no afirma que un precio esté bien o mal cotizado, no promete ahorros y no sustituye el criterio del profesional. El cronograma y el flujo de caja son estimaciones tempranas por fases, no una programación con dependencias ni ruta crítica.",
      "Antes de tomar decisiones de oferta, compra o contratación, verifica los resultados con tu propio análisis.",
    ],
  },
  {
    t: "Sin garantías y limitación de responsabilidad",
    p: ["La herramienta se ofrece tal como está, sin garantía de que esté libre de errores o disponible de forma ininterrumpida. En la medida que permita la ley, Cimbra no se hace responsable de decisiones tomadas con base en sus resultados ni de pérdidas derivadas de su uso."],
  },
  {
    t: "Cambios",
    p: ["Podemos modificar la herramienta o estos términos. La versión vigente es la publicada en esta página, con la fecha indicada arriba."],
  },
];

export default function Legal({ tipo }) {
  useEffect(() => { window.scrollTo(0, 0); }, [tipo]);
  const esPrivacidad = tipo === "privacidad";
  const titulo = esPrivacidad ? "Política de privacidad" : "Términos de uso";
  const secciones = esPrivacidad ? PRIVACIDAD : TERMINOS;
  const volver = (e) => { e.preventDefault(); window.location.hash = ""; window.scrollTo(0, 0); };
  return (
    <div className="min-h-screen bg-white text-cimbra-dark font-sans">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <a href="#" onClick={volver}><img src={logoHeader} alt="Cimbra" className="h-9 w-auto" /></a>
          <a href="#" onClick={volver} className="text-sm text-gray-600 hover:text-cimbra-dark">← Volver al inicio</a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-1">{titulo}</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: {FECHA}</p>
        {secciones.map((s) => (
          <section key={s.t} className="mb-6">
            <h2 className="text-base font-semibold mb-2">{s.t}</h2>
            {s.p.map((x, i) => (<p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{x}</p>))}
          </section>
        ))}
        <p className="text-sm text-gray-600 mt-8">¿Preguntas? Escríbenos a <a className="text-cimbra-amber font-medium hover:underline" href={"mailto:" + CORREO_CONTACTO}>{CORREO_CONTACTO}</a>.</p>
        <p className="text-sm mt-4">
          <a className="text-gray-500 hover:text-cimbra-dark underline" href={esPrivacidad ? "#/terminos" : "#/privacidad"}>
            {esPrivacidad ? "Ver los términos de uso" : "Ver la política de privacidad"}
          </a>
        </p>
      </main>
    </div>
  );
}
