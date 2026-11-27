// Secuencia constructiva: ubica cada fase en su ventana típica dentro del plazo de la obra, según
// el tipo de trabajo que nombra (preliminares, estructura, instalaciones, acabados...). Así las
// instalaciones corren en paralelo con la obra gris y los acabados cierran la obra, en vez de
// encadenar los capítulos uno tras otro en el orden del presupuesto.
// Cada ventana es [inicio, fin] como fracción del plazo total (0 = arranque, 1 = entrega).

const sinAcentos = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Gana la palabra clave que aparece primero en el nombre (en español el sustantivo principal va
// delante: «Pisos en concreto» es piso, «Estructura de cubierta» es estructura). Las claves se
// buscan al comienzo de una palabra, para que «via» no aparezca dentro de «lluvias».
export const ETAPAS = [
  { etapa: "Administración y obras provisionales", ini: 0, fin: 1, claves: ["administracion", "personal profesional", "personal tecnico", "sst", "hse", "seguridad y salud", "ambiental", "señalizacion", "senalizacion", "vigilancia", "campamento", "plan de manejo"] },
  { etapa: "Cierre y entrega", ini: 0.92, fin: 1, claves: ["certificacion", "retie", "retilap", "aseo final", "limpieza final", "entrega", "planos record", "pruebas finales"] },
  { etapa: "Preliminares", ini: 0, fin: 0.1, claves: ["preliminar", "replanteo", "localizacion", "descapote", "desmonte", "cerramiento provisional", "demolicion", "desmantel", "limpieza del terreno"] },
  { etapa: "Movimiento de tierras", ini: 0.03, fin: 0.18, claves: ["excavacion", "movimiento de tierra", "relleno", "explanacion", "terraplen", "corte y retiro", "nivelacion del terreno"] },
  { etapa: "Cimentación", ini: 0.1, fin: 0.3, claves: ["cimenta", "cimiento", "fundacion", "zapata", "pilote", "pila", "viga de amarre", "losa de contrapiso", "contencion"] },
  { etapa: "Impermeabilizaciones", ini: 0.5, fin: 0.72, claves: ["impermeabiliz"] },
  { etapa: "Aparatos y equipos", ini: 0.72, fin: 1, claves: ["aparato", "griferia", "sanitarios y", "dotacion", "equipo", "ascensor", "mobiliario", "accesorio"] },
  { etapa: "Instalaciones hidrosanitarias", ini: 0.2, fin: 0.9, claves: ["hidrosanit", "hidraulic", "sanitari", "plomeria", "desague", "acueducto", "alcantarillado", "agua potable", "aguas lluvias", "aguas negras", "red de agua", "drenaje"] },
  { etapa: "Instalaciones eléctricas", ini: 0.3, fin: 0.9, claves: ["electric", "iluminacion", "alumbrado", "telecomunic", "voz y datos", "cableado", "subestacion", "planta electrica", "puesta a tierra", "apantallamiento"] },
  { etapa: "Instalaciones especiales", ini: 0.6, fin: 0.9, claves: ["gas", "incendio", "rci", "contra incendio", "aire acondicionado", "hvac", "ventilacion", "mecanic", "cctv", "deteccion"] },
  { etapa: "Estructura", ini: 0.12, fin: 0.6, claves: ["estructur", "estrcutur", "estuctur", "estrutur", "concreto", "columna", "viga", "losa", "placa", "acero de refuerzo", "metalic", "pantalla", "escalera", "mezzanine", "entrepiso"] },
  { etapa: "Cubierta", ini: 0.45, fin: 0.72, claves: ["cubierta", "techo", "teja", "canal", "bajante", "cercha"] },
  { etapa: "Mampostería", ini: 0.3, fin: 0.7, claves: ["mamposter", "muro", "bloque", "ladrillo", "tabique", "drywall", "superboard", "dintel", "alfajia"] },
  { etapa: "Cielos rasos", ini: 0.7, fin: 0.92, claves: ["cielo", "cielorraso", "falso techo"] },
  { etapa: "Pintura", ini: 0.78, fin: 1, claves: ["pintura", "estuco", "vinilo"] },
  { etapa: "Revoques y acabados de muros", ini: 0.6, fin: 0.9, claves: ["pañete", "panete", "revoque", "friso", "acabado", "enchape", "revestimiento", "graniplast"] },
  { etapa: "Pisos", ini: 0.62, fin: 0.92, claves: ["piso", "baldosa", "ceramica", "porcelanato", "guardaescoba", "mortero de nivelacion", "afinado", "alistado"] },
  { etapa: "Carpintería y cerrajería", ini: 0.75, fin: 1, claves: ["carpinter", "puerta", "ventana", "cerradura", "cerrajer", "vidrio", "espejo", "baranda", "pasamano", "division", "closet", "mueble", "aluminio"] },
  { etapa: "Obras exteriores", ini: 0.6, fin: 1, claves: ["exterior", "urbanismo", "paisajismo", "plazoleta", "anden", "via", "pavimento", "sardinel", "cerramiento", "zona verde", "jardin", "parqueadero", "cancha", "senderos", "redes externas", "empradizacion"] },
];

function primeraEtapa(t) {
  let mejor = null, posMejor = Infinity;
  for (const e of ETAPAS) {
    for (const k of e.claves) {
      const pos = t.indexOf(" " + sinAcentos(k));
      if (pos >= 0 && pos < posMejor) { mejor = e; posMejor = pos; }
    }
  }
  return mejor;
}

// Un capítulo que nombra dos trabajos unidos por «y», coma o guion («Cimentación y estructura»,
// «Instalaciones hidráulicas sanitarias y aparatos») ocupa la ventana de ambos, siempre que esas
// ventanas se toquen en la obra. Solo cuenta lo que va antes de una preposición: en «Andén en
// concreto» o «Excavación para zapatas», lo que sigue es un detalle, no otro trabajo. «Acabados»
// a secas es genérico: junto a un trabajo concreto («Cielo rasos - acabados») no cambia nada.
export function etapaDe(nombre) {
  const t = " " + sinAcentos(nombre).replace(/[–—]/g, "-") + " ";
  const corte = t.search(/ (en|de|del|para|con|sobre|tipo|segun|incluye) /);
  const cabeza = corte > 0 ? t.slice(0, corte + 1) : t;
  const limpio = (x) => " " + x.replace(/[^a-z0-9ñ]+/g, " ").trim() + " ";
  const segmentos = cabeza.split(/ y |,|;|\/| - |-/).map(limpio).filter((x) => x.trim());
  const porSegmento = segmentos
    .map((seg) => ({ e: primeraEtapa(seg), generico: /^ acabados? $/.test(seg) }))
    .filter((x) => x.e);
  const especificos = porSegmento.filter((x) => !x.generico);
  const usados = (especificos.length ? especificos : porSegmento).map((x) => x.e);
  if (!usados.length) return primeraEtapa(limpio(t));
  const principal = usados[0];
  let ini = principal.ini, fin = principal.fin;
  for (const e of usados.slice(1)) {
    if (e.ini <= fin + 0.05 && e.fin >= ini - 0.05) { ini = Math.min(ini, e.ini); fin = Math.max(fin, e.fin); }
  }
  return ini === principal.ini && fin === principal.fin ? principal : { ...principal, ini, fin };
}

// Devuelve, para cada fase (en el orden del presupuesto), su etapa y su ventana [ini, fin].
// Las fases que no se reconocen toman la ventana de la fase reconocida más cercana anterior
// (o la siguiente, si están al principio): el presupuesto suele seguir el orden de obra.
// Si lo reconocido no llega a `cobertura` del monto total, devuelve null y el cronograma
// sigue con el encadenamiento clásico.
export function ventanasConstructivas(fases, cobertura = 0.6) {
  if (!fases.length) return null;
  const etapas = fases.map((f) => etapaDe(f.name));
  const total = fases.reduce((s, f) => s + (f.monto || 0), 0);
  const reconocido = fases.reduce((s, f, i) => s + (etapas[i] ? f.monto || 0 : 0), 0);
  if (!total || reconocido / total < cobertura) return null;
  return fases.map((f, i) => {
    let e = etapas[i];
    let heredada = false;
    if (!e) {
      heredada = true;
      for (let j = i - 1; j >= 0 && !e; j--) e = etapas[j];
      for (let j = i + 1; j < fases.length && !e; j++) e = etapas[j];
    }
    return { etapa: e.etapa, ini: e.ini, fin: e.fin, heredada };
  });
}
