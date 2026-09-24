import { useEffect } from "react";
import logoHeader from "./assets/cimbra-web-header.svg";
import { CORREO_CONTACTO } from "./textos.js";
import { UMAMI_WEBSITE_ID } from "./medicion.js";

// Páginas de Privacidad y Términos de uso. Se muestran con la dirección #/privacidad y #/terminos.
// Versión 2. Si más adelante se constituye una empresa (p. ej. una LLC), basta con cambiar TITULAR.
const TITULAR = "Carlos Magallanes";
const DOMICILIO = "Miami, Florida, Estados Unidos";
const LEY_APLICABLE = "el estado de Florida, Estados Unidos";
const TRIBUNALES = "los tribunales estatales o federales con sede en el condado de Miami-Dade, Florida";
const FECHA = "24 de septiembre de 2026";
// La sección de estadísticas describe solo las herramientas que están activas.
const CON_UMAMI = Boolean(UMAMI_WEBSITE_ID);

const PRIVACIDAD = [
  {
    t: "1. Quién es responsable",
    p: [
      "Cimbra (cimbrapro.com) es un servicio operado por " + TITULAR + ", con domicilio en " + DOMICILIO + " («Cimbra», «nosotros»). Para cualquier asunto relacionado con tus datos puedes escribir a " + CORREO_CONTACTO + ".",
    ],
  },
  {
    t: "2. Tu presupuesto no sale de tu computadora",
    p: [
      "El análisis se ejecuta completamente en tu navegador. El archivo que cargas (Excel o CSV) no se sube ni se envía a servidores de Cimbra ni de terceros, y Cimbra no tiene acceso a su contenido ni lo almacena.",
      "Al cerrar o recargar la página, los datos del análisis desaparecen de la memoria del navegador. Los reportes en Excel se generan en tu equipo y quedan donde tú los guardes. Cimbra no usa cookies ni almacenamiento local del navegador para guardar tu información.",
    ],
  },
  {
    t: "3. Qué datos sí se tratan",
    p: [
      "Datos técnicos de la visita: el sitio está alojado en Cloudflare, que, como cualquier proveedor de alojamiento, procesa datos técnicos necesarios para entregar la página y protegerla (por ejemplo, dirección IP, tipo de navegador y dispositivo, página solicitada, fecha y hora).",
      "Estadísticas de uso agregadas: usamos Cloudflare Web Analytics para conocer cuántas visitas recibe el sitio y cómo se comporta técnicamente. Según Cloudflare, esta herramienta no usa cookies ni almacenamiento local y no crea perfiles individuales; Cimbra solo ve cifras agregadas (visitas, páginas, país, tipo de dispositivo)." +
        (CON_UMAMI
          ? " También usamos Umami, una herramienta de medición sin cookies, para saber de dónde llegan las visitas (por ejemplo, un enlace de LinkedIn o una campaña), qué secciones se ven y en qué botones se hace clic (por ejemplo, «Ver ejemplo», «Descargar reporte» o abrir una pregunta frecuente). Esos registros nunca incluyen el contenido de tu presupuesto, el nombre del archivo, montos ni resultados del análisis."
          : ""),
      "Mensajes que nos envías: si escribes a " + CORREO_CONTACTO + ", tratamos tu dirección de correo, tu nombre si lo indicas y el contenido del mensaje. El correo se recibe a través de Cloudflare Email Routing y se gestiona en una cuenta de Google (Gmail).",
      "No pedimos registro, no recogemos datos de pago y no vendemos, alquilamos ni compartimos datos personales con fines publicitarios.",
    ],
  },
  {
    t: "4. Para qué los usamos",
    p: [
      "Para operar, mantener y proteger el sitio; para entender de forma agregada cómo se usa y mejorarlo; y para responder a tus mensajes. No tomamos decisiones automatizadas sobre ti ni usamos tus datos para publicidad.",
    ],
  },
  {
    t: "5. Proveedores y transferencias internacionales",
    p: [
      "Cloudflare, Inc. (alojamiento, seguridad, estadísticas y enrutamiento de correo), Google LLC (correo)" + (CON_UMAMI ? ", Umami (umami.is, estadísticas de navegación)" : "") + " actúan como proveedores de servicio y pueden procesar datos en Estados Unidos y en otros países. Cada uno aplica sus propias políticas de privacidad y medidas de seguridad. Si visitas el sitio desde fuera de Estados Unidos, entiendes que estos datos técnicos pueden procesarse allí.",
      "Solo revelaremos datos a terceros si la ley nos obliga o para defender nuestros derechos o la seguridad del servicio.",
    ],
  },
  {
    t: "6. Cuánto tiempo los conservamos",
    p: [
      "Los datos técnicos y estadísticos se conservan según los plazos de Cloudflare. Los correos se conservan mientras sean necesarios para atender tu consulta y por un máximo de 24 meses después del último intercambio, salvo que la ley exija conservarlos más tiempo o nos pidas borrarlos antes.",
    ],
  },
  {
    t: "7. Tus derechos",
    p: [
      "Puedes pedirnos acceso a los datos que tengamos sobre ti, su corrección, su eliminación, o oponerte a su uso, escribiendo a " + CORREO_CONTACTO + ". Responderemos en un plazo máximo de 30 días. Estos derechos se reconocen con independencia de tu país de residencia, sin perjuicio de los que te otorgue la ley local (por ejemplo, el habeas data en Venezuela o las leyes de protección de datos de tu país).",
      "Como no almacenamos tus presupuestos, no tenemos ninguno que entregar o borrar.",
    ],
  },
  {
    t: "8. Señales «Do Not Track»",
    p: [
      "Cimbra no rastrea a los visitantes a lo largo del tiempo ni entre sitios de terceros, por lo que no cambia su funcionamiento según la señal «Do Not Track» del navegador.",
    ],
  },
  {
    t: "9. Menores de edad",
    p: [
      "Cimbra es una herramienta profesional dirigida a personas mayores de 18 años y no está pensada para menores. No recogemos a sabiendas datos de menores; si crees que un menor nos envió datos, escríbenos y los eliminaremos.",
    ],
  },
  {
    t: "10. Seguridad",
    p: [
      "El sitio se sirve solo por conexión cifrada (HTTPS). Ningún sistema es completamente infalible, pero el diseño de Cimbra reduce el riesgo desde el origen: tu presupuesto nunca viaja por internet.",
    ],
  },
  {
    t: "11. Cambios en esta política",
    p: [
      "Si cambia la forma en que funciona el sitio (por ejemplo, si más adelante se crean cuentas de usuario o pagos), actualizaremos esta página antes de que el cambio entre en vigor e indicaremos la fecha de la última actualización arriba. Si el cambio es importante, lo destacaremos en el sitio.",
    ],
  },
];

const TERMINOS = [
  {
    t: "1. Aceptación",
    p: [
      "Estos términos regulan el uso de cimbrapro.com y de la herramienta Cimbra, un servicio operado por " + TITULAR + ". Al usar el sitio aceptas estos términos. Si no estás de acuerdo, no uses la herramienta.",
    ],
  },
  {
    t: "2. Qué es Cimbra",
    p: [
      "Cimbra es una herramienta de análisis que muestra en qué partidas de un presupuesto de construcción se concentra el valor económico y genera referencias iniciales de cronograma por fases, flujo de caja, prioridades de procura y un reporte ejecutivo. Actualmente se ofrece en fase de prueba y sin costo. Podemos introducir planes de pago en el futuro; en ese caso lo anunciaremos con anticipación y nunca se te cobrará sin tu aceptación expresa.",
    ],
  },
  {
    t: "3. Quién puede usarla",
    p: [
      "Debes ser mayor de 18 años y usar Cimbra con fines profesionales o comerciales. Si la usas en nombre de una empresa, declaras que tienes autorización para aceptar estos términos en su nombre.",
    ],
  },
  {
    t: "4. Tus archivos",
    p: [
      "Tu presupuesto sigue siendo tuyo. El archivo se procesa en tu navegador y Cimbra no lo recibe ni lo almacena. Eres responsable de tener derecho a analizar los archivos que cargas, incluida cualquier obligación de confidencialidad con tu cliente o empleador. Los reportes que descargues puedes usarlos libremente en tu trabajo.",
    ],
  },
  {
    t: "5. Uso permitido",
    p: [
      "Te damos una licencia personal, limitada, no exclusiva e intransferible para usar la herramienta. No está permitido: copiar, revender o redistribuir el software o el sitio; descompilarlo o aplicar ingeniería inversa salvo en lo que la ley permita expresamente; usar sistemas automatizados que sobrecarguen el servicio; intentar vulnerar su seguridad; ni usarlo para fines ilícitos.",
    ],
  },
  {
    t: "6. Propiedad intelectual",
    p: [
      "El software, el diseño, los textos, los logotipos y la marca Cimbra pertenecen a " + TITULAR + ". Microsoft Excel, Microsoft Project, Oracle Primavera y otros nombres de productos mencionados son marcas de sus respectivos titulares; se citan solo para describir compatibilidad o diferencias, sin que exista relación ni respaldo de esas empresas.",
    ],
  },
  {
    t: "7. Los resultados son referencias, no asesoría profesional",
    p: [
      "Los resultados son cálculos automáticos que dependen de los datos de tu archivo. Cimbra no afirma que un precio esté bien o mal cotizado, no promete ahorros y no sustituye el criterio de un profesional de la ingeniería, la construcción o las finanzas. El cronograma y el flujo de caja son estimaciones tempranas por fases, no una programación con dependencias ni ruta crítica. El presupuesto de ejemplo contiene datos ficticios.",
      "Antes de tomar decisiones de oferta, compra, contratación o financiamiento, verifica los resultados con tu propio análisis. Tú eres el único responsable de las decisiones que tomes.",
    ],
  },
  {
    t: "8. Exclusión de garantías",
    p: [
      "LA HERRAMIENTA SE OFRECE «TAL COMO ESTÁ» Y «SEGÚN DISPONIBILIDAD», SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUIDAS LAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN PARTICULAR, EXACTITUD Y NO INFRACCIÓN, EN LA MEDIDA MÁXIMA QUE PERMITA LA LEY. NO GARANTIZAMOS QUE ESTÉ LIBRE DE ERRORES NI DISPONIBLE DE FORMA ININTERRUMPIDA.",
    ],
  },
  {
    t: "9. Limitación de responsabilidad",
    p: [
      "EN LA MEDIDA MÁXIMA QUE PERMITA LA LEY, " + TITULAR.toUpperCase() + " NO SERÁ RESPONSABLE DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES O CONSECUENTES, NI DE PÉRDIDA DE CONTRATOS, LICITACIONES, GANANCIAS O DATOS, DERIVADOS DEL USO DE CIMBRA O DE SUS RESULTADOS. LA RESPONSABILIDAD TOTAL POR CUALQUIER RECLAMO NO EXCEDERÁ LA MAYOR DE ESTAS CANTIDADES: LO QUE HAYAS PAGADO POR EL SERVICIO EN LOS 12 MESES ANTERIORES O CIEN DÓLARES ESTADOUNIDENSES (US$100).",
      "Algunas jurisdicciones no permiten ciertas exclusiones; en ese caso se aplicarán en la medida permitida.",
    ],
  },
  {
    t: "10. Indemnidad",
    p: [
      "Te comprometes a mantener indemne a " + TITULAR + " frente a reclamos de terceros derivados de tu incumplimiento de estos términos o del uso de archivos sobre los que no tenías derecho.",
    ],
  },
  {
    t: "11. Cambios y suspensión",
    p: [
      "Podemos modificar, suspender o dejar de ofrecer la herramienta, total o parcialmente. Podemos actualizar estos términos; la versión vigente es la publicada en esta página con la fecha indicada arriba, y los cambios no se aplicarán retroactivamente.",
    ],
  },
  {
    t: "12. Ley aplicable y jurisdicción",
    p: [
      "Estos términos se rigen por las leyes de " + LEY_APLICABLE + ", sin considerar sus normas de conflicto de leyes. Cualquier controversia se someterá a " + TRIBUNALES + ", salvo que la ley de tu país te otorgue un derecho irrenunciable distinto.",
    ],
  },
  {
    t: "13. Disposiciones generales",
    p: [
      "Si alguna cláusula se considera inválida, las demás siguen vigentes. Que no exijamos el cumplimiento de una cláusula no significa que renunciemos a ella. Estos términos, junto con la Política de privacidad, forman el acuerdo completo sobre el uso de Cimbra. Si en el futuro se publica una versión en otro idioma, prevalecerá la versión en español.",
      "Contacto: " + CORREO_CONTACTO + ".",
    ],
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
