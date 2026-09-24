import { Fragment, useEffect, useState } from "react";
import { ComposedChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx-js-style";
import { MODULOS as M } from "./textos.js";
import { ganttXML, barrasYLineaXML, lineaXML, agregarGraficos } from "./excelGraficos.js";
import { FILAS_EJEMPLO } from "./ejemploPresupuesto.js";
import { registrarEvento } from "./medicion.js";
import { leerPresupuesto } from "./lectorPresupuesto.js";

let idCounter = 1;
const newId = () => idCounter++;

const initialPartidas = [];

// Formato numérico en español, igual que la landing ("5,3×", "$1.234.567"):
// coma decimal y punto de miles. Solo afecta lo que se ve en pantalla; los Excel
// exportados guardan números reales y Excel los muestra según la configuración regional del usuario.
const fmtNum = (n) => Math.round(n || 0).toLocaleString("de-DE");
const d1 = (n) => (Number.isFinite(n) ? n : 0).toFixed(1).replace(".", ",");
// Ejes de los gráficos: montos compactos ("1,2 M", "250 mil") y porcentajes enteros ("75%").
const ejeMonto = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",").replace(",0", "") + " M";
  if (a >= 1e3) return Math.round(v / 1e3) + " mil";
  return String(Math.round(v));
};
const ejePct = (v) => Math.round(v) + "%";

function truncar(s, n = 70) {
  const str = String(s || "");
  return str.length > n ? str.slice(0, n).trim() + "…" : str;
}

function resumirNombres(items, max, formatFn) {
  const fmtFn = formatFn || ((p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name));
  const mostrados = items.slice(0, max).map(fmtFn);
  const resto = items.length - max;
  return mostrados.join(" · ") + (resto > 0 ? " · y " + resto + " más" : "");
}

const claseInfo = {
  // Clase A en el ámbar de la marca (prioridad, no "error"); B en azul pizarra; C en gris.
  A: { color: "#8A5A0B", bg: "#FBEFD9", barra: "#C9922B", label: "Clase A — máximo impacto" },
  B: { color: "#2F4A60", bg: "#E3EBF2", barra: "#3A5A73", label: "Clase B — impacto medio" },
  C: { color: "#4B5563", bg: "#F3F4F6", barra: "#B8C0C8", label: "Clase C — impacto bajo" },
};

const fasePorClase = {
  A: "Máximo impacto en el presupuesto: valida precios con más de un proveedor, confirma disponibilidad de materiales y rendimientos de cuadrilla antes de cerrar el precio.",
  B: "Impacto medio: confirma el precio con tu proveedor habitual, sin necesidad de un análisis exhaustivo.",
  C: "Bajo impacto individual: usa el precio de referencia disponible sin invertir más tiempo en esta partida.",
};

// Solape por defecto: en una obra real los capítulos (o las partidas) casi nunca se ejecutan
// uno detrás de otro; el 30% refleja un encadenamiento habitual y el usuario puede cambiarlo.
const SOLAPE_POR_DEFECTO = 30;
const PERIODICIDAD_LABEL = { semanas: "semanal", meses: "mensual", "años": "anual" };

// Plazo provisional cuando el usuario todavía no ha escrito el suyo: así el Cronograma, el
// Flujo de Caja y las Prioridades de Procura existen desde que se carga el archivo, y el
// reporte en Excel sale completo. No pretende ser el plazo real: es un punto de partida.
function plazoProvisional(nFases, hayCapitulos) {
  const dias = hayCapitulos ? nFases * 30 : 180;
  return Math.min(1800, Math.max(90, Math.round(dias / 30) * 30));
}

const MOSTRAR_CRITICAL_ACTIVITIES = false;
const MOSTRAR_COST_ANALYSIS = false;

// Normaliza un texto para comparar descripciones: sin acentos, mayúsculas, sin signos.
function normalizar(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function encabezado(s, maxFallback = 55) {
  const str = String(s || "").trim();
  const corte = str.indexOf(".");
  if (corte > 5 && corte < 120) return str.slice(0, corte);
  return truncar(str, maxFallback);
}

function CostDriverTooltip({ active, payload, fmt }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 10px", fontSize: 12, maxWidth: 280, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      {p.codigo && <div style={{ color: "#6B7680", fontFamily: "monospace", fontSize: 11, marginBottom: 2 }}>{p.codigo}</div>}
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
      <div style={{ color: "#374151" }}>{fmt(p.monto)} · {d1(p.pctInd)}% individual · {d1(p.pctAcum)}% acumulado</div>
    </div>
  );
}

export default function AnalisisPareto() {
  const [partidas, setPartidas] = useState(initialPartidas);
  const [umbralA, setUmbralA] = useState(80);
  const [umbralB, setUmbralB] = useState(90);
  const [plazoUsuario, setPlazoTotal] = useState(null);
  const [unidadTiempo, setUnidadTiempo] = useState("meses");
  // Mientras el usuario no elija unidad, la plataforma la deduce del propio proyecto.
  const [unidadElegida, setUnidadElegida] = useState(false);
  const [inicioManual, setInicioManual] = useState({});
  const [duracionManual, setDuracionManual] = useState({});
  const [topN, setTopN] = useState("80");
  const [importError, setImportError] = useState("");
  const [importInfo, setImportInfo] = useState("");
  // Moneda detectada en el archivo ("Bs. ", "$"). Si el archivo no la indica, no se muestra ningún símbolo.
  const [moneda, setMoneda] = useState("");
  // Solape entre fases: % de la fase anterior que todavía queda por ejecutar cuando arranca la
  // siguiente. En obra las fases casi siempre se solapan, por eso el valor por defecto no es cero.
  const [solape, setSolape] = useState(SOLAPE_POR_DEFECTO);
  // Cuando el archivo trae líneas de ajuste (variación de precios, imprevistos), el usuario elige si entran al análisis.
  const [excluirAjustes, setExcluirAjustes] = useState(false);
  // Avisos de lectura del archivo: partidas sin monto y total declarado en el propio archivo.
  const [avisos, setAvisos] = useState({ sinMonto: 0, totalArchivo: null });
  const [esEjemplo, setEsEjemplo] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  // Las prioridades de procura se muestran resumidas; el usuario puede desplegar la lista completa.
  const [verTodaProcura, setVerTodaProcura] = useState(false);
  const fmt = (n) => moneda + fmtNum(n);

  const analizarBytes = (data) => {
    setImportError("");
    setImportInfo("");
    const res = leerPresupuesto(data);
    if (res.error) {
      setImportError(res.error);
      return;
    }
    const nuevas = res.partidas.map((p) => ({ ...p, id: newId() }));
    const { sinMonto, totalArchivo, totalImportado } = res;
    setAvisos({ sinMonto, totalArchivo });
    setExcluirAjustes(false);
    setSolape(SOLAPE_POR_DEFECTO);
    setMoneda(res.moneda);
    setPartidas(nuevas);
    setPlazoTotal(null);
    setInicioManual({});
    setDuracionManual({});
    const totalCategorias = new Set(nuevas.map((p) => p.categoria).filter(Boolean)).size;
    const ajustes = nuevas.filter((p) => p.esAjuste);
    setImportInfo(
      nuevas.length + " partidas importadas correctamente." +
      (totalArchivo !== null ? " La suma coincide con el total indicado en el archivo." : "") +
      (totalCategorias > 1 ? " Se detectaron " + totalCategorias + " capítulos propios del archivo y se usarán para agrupar el " + M.cronograma + "." : "") +
      (res.notas.length ? " " + res.notas.join(" ") : "") +
      (sinMonto ? " " + sinMonto + (sinMonto === 1 ? " partida del archivo no tiene monto y quedó fuera del análisis" : " partidas del archivo no tienen monto y quedaron fuera del análisis") + "; revisa si es una omisión del presupuesto." : "") +
      (ajustes.length
        ? " Atención: " + ajustes.length + (ajustes.length === 1 ? " línea parece un ajuste" : " líneas parecen ajustes") + " y no un trabajo de obra («" + ajustes.map((p) => truncar(p.name, 40)).join("», «") + "», " + d1((ajustes.reduce((s, p) => s + p.monto, 0) / totalImportado) * 100) + "% del total); se incluye en el análisis, revísala."
        : "") +
      (res.otrasHojas.length
        ? " El archivo tiene otras hojas con datos (" + res.otrasHojas.join(", ") + "); se analizó solo la hoja «" + res.hoja + "»."
        : (res.totalHojas > 1 && !res.hojaUsadaEsPrimera ? " Se analizó la hoja «" + res.hoja + "», que es la que contiene el presupuesto." : ""))
    );
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError("");
    setImportInfo("");
    setEsEjemplo(false);
    setNombreArchivo(file.name);
    // Medición: solo se registra que se cargó un archivo, nunca su nombre ni su contenido.
    registrarEvento("presupuesto_cargado");
    e.target.value = ""; // permite volver a elegir el mismo archivo
    const reader = new FileReader();
    reader.onload = (evt) => analizarBytes(new Uint8Array(evt.target.result));
    reader.readAsArrayBuffer(file);
  };

  // Presupuesto de ejemplo (sintético): se convierte en un Excel dentro del navegador y pasa por el mismo análisis.
  const libroDeEjemplo = () => {
    const ws = XLSX.utils.aoa_to_sheet(FILAS_EJEMPLO);
    ws["!cols"] = [{ wch: 9 }, { wch: 58 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
    return wb;
  };
  const usarEjemplo = () => {
    setNombreArchivo("presupuesto-de-ejemplo.xlsx");
    registrarEvento("ejemplo_cargado");
    const bytes = XLSX.write(libroDeEjemplo(), { type: "array", bookType: "xlsx" });
    analizarBytes(new Uint8Array(bytes));
    setPlazoTotal(360); // el ejemplo trae un plazo de 12 meses para que el cronograma y el flujo de caja se vean completos
    setEsEjemplo(true);
  };
  const descargarEjemplo = () => {
    registrarEvento("formato_ejemplo_descargado");
    XLSX.writeFile(libroDeEjemplo(), "cimbra-presupuesto-de-ejemplo.xlsx");
  };

  // La página principal puede pedir cargar el ejemplo (botón "Ver ejemplo" del encabezado).
  useEffect(() => {
    const alPedirEjemplo = () => {
      usarEjemplo();
      setTimeout(() => {
        const el = document.getElementById("herramienta");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };
    window.addEventListener("cimbra:ejemplo", alPedirEjemplo);
    return () => window.removeEventListener("cimbra:ejemplo", alPedirEjemplo);
  }, []);


  const lineasDeAjuste = partidas.filter((p) => p.esAjuste);
  const partidasActivas = excluirAjustes ? partidas.filter((p) => !p.esAjuste) : partidas;
  const total = partidasActivas.reduce((s, p) => s + p.monto, 0);

  const ordenadas = [...partidasActivas].sort((a, b) => b.monto - a.monto);
  let acumulado = 0;
  const conAcumulado = ordenadas.map((p, i) => {
    acumulado += p.monto;
    const pctInd = total ? (p.monto / total) * 100 : 0;
    const pctAcum = total ? (acumulado / total) * 100 : 0;
    return { ...p, rank: i + 1, pctInd, pctAcum };
  });
  // La clase A son las partidas necesarias para ALCANZAR el umbral (incluye la que lo cruza),
  // igual que en la Compresión de Revisión: así todos los conteos de la pantalla coinciden.
  const partidasHasta = (umbral) => {
    for (let i = 0; i < conAcumulado.length; i++) {
      if (conAcumulado[i].pctAcum >= umbral) return i + 1;
    }
    return conAcumulado.length;
  };
  const nClaseA = partidasHasta(umbralA);
  const nClaseB = Math.max(nClaseA, partidasHasta(umbralB));
  const analizadas = conAcumulado.map((p, i) => ({
    ...p,
    clase: i < nClaseA ? "A" : i < nClaseB ? "B" : "C",
    nombreCorto: (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 26),
  }));

  const porClase = { A: [], B: [], C: [] };
  analizadas.forEach((p) => porClase[p.clase].push(p));

  const n80 = partidasHasta(80);
  const n90 = partidasHasta(90);
  const pct80DePartidas = analizadas.length ? (n80 / analizadas.length) * 100 : 0;
  const reviewCompression = n80 > 0 ? analizadas.length / n80 : 0;

  // Hasta dónde vale la pena revisar: las partidas necesarias para alcanzar el umbral de clase A.
  const corteRevision = porClase.A.length;
  const partidasMostradas = topN === "todos" ? analizadas : analizadas.slice(0, topN === "90" ? n90 : n80);
  const pctCubierto = partidasMostradas.length ? partidasMostradas[partidasMostradas.length - 1].pctAcum : 0;

  // Familias: partidas que comparten el mismo código en el archivo (o, sin códigos, la misma
  // descripción). Una familia puede pesar mucho sin que ninguna de sus partidas destaque sola.
  const familiasMap = new Map();
  analizadas.forEach((p) => {
    const clave = p.codigo ? "cod:" + p.codigo.toUpperCase() : "des:" + normalizar(encabezado(p.name, 60));
    if (!familiasMap.has(clave)) {
      familiasMap.set(clave, { clave, etiqueta: p.codigo ? p.codigo : encabezado(p.name, 60), nombre: encabezado(p.name, 60), monto: 0, partidas: [] });
    }
    const f = familiasMap.get(clave);
    f.monto += p.monto;
    f.partidas.push(p);
  });
  const todasLasFamilias = [...familiasMap.values()]
    .filter((f) => f.partidas.length > 1)
    .map((f) => ({ ...f, pct: total ? (f.monto / total) * 100 : 0, mejorRank: Math.min(...f.partidas.map((p) => p.rank)) }))
    .sort((a, b) => b.monto - a.monto);
  // Una familia que pesa más que la mayor partida individual es justo lo que el ranking por partida no muestra.
  const familiaDestacada = todasLasFamilias.find((f) => analizadas.length && f.monto > analizadas[0].monto) || null;
  // Solo se muestran si aportan algo: o hay una familia que supera a la mayor partida, o alguna pesa 3% o más.
  const familias = familiaDestacada || (todasLasFamilias[0] && todasLasFamilias[0].pct >= 3) ? todasLasFamilias.filter((f) => f.pct >= 0.5) : [];

  const usaCategoriasReales = analizadas.some((p) => p.categoria);
  const categoriasUnicas = new Set(analizadas.map((p) => p.categoria).filter(Boolean)).size;
  const usarCapitulosParaSchedule = usaCategoriasReales && categoriasUnicas > 1;
  let fasesOrdenadas;
  if (usarCapitulosParaSchedule) {
    const fasesMap = {};
    const fasesAppearanceOrder = [];
    analizadas.forEach((p) => {
      const ph = p.categoria || "Sin categoría en el archivo";
      if (!fasesMap[ph]) {
        fasesMap[ph] = { key: "c:" + ph, name: ph, monto: 0, partidas: [] };
        fasesAppearanceOrder.push(ph);
      }
      fasesMap[ph].monto += p.monto;
      fasesMap[ph].partidas.push(p);
    });
    // Los capítulos se ordenan como aparecen en el archivo original (orden constructivo del
    // presupuesto), no por monto: el cronograma debe respetar la secuencia de obra.
    const primeraAparicion = (ph) => Math.min(...fasesMap[ph].partidas.map((p) => p.orden ?? 0));
    fasesOrdenadas = fasesAppearanceOrder.sort((x, y) => primeraAparicion(x) - primeraAparicion(y)).map((ph) => fasesMap[ph]);
  } else {
    // Sin capítulos reales, o con un único capítulo que abarca todo el presupuesto:
    // no tiene sentido agrupar, cada partida aparece en el cronograma con su propio peso económico,
    // en el mismo orden del archivo (que normalmente sigue la secuencia constructiva), no por monto.
    fasesOrdenadas = [...analizadas]
      .sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0))
      .map((p) => ({
        key: "p:" + p.id,
        name: (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 45),
        monto: p.monto,
        partidas: [p],
      }));
    // Partidas distintas con el mismo texto (p. ej. tuberías de varios diámetros): se numeran.
    const repetidos = {};
    fasesOrdenadas.forEach((f) => (repetidos[f.name] = (repetidos[f.name] || 0) + 1));
    const contados = {};
    fasesOrdenadas.forEach((f) => {
      if (repetidos[f.name] > 1) {
        contados[f.name] = (contados[f.name] || 0) + 1;
        f.name = f.name + " (" + contados[f.name] + "/" + repetidos[f.name] + ")";
      }
    });
  }
  // Plazo de trabajo: el que escribió el usuario o, mientras no escriba ninguno, uno provisional.
  // Así el cronograma, el flujo de caja y la procura funcionan apenas se carga el presupuesto.
  const plazoEsProvisional = plazoUsuario === null && analizadas.length > 0;
  const plazoTotal = plazoUsuario !== null ? plazoUsuario : (analizadas.length ? plazoProvisional(fasesOrdenadas.length, usarCapitulosParaSchedule) : null);

  // Duración mínima por fase: una semana, salvo que haya tantas fases que ni siquiera quepan;
  // así se evitan fases de "0,3 semanas" que ningún profesional puede ejecutar.
  const nFases = fasesOrdenadas.length || 1;
  const minDias = plazoTotal ? Math.min(7, plazoTotal / nFases) : 1;
  const factorSolape = 1 - solape / 100;
  let huboMinimo = false;
  // Duración proporcional al peso económico, con mínimo, y reescalada para que el conjunto
  // termine en el plazo indicado por el usuario (el solape acorta el calendario, no las fases).
  const duracionesBase = fasesOrdenadas.map((f) => {
    const pct = total ? f.monto / total : 0;
    const d = pct * (plazoTotal || 0);
    if (plazoTotal && d < minDias) huboMinimo = true;
    return Math.max(minDias, d);
  });
  let cursorProv = 0;
  const provisional = duracionesBase.map((d, i) => {
    const ini = cursorProv;
    cursorProv = ini + d * factorSolape;
    return { ini, d };
  });
  const spanProv = provisional.length ? provisional[provisional.length - 1].ini + provisional[provisional.length - 1].d : 0;
  const escala = plazoTotal && spanProv > 0 ? plazoTotal / spanProv : 1;

  let cursorDia = 0;
  const cronograma = fasesOrdenadas.map((f, i) => {
    const pct = total ? f.monto / total : 0;
    const diasAuto = Math.max(1, Math.round(duracionesBase[i] * escala));
    const esManualDuracion = duracionManual[f.key] !== undefined;
    const dias = esManualDuracion ? Math.max(1, duracionManual[f.key]) : diasAuto;
    const inicioAuto = Math.round(cursorDia);
    const esManualInicio = inicioManual[f.key] !== undefined;
    const inicio = esManualInicio ? inicioManual[f.key] : inicioAuto;
    cursorDia = inicio + dias * factorSolape;
    return { ...f, pct, dias, diasAuto, inicio, inicioAuto, esManualInicio, esManualDuracion, fin: inicio + dias };
  });
  const finDeObra = cronograma.length ? Math.max(...cronograma.map((f) => f.fin)) : 0;
  const domainMax = Math.max(plazoTotal, ...cronograma.map((f) => f.fin), 1);
  // El motor calcula siempre en días; las unidades solo cambian la presentación.
  // Mes = 30 días y año = 365 días, igual que en el Flujo de Caja.
  const DIAS_UNIDAD = { semanas: 7, meses: 30, "años": 365 };
  const NOMBRE_UNIDAD = { semanas: "semanas", meses: "meses", "años": "años" };
  const UNIDAD_SINGULAR = { semanas: "semana", meses: "mes", "años": "año" };
  const ABREV_UNIDAD = { semanas: "sem.", meses: "meses", "años": "años" };
  // La unidad del cronograma la manda el proyecto: una obra de 6 meses se lee en semanas,
  // una de 3 años en meses, y una de una década en años. Si las fases son muy cortas para
  // la unidad, se baja un escalón para que ninguna barra quede en "0,3".
  const unidadSugerida = (dias, nF) => {
    if (!dias) return "meses";
    const promedio = dias / Math.max(1, nF);
    if (dias <= 182 || promedio < 30) return "semanas";
    if (dias <= 1460 || promedio < 120) return "meses";
    return "años";
  };
  // La unidad la elige el usuario sin restricciones: hay proyectos de semanas, de meses y de años.
  const unidadAuto = unidadSugerida(plazoTotal, fasesOrdenadas.length);
  const unidadEfectiva = unidadElegida ? unidadTiempo : unidadAuto;
  const diasPorUnidad = DIAS_UNIDAD[unidadEfectiva];
  const unidadLabel = NOMBRE_UNIDAD[unidadEfectiva];
  const unidadAbrev = ABREV_UNIDAD[unidadEfectiva];
  const aUnidad = (dias) => Math.round((dias / diasPorUnidad) * 10) / 10;
  const aDias = (valorUnidad) => Math.round(valorUnidad * diasPorUnidad);
  // La edición de cada fase usa la misma unidad que el resto del cronograma.
  const aUnidadEd = (dias) => Math.round((dias / diasPorUnidad) * 10) / 10;
  const unidadEdADias = (v) => Math.round(v * diasPorUnidad);
  const numeroDeMomento = (dia) => Math.floor(dia / diasPorUnidad) + 1;
  const momentoDeDia = (dia) => UNIDAD_SINGULAR[unidadEfectiva] + " " + numeroDeMomento(dia);
  // "desde la semana 3", "desde el mes 1", "desde el año 2"
  const desdeMomento = (dia) => (unidadEfectiva === "semanas" ? "la " : "el ") + momentoDeDia(dia);
  const plazoTexto = (dias) => aUnidad(dias).toLocaleString("es") + " " + unidadLabel;
  const cronogramaDisplay = cronograma.map((f) => ({ ...f, inicio: aUnidad(f.inicio), dias: aUnidad(f.dias) }));

  function calcularFlujo(periodDays, label) {
    const n = Math.max(1, Math.ceil(plazoTotal / periodDays));
    const filas = [];
    let acum = 0;
    for (let i = 0; i < n; i++) {
      const pStart = i * periodDays;
      const pEnd = Math.min(plazoTotal, (i + 1) * periodDays);
      let montoPeriodo = 0;
      cronograma.forEach((f) => {
        const dailyRate = f.dias > 0 ? f.monto / f.dias : 0;
        const overlap = Math.max(0, Math.min(f.fin, pEnd) - Math.max(f.inicio, pStart));
        montoPeriodo += overlap * dailyRate;
      });
      acum += montoPeriodo;
      filas.push({ periodo: label + " " + (i + 1), monto: montoPeriodo, pctAcum: total ? Math.min(100, (acum / total) * 100) : 0 });
    }
    return filas;
  }

  // El flujo de caja usa SIEMPRE la misma unidad que el Cronograma de Obra: si el cronograma se
  // lee en semanas, el flujo es semanal; si es en meses, mensual; si es en años, anual.
  const periodDays = diasPorUnidad;
  const periodLabel = UNIDAD_SINGULAR[unidadEfectiva].charAt(0).toUpperCase() + UNIDAD_SINGULAR[unidadEfectiva].slice(1);
  const flujoCaja = calcularFlujo(periodDays, periodLabel);
  const numPeriodos = flujoCaja.length;

  const costoPorFase = [...cronograma].sort((a, b) => b.monto - a.monto);

  const faseInicioMap = {};
  const faseNombreMap = {};
  cronograma.forEach((f) => { faseInicioMap[f.key] = f.inicio; faseNombreMap[f.key] = f.name; });

  const analizadasConFase = analizadas.map((p) => {
    const faseKey = usarCapitulosParaSchedule ? "c:" + (p.categoria || "Sin categoría en el archivo") : "p:" + p.id;
    const fase = faseNombreMap[faseKey] ?? "";
    const inicioFase = faseInicioMap[faseKey] ?? 0;
    const urgencia = plazoTotal ? 1 - inicioFase / plazoTotal : 0;
    const criticidad = p.pctInd * 0.7 + urgencia * 100 * 0.3;
    return { ...p, fase, inicioFase, criticidad };
  });

  const actividadesCriticas = [...analizadasConFase].sort((a, b) => b.criticidad - a.criticidad).slice(0, 5);

  const prioridadesCompra = analizadasConFase
    .filter((p) => p.clase === "A" || p.clase === "B")
    .sort((a, b) => a.inicioFase - b.inicioFase);

  const picoFlujo = flujoCaja.length ? flujoCaja.reduce((max, f) => (f.monto > max.monto ? f : max), flujoCaja[0]) : null;

  const hayPlazo = plazoTotal !== null && plazoTotal > 0;
  const primeraClaseA = analizadas.find((p) => p.clase === "A");

  // Texto del Reporte Ejecutivo: el mismo en pantalla y en el Excel.
  const textoEjecutivo = [
    "El presupuesto analizado asciende a " + fmt(total) + ", distribuido en " + analizadas.length + " partidas y " + cronograma.length + " fases constructivas" + (hayPlazo ? ", con un plazo estimado de " + plazoTexto(plazoTotal) : " (plazo aún no definido en " + M.cronograma + ")") + ".",
    "Este presupuesto tiene una " + M.compresionRevision + " de " + d1(reviewCompression) + "×: " + n80 + " partidas (" + pct80DePartidas.toFixed(0) + "%) explican el 80% del valor total.",
    porClase.A.length + " partidas de clase A concentran la mayor parte del impacto financiero y deben revisarse con prioridad" + (primeraClaseA ? ", siendo \"" + encabezado(primeraClaseA.name, 60) + "\" la de mayor peso individual." : "."),
    hayPlazo && picoFlujo ? "El período de mayor exigencia de flujo de caja es " + picoFlujo.periodo + ", con un desembolso estimado de " + fmt(picoFlujo.monto) + "." : null,
    hayPlazo && prioridadesCompra.length > 0 ? "La primera compra o contratación a gestionar es \"" + encabezado(prioridadesCompra[0].name, 60) + "\", requerida desde " + desdeMomento(prioridadesCompra[0].inicioFase) + "." : null,
  ].filter(Boolean).join(" ");

  const NAVY = "1C2B39";
  const AMBAR = "C9922B";
  const borde = { style: "thin", color: { rgb: "D1D5DB" } };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde };
  const estiloEncabezado = {
    font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
    fill: { patternType: "solid", fgColor: { rgb: NAVY } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bordes,
  };
  const estiloClase = {
    A: { font: { bold: true, color: { rgb: "8A5A0B" } }, fill: { patternType: "solid", fgColor: { rgb: "FBEFD9" } } },
    B: { font: { bold: true, color: { rgb: "2F4A60" } }, fill: { patternType: "solid", fgColor: { rgb: "E3EBF2" } } },
    C: { font: { bold: true, color: { rgb: "4B5563" } }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } },
  };
  const FMT_MONTO = moneda ? '"' + moneda + '"#,##0' : "#,##0";
  const FMT_PCT = "0.0%";

  const estilar = (ws, r, c, extra) => {
    const a = XLSX.utils.encode_cell({ r, c });
    if (!ws[a]) return;
    ws[a].s = { ...(ws[a].s || {}), ...extra };
  };

  // Hoja de tabla: encabezado de marca, anchos, formatos numéricos y filtro.
  // `formatos` asigna un formato de número por índice de columna.
  const hojaTabla = (encabezados, filas, anchos, formatos = {}, colClase = -1) => {
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    ws["!cols"] = anchos.map((wch) => ({ wch }));
    ws["!rows"] = [{ hpt: 30 }];
    encabezados.forEach((_, c) => estilar(ws, 0, c, estiloEncabezado));
    filas.forEach((fila, i) => {
      fila.forEach((valor, c) => {
        const a = XLSX.utils.encode_cell({ r: i + 1, c });
        if (!ws[a]) return;
        if (formatos[c]) ws[a].z = formatos[c];
        if (c === 0 && typeof valor === "number") ws[a].s = { alignment: { horizontal: "center" } };
        if (c === colClase && estiloClase[valor]) {
          ws[a].s = { ...estiloClase[valor], alignment: { horizontal: "center" } };
        }
      });
    });
    if (filas.length) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) };
    }
    return ws;
  };

  // Un texto de celda no puede pasar de 32.767 caracteres: se resume la lista de partidas por fase.
  const listaPartidas = (partidas) => resumirNombres(partidas, 25, (p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 60));

  const colLetra = (i) => XLSX.utils.encode_col(i);

  const handleExport = () => {
    registrarEvento(esEjemplo ? "reporte_excel_descargado_ejemplo" : "reporte_excel_descargado");
    const fecha = new Date().toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });
    const wb = XLSX.utils.book_new();
    const graficos = [];
    // Hojas largas en las que conviene dejar fijo el encabezado al desplazarse.
    const hojasCongeladas = [M.costDrivers, M.cronograma, M.procura];

    // --- Hoja 1: Resumen (con el gráfico de las partidas de mayor peso) ---
    const filasResumen = [];
    const fila = (...celdas) => { filasResumen.push(celdas); return filasResumen.length - 1; };
    const rTitulo = fila("Cimbra — Inteligencia de costos");
    const rSubtitulo = fila("Reporte de análisis de presupuesto · " + fecha);
    fila();
    const rDatos1 = fila("Total analizado (suma de las partidas, sin IVA)", total);
    fila("Partidas con valor", analizadas.length);
    fila(M.compresionRevision, Number(reviewCompression.toFixed(2)));
    const rPct80 = fila("Partidas que concentran el 80% del valor", n80, analizadas.length ? n80 / analizadas.length : 0);
    const rPct90 = fila("Partidas que concentran el 90% del valor", n90, analizadas.length ? n90 / analizadas.length : 0);
    fila("Umbral clase A / clase B", umbralA + "% / " + umbralB + "%");
    fila("Partidas clase A", porClase.A.length);
    const rDatos2 = fila("Plazo total estimado", hayPlazo ? plazoTexto(plazoTotal) + (plazoEsProvisional ? " (provisional)" : "") : "No definido");
    fila();
    const rTitEjec = fila(M.reporteEjecutivo);
    const rTextoEjec = fila(textoEjecutivo);
    fila();
    const rTitLeer = fila("Cómo leer este reporte");
    const parrafos = [
      "Cimbra te dice DÓNDE mirar: las partidas de clase A concentran el mayor valor económico y merecen tu revisión primero. Tu software de estimación te permite decidir CÓMO cambiarlo. El criterio final sobre precios, alcance y compras es siempre del profesional.",
      "El total analizado es la suma de las partidas importadas: no incluye IVA ni otros montos que el archivo sume aparte." +
        (avisos.totalArchivo !== null ? " Coincide con el total indicado en el archivo de origen." : ""),
      "El cronograma es una aproximación por fases proporcional al peso económico; no es un cronograma de ruta crítica (CPM): no incluye dependencias entre actividades.",
    ];
    if (huboMinimo && hayPlazo) parrafos.push("Las fases de menor peso recibieron una duración mínima para que el cronograma sea ejecutable; el conjunto se ajusta al plazo indicado.");
    if (solape > 0 && hayPlazo) parrafos.push("El cronograma se calculó con las fases solapadas: cada una arranca cuando la anterior lleva " + (100 - solape) + "% de avance.");
    if (plazoEsProvisional) parrafos.push("El plazo de " + plazoTexto(plazoTotal) + " es provisional: Cimbra no puede deducir la duración real de la obra. Escribe el plazo de tu proyecto en " + M.cronograma + " y vuelve a descargar el reporte para que el cronograma, el " + M.flujoCaja + " y las " + M.procura + " reflejen tus tiempos.");
    if (avisos.sinMonto) parrafos.push(avisos.sinMonto + (avisos.sinMonto === 1 ? " partida del archivo no tiene monto y quedó fuera del análisis." : " partidas del archivo no tienen monto y quedaron fuera del análisis.") + " Revisa si es una omisión del presupuesto.");
    if (excluirAjustes && lineasDeAjuste.length) parrafos.push("Se excluyeron " + lineasDeAjuste.length + " líneas de ajuste (variación de precios, imprevistos u similares) a pedido del usuario.");
    if (!hayPlazo) parrafos.push("Este reporte se descargó sin plazo total, por lo que no incluye Cronograma de Obra, Flujo de Caja ni Curva de Avance. Define el plazo en el módulo " + M.cronograma + " y vuelve a descargar para incluirlos.");
    const rParrafos = parrafos.map((t) => fila(t));

    // Bloque de datos que alimenta el gráfico del Resumen.
    const topGrafico = analizadas.slice(0, 15);
    let rTitGrafico = null;
    let rDatoGrafico1 = null;
    if (topGrafico.length >= 3) {
      fila();
      rTitGrafico = fila("Las " + topGrafico.length + " partidas de mayor peso");
      rDatoGrafico1 = fila("Partida", "Monto", "% acumulado", "Descripción") + 1;
      // La etiqueta del gráfico va corta para que se lea; la descripción completa queda al lado.
      topGrafico.forEach((p) => fila(p.codigo ? p.codigo : "#" + p.rank, p.monto, p.pctAcum / 100, encabezado(p.name, 70)));
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(filasResumen);
    wsResumen["!cols"] = [{ wch: 46 }, { wch: 18 }, { wch: 14 }, { wch: 52 }];
    wsResumen["!merges"] = [];
    wsResumen["!rows"] = [];
    estilar(wsResumen, rTitulo, 0, { font: { bold: true, sz: 16, color: { rgb: NAVY }, name: "Arial" } });
    estilar(wsResumen, rSubtitulo, 0, { font: { italic: true, sz: 10, color: { rgb: "6B7680" }, name: "Arial" } });
    for (let r = rDatos1; r <= rDatos2; r++) {
      estilar(wsResumen, r, 0, { font: { bold: true, color: { rgb: NAVY } }, border: bordes });
      estilar(wsResumen, r, 1, { alignment: { horizontal: "right" }, border: bordes });
    }
    wsResumen[XLSX.utils.encode_cell({ r: rDatos1, c: 1 })].z = FMT_MONTO;
    wsResumen[XLSX.utils.encode_cell({ r: rDatos1 + 2, c: 1 })].z = '0.0"×"';
    [rPct80, rPct90].forEach((r) => {
      wsResumen[XLSX.utils.encode_cell({ r, c: 2 })].z = "0%";
      estilar(wsResumen, r, 2, { alignment: { horizontal: "right" }, border: bordes });
    });
    [rTitEjec, rTitLeer].concat(rTitGrafico === null ? [] : [rTitGrafico]).forEach((r) =>
      estilar(wsResumen, r, 0, { font: { bold: true, sz: 12, color: { rgb: AMBAR } }, border: { bottom: { style: "medium", color: { rgb: AMBAR } } } })
    );
    [rTextoEjec].concat(rParrafos).forEach((r) => {
      wsResumen["!merges"].push({ s: { r, c: 0 }, e: { r, c: 2 } });
      estilar(wsResumen, r, 0, { alignment: { wrapText: true, vertical: "top" }, font: { name: "Arial", sz: 10 } });
      const texto = String(filasResumen[r][0] || "");
      wsResumen["!rows"][r] = { hpt: Math.max(16, Math.ceil(texto.length / 95) * 15) };
    });
    if (rDatoGrafico1 !== null) {
      [0, 1, 2, 3].forEach((c) => estilar(wsResumen, rDatoGrafico1 - 1, c, estiloEncabezado));
      for (let i = 0; i < topGrafico.length; i++) {
        wsResumen[XLSX.utils.encode_cell({ r: rDatoGrafico1 + i, c: 1 })].z = FMT_MONTO;
        wsResumen[XLSX.utils.encode_cell({ r: rDatoGrafico1 + i, c: 2 })].z = FMT_PCT;
      }
      graficos.push({
        hoja: "Resumen",
        xml: barrasYLineaXML({
          hoja: "Resumen", colCat: "A", colBarra: "B", colLinea: "C",
          fila1: rDatoGrafico1 + 1, filaN: rDatoGrafico1 + topGrafico.length,
          filaNombre: rDatoGrafico1,
          titulo: "Partidas de mayor peso y valor acumulado",
          formatoBarra: FMT_MONTO, tituloEjeIzq: "Monto de la partida", tituloEjeDer: "% acumulado del presupuesto",
        }),
        col1: 5, fila1: rDatoGrafico1 - 1, col2: 16, fila2: rDatoGrafico1 + 21,
      });
    }
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // --- Hoja 2: Cost Drivers ---
    const conCodigo = analizadas.some((p) => p.codigo);
    const encCD = ["Posición"].concat(conCodigo ? ["Código"] : [], ["Partida"], usarCapitulosParaSchedule ? ["Capítulo"] : [], ["Monto", "% Individual", "% Acumulado", "Clase"]);
    const filasCD = analizadas.map((p) =>
      [p.rank].concat(conCodigo ? [p.codigo || ""] : [], [p.name], usarCapitulosParaSchedule ? [p.categoria || ""] : [], [p.monto, p.pctInd / 100, p.pctAcum / 100, p.clase])
    );
    const iMonto = encCD.indexOf("Monto");
    const anchosCD = encCD.map((h) => ({ "Posición": 9, "Código": 14, Partida: 60, "Capítulo": 26, Monto: 16, "% Individual": 13, "% Acumulado": 13, Clase: 8 }[h]));
    const wsCD = hojaTabla(encCD, filasCD, anchosCD, { [iMonto]: FMT_MONTO, [iMonto + 1]: FMT_PCT, [iMonto + 2]: FMT_PCT }, iMonto + 3);
    // Línea de corte: dónde termina la revisión que vale la pena.
    if (corteRevision > 0 && corteRevision < filasCD.length) {
      const rCorte = corteRevision + 1; // fila (0-based) de la primera partida que ya NO es prioritaria
      const bordeCorte = { style: "medium", color: { rgb: AMBAR } };
      encCD.forEach((_, c) => estilar(wsCD, rCorte, c, { border: { top: bordeCorte } }));
      const aviso = XLSX.utils.encode_cell({ r: rCorte, c: encCD.length + 1 });
      wsCD[aviso] = {
        t: "s",
        v: "◀ Línea de corte: las " + corteRevision + " partidas de arriba concentran el " + (porClase.A.length ? porClase.A[porClase.A.length - 1].pctAcum.toFixed(0) : 0) + "% del valor. De aquí hacia abajo el impacto individual es bajo.",
        s: { font: { bold: true, color: { rgb: AMBAR }, sz: 10 }, alignment: { vertical: "center" } },
      };
      const rango = XLSX.utils.decode_range(wsCD["!ref"]);
      rango.e.c = Math.max(rango.e.c, encCD.length + 1);
      wsCD["!ref"] = XLSX.utils.encode_range(rango);
      wsCD["!cols"][encCD.length] = { wch: 3 };
      wsCD["!cols"][encCD.length + 1] = { wch: 90 };
    }
    XLSX.utils.book_append_sheet(wb, wsCD, M.costDrivers);

    // --- Familias de partidas (mismo código o misma descripción) ---
    if (familias.length) {
      const filasFam = familias.slice(0, 200).map((f, i) => [
        i + 1, f.etiqueta, f.partidas.length, f.monto, f.pct / 100, f.mejorRank, listaPartidas(f.partidas),
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["#", "Familia (código o descripción)", "Partidas", "Monto total", "% del presupuesto", "Mejor posición individual", "Partidas incluidas"],
          filasFam, [6, 40, 10, 16, 16, 20, 70], { 3: FMT_MONTO, 4: FMT_PCT }),
        "Familias de Partidas"
      );
    }

    // --- Cronograma, Flujo de Caja y Curva de Avance: solo con plazo definido ---
    if (hayPlazo) {
      // El cronograma se exporta VIVO: la columna de inicio y la de fin son fórmulas, de modo que
      // al cambiar la duración de una fase en Excel, las siguientes se desplazan y el diagrama de
      // Gantt se redibuja solo, sin tener que volver a Cimbra.
      const filasCrono = cronograma.map((f) => [
        f.name, aUnidadEd(f.inicio), aUnidadEd(f.dias), aUnidadEd(f.fin), f.monto, f.pct, listaPartidas(f.partidas),
      ]);
      const wsCrono = hojaTabla(
        ["Fase", "Inicio (" + unidadAbrev + ")", "Duración (" + unidadAbrev + ")", "Fin (" + unidadAbrev + ")", "Monto", "% del presupuesto", "Partidas incluidas"],
        filasCrono, [40, 14, 16, 13, 16, 16, 70], { 4: FMT_MONTO, 5: FMT_PCT }
      );
      const factorTxt = String(Math.round(factorSolape * 1000) / 1000);
      filasCrono.forEach((filaCrono, i) => {
        const r = i + 2; // fila de Excel (1 es el encabezado)
        if (i > 0) {
          wsCrono[XLSX.utils.encode_cell({ r: r - 1, c: 1 })] = {
            t: "n", f: "B" + (r - 1) + "+C" + (r - 1) + "*" + factorTxt, v: filaCrono[1],
            s: { alignment: { horizontal: "right" } },
          };
        }
        wsCrono[XLSX.utils.encode_cell({ r: r - 1, c: 3 })] = {
          t: "n", f: "B" + r + "+C" + r, v: filaCrono[3],
          s: { alignment: { horizontal: "right" } },
        };
        // La duración es la celda que el profesional edita: se resalta para que se note.
        estilar(wsCrono, r - 1, 2, { fill: { patternType: "solid", fgColor: { rgb: "FFF7E6" } }, font: { color: { rgb: NAVY } } });
      });
      // Bajo la tabla: fin de obra calculado y la instrucción de uso.
      const rFin = filasCrono.length + 2;
      wsCrono[XLSX.utils.encode_cell({ r: rFin, c: 0 })] = { t: "s", v: "Fin estimado de la obra (" + unidadAbrev + ")", s: { font: { bold: true, color: { rgb: NAVY } } } };
      wsCrono[XLSX.utils.encode_cell({ r: rFin, c: 3 })] = { t: "n", f: "MAX(D2:D" + (filasCrono.length + 1) + ")", v: aUnidadEd(Math.max(...cronograma.map((f) => f.fin))), s: { font: { bold: true }, alignment: { horizontal: "right" } } };
      wsCrono[XLSX.utils.encode_cell({ r: rFin + 2, c: 0 })] = { t: "s", v: "Edita la columna «Duración» (celdas en ámbar) y el inicio de las fases siguientes, el fin de obra y el diagrama de Gantt se recalculan solos." + (solape > 0 ? " El cálculo mantiene el solape de " + solape + "% entre fases que indicaste." : ""), s: { font: { italic: true, sz: 10, color: { rgb: "6B7680" } }, alignment: { wrapText: true, vertical: "top" } } };
      wsCrono["!merges"] = [{ s: { r: rFin + 2, c: 0 }, e: { r: rFin + 2, c: 6 } }];
      wsCrono["!rows"] = wsCrono["!rows"] || [];
      wsCrono["!rows"][rFin + 2] = { hpt: 30 };
      wsCrono["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rFin + 2, c: 6 } });
      XLSX.utils.book_append_sheet(wb, wsCrono, M.cronograma);
      const nGantt = Math.min(filasCrono.length, 60);
      if (nGantt >= 1) {
        graficos.push({
          hoja: M.cronograma,
          xml: ganttXML({
            hoja: M.cronograma, colCat: "A", colInicio: "B", colDuracion: "C",
            fila1: 2, filaN: nGantt + 1,
            titulo: "Cronograma de obra por fases" + (nGantt < filasCrono.length ? " (primeras " + nGantt + ")" : ""),
            tituloEjeX: unidadLabel.charAt(0).toUpperCase() + unidadLabel.slice(1) + " desde el inicio de la obra",
          }),
          col1: 7, fila1: 0, col2: 20, fila2: Math.max(18, nGantt + 4),
        });
      }

      const flujoSemanal = calcularFlujo(7, "Semana");
      const flujoMensual = calcularFlujo(30, "Mes");
      const flujoAnual = calcularFlujo(365, "Año");
      [
        ["Flujo de Caja Semanal", flujoSemanal],
        ["Flujo de Caja Mensual", flujoMensual],
        ["Flujo de Caja Anual", flujoAnual],
      ].forEach(([nombreHoja, filas]) => {
        let acum = 0;
        const datos = filas.map((f) => { acum += f.monto; return [f.periodo, Math.round(f.monto), Math.round(acum), f.pctAcum / 100]; });
        XLSX.utils.book_append_sheet(
          wb,
          hojaTabla(["Periodo", "Flujo del período", "Flujo acumulado", "% Acumulado"], datos, [14, 18, 18, 14], { 1: FMT_MONTO, 2: FMT_MONTO, 3: FMT_PCT }),
          nombreHoja
        );
        if (datos.length >= 2) {
          graficos.push({
            hoja: nombreHoja,
            xml: barrasYLineaXML({
              hoja: nombreHoja, colCat: "A", colBarra: "B", colLinea: "D",
              fila1: 2, filaN: datos.length + 1,
              titulo: nombreHoja, formatoBarra: FMT_MONTO,
              tituloEjeIzq: "Flujo del período", tituloEjeDer: "% acumulado",
            }),
            col1: 5, fila1: 0, col2: 17, fila2: 22,
          });
        }
      });

      const curva = flujoMensual.map((f) => [f.periodo, f.pctAcum / 100]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["Periodo (mensual)", "% Avance financiero acumulado"], curva, [18, 30], { 1: FMT_PCT }),
        "Curva de Avance"
      );
      if (curva.length >= 2) {
        graficos.push({
          hoja: "Curva de Avance",
          xml: lineaXML({
            hoja: "Curva de Avance", colCat: "A", colLinea: "B",
            fila1: 2, filaN: curva.length + 1,
            titulo: "Curva de avance financiero acumulado", tituloEjeIzq: "% del presupuesto ejecutado",
          }),
          col1: 3, fila1: 0, col2: 15, fila2: 22,
        });
      }
    }

    // --- Prioridades de Procura ---
    const filasCompra = prioridadesCompra.map((p, i) => [
      i + 1, p.codigo || "", p.name, hayPlazo ? numeroDeMomento(p.inicioFase) : "Plazo no definido", p.fase, p.clase, p.monto, p.pctInd / 100,
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      hojaTabla(["Prioridad", "Código", "Partida", "Requerida en (" + unidadAbrev + ")", "Fase", "Clase", "Monto", "% Individual"],
        filasCompra, [10, 14, 60, 18, 32, 8, 16, 13], { 6: FMT_MONTO, 7: FMT_PCT }, 5),
      M.procura
    );

    // Actividades Críticas está en pausa: no se exporta mientras el módulo no aporte información propia.
    if (MOSTRAR_CRITICAL_ACTIVITIES) {
      const criticaRows = actividadesCriticas.map((p, i) => [i + 1, p.name, p.pctInd / 100, p.fase, p.inicioFase]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["Prioridad", "Partida", "% del presupuesto", "Fase", "Día de inicio"], criticaRows, [10, 40, 16, 32, 12], { 2: FMT_PCT }),
        M.actividadesCriticas
      );
    }

    const nombreArchivo = "cimbra-reporte-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    try {
      const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const conGraficos = agregarGraficos(bytes, graficos, hojasCongeladas);
      const blob = new Blob([conGraficos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    } catch (err) {
      // Si algo falla al incrustar los gráficos, el reporte se descarga igual, solo que sin ellos.
      XLSX.writeFile(wb, nombreArchivo);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white text-gray-900 font-sans text-sm">
      <h1 className="text-lg font-semibold mb-1">Analiza tu presupuesto</h1>
      <p className="text-xs text-gray-500 mb-4">Herramienta complementaria de análisis para toma de decisiones — no reemplaza a Project, Primavera ni al software de presupuesto que ya usas.</p>

      {total > 0 && (
        <p className="text-sm bg-blue-50 text-blue-900 rounded p-3 mb-4">
          {porClase.A.length} de {analizadas.length} partidas ({((porClase.A.length / analizadas.length) * 100).toFixed(0)}% del total de partidas) concentran el {porClase.A.length ? porClase.A[porClase.A.length - 1].pctAcum.toFixed(0) : 0}% del valor del presupuesto. Enfoca ahí tu revisión antes de decidir.
        </p>
      )}

      <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <label className="text-xs text-gray-500 block mb-1">Importar presupuesto de construcción (Excel, .xls o .csv)</label>
        {/* Selector de archivo propio: el control nativo del navegador sale en inglés ("Choose File"). */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center cursor-pointer rounded px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
            style={{ background: "#1C2B39" }}>
            Seleccionar archivo
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="sr-only" />
          </label>
          <span className="text-xs text-gray-500 truncate max-w-full">{nombreArchivo || "Ningún archivo seleccionado"}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Tu archivo se procesa en tu navegador y no se envía a ningún servidor.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
          <button type="button" onClick={usarEjemplo} className="font-medium rounded border px-3 py-1 hover:bg-white" style={{ borderColor: "#C9922B", color: "#1C2B39" }}>
            No tengo un archivo ahora — usar presupuesto de ejemplo
          </button>
          <button type="button" onClick={descargarEjemplo} className="underline text-gray-500 hover:text-gray-800">
            Descargar el archivo de ejemplo (para ver el formato)
          </button>
        </div>
        {esEjemplo && (
          <p className="text-xs mt-2 rounded p-2" style={{ background: "#FFF7E6", color: "#7A5A12" }}>
            Estás viendo un <strong>presupuesto de ejemplo con datos ficticios</strong> (edificio residencial de 4 niveles, plazo de 12 meses). No corresponde a ninguna obra ni empresa real. Sube tu propio archivo para analizar tu proyecto.
          </p>
        )}
        {importError && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{importError}</p>}
        {importInfo && <p className="text-xs mt-1" style={{ color: "#166534" }}>{importInfo}</p>}
        {lineasDeAjuste.length > 0 && (
          <label className="flex items-start gap-2 text-xs text-gray-600 mt-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={excluirAjustes} onChange={(e) => setExcluirAjustes(e.target.checked)} />
            <span>
              Excluir del análisis {lineasDeAjuste.length === 1 ? "la línea de ajuste" : "las " + lineasDeAjuste.length + " líneas de ajuste"} (variación de precios, imprevistos y similares).
              {" "}Al excluirlas, los porcentajes se calculan solo sobre los trabajos de obra.
            </span>
          </label>
        )}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: "#C9922B" }}>Análisis principal — para usar antes de presentar la oferta</p>

      {MOSTRAR_COST_ANALYSIS && (
        <>
          <h2 className="text-base font-semibold mt-2 mb-1">{M.analisisCostos}</h2>
          {analizadas.length === 0 && (
            <p className="text-xs text-gray-400 italic mb-6">Sube un presupuesto para ver la distribución por categoría.</p>
          )}
          {analizadas.length > 0 && !usaCategoriasReales && (
            <p className="text-xs text-gray-400 italic mb-6">No disponible: este presupuesto no trae capítulos ni códigos jerárquicos identificables. Usa {M.costDrivers}, que funciona sin importar la estructura del archivo.</p>
          )}
          {usaCategoriasReales && (
            <>
              <p className="text-xs text-gray-400 mb-2">Capítulos tomados directamente del archivo importado.</p>
              <div className="mb-6 border border-gray-200 rounded p-3">
                {costoPorFase.map((f) => (
                  <div key={f.key} className="flex items-center gap-3 mb-2 text-xs">
                    <span className="w-52 truncate">{f.name}</span>
                    <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                      <div className="h-4 rounded" style={{ width: (f.pct * 100).toFixed(1) + "%", background: "#3A5A73" }}></div>
                    </div>
                    <span className="w-28 text-right text-gray-600">{fmt(f.monto)} ({d1((f.pct * 100))}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <h2 className="text-base font-semibold mt-2 mb-2">1. {M.costDrivers}</h2>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase A (%)</label>
          <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralA} onChange={(e) => setUmbralA(Number(e.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase B (%)</label>
          <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralB} onChange={(e) => setUmbralB(Number(e.target.value) || 0)} />
        </div>
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:text-right">
          <div>
            <p className="text-xs text-gray-500">Total analizado</p>
            <p className="text-base font-medium leading-tight">{fmt(total)}</p>
            <p className="text-[10px] text-gray-400">suma de partidas, sin IVA</p>
          </div>
          <div className="sm:text-right">
            <button onClick={handleExport} disabled={total === 0}
              className="text-xs font-medium text-white rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#C9922B" }}>
              Descargar reporte completo (Excel)
            </button>
            <p className="text-[11px] text-gray-400 mt-1">Con diagrama de Gantt, flujo de caja y curva de avance</p>
          </div>
        </div>
      </div>

      <div className="mb-4 border border-blue-200 rounded p-3 bg-blue-50">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <span className="text-sm font-medium text-blue-900">
            {M.compresionRevision}: {analizadas.length ? d1(reviewCompression) + "×" : "—"}
          </span>
          <span className="text-xs text-blue-900">
            {analizadas.length ? n80 + " de " + analizadas.length + " partidas (" + pct80DePartidas.toFixed(0) + "%) explican el 80% del valor" : "Se calcula al subir tu presupuesto"}
          </span>
        </div>
        <p className="text-xs mb-2 text-blue-900">
          {analizadas.length
            ? "Reduce el universo de revisión " + d1(reviewCompression) + " veces para cubrir el 80% del valor económico de este presupuesto. Es una lectura descriptiva de este proyecto puntual, no una categoría estadística validada con muchos proyectos."
            : "Indica cuántas veces se reduce el universo de revisión para cubrir el 80% del valor económico del presupuesto. Sube tu archivo para calcularla."}
        </p>
        {analizadas.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-900">
            <span>80% del valor → {n80} partidas ({pct80DePartidas.toFixed(0)}%)</span>
            <span>90% → {n90} ({(n90 / analizadas.length * 100).toFixed(0)}%)</span>
          </div>
        )}
      </div>

      <div className="mb-6 border border-gray-200 rounded p-2">
        {analizadas.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-16">Sube un presupuesto para ver el análisis.</p>
        ) : (
          <>
            <div className="flex items-center gap-4 px-2 pt-1 pb-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.A.barra, display: "inline-block", borderRadius: 2 }}></span>Clase A</span>
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.B.barra, display: "inline-block", borderRadius: 2 }}></span>Clase B</span>
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.C.barra, display: "inline-block", borderRadius: 2 }}></span>Clase C</span>
              <span className="ml-auto">Mostrando {partidasMostradas.length} de {analizadas.length} · Línea: % acumulado</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={partidasMostradas} margin={{ top: 10, right: 20, left: 0, bottom: partidasMostradas.length > 12 ? 4 : 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="nombreCorto" angle={-40} textAnchor="end" height={partidasMostradas.length > 12 ? 44 : 70} tick={{ fontSize: 10 }} padding={{ left: 12, right: 6 }}
                  interval={partidasMostradas.length > 40 ? "preserveStartEnd" : 0}
                  tickFormatter={(v) => {
                    // Con muchas barras, el eje muestra solo el código (o un nombre corto); el nombre completo va en la ayuda al pasar el cursor.
                    if (partidasMostradas.length <= 12) return v;
                    return partidasMostradas.every((p) => p.codigo) ? String(v).split(" ")[0] : truncar(v, 14);
                  }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={ejeMonto} width={62} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} tickFormatter={ejePct} width={40} />
                <Tooltip content={<CostDriverTooltip fmt={fmt} />} />
                <ReferenceLine yAxisId="right" y={umbralA} stroke="#9CA3AF" strokeDasharray="4 4" />
                {partidasMostradas.length > corteRevision && corteRevision > 0 && (
                  <ReferenceLine yAxisId="left" x={partidasMostradas[corteRevision - 1].nombreCorto} stroke="#C9922B" strokeWidth={2}
                    label={{ value: "corte de revisión", position: "top", fontSize: 10, fill: "#C9922B" }} />
                )}
                <Bar yAxisId="left" dataKey="monto">
                  {partidasMostradas.map((p) => (
                    <Cell key={p.id} fill={claseInfo[p.clase].barra} />
                  ))}
                </Bar>
                <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="mb-3">
        {analizadas.length > 0 && (
        <>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-500">Mostrar</label>
            <select className="border border-gray-200 rounded px-1 py-0.5" value={topN} onChange={(e) => setTopN(e.target.value)}>
              <option value="80">80% del valor ({n80})</option>
              <option value="90">90% del valor ({n90})</option>
              <option value="todos">Todas ({analizadas.length})</option>
            </select>
          </div>
          <span className="text-xs text-gray-500">{partidasMostradas.length} partidas representan {d1(pctCubierto)}% de la oferta</span>
        </div>
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 border-b border-gray-200 pb-1 mb-1">
          <span className="col-span-1">#</span>
          <span className="col-span-4">Partida</span>
          <span className="col-span-2 text-right">Monto</span>
          <span className="col-span-1 text-right">% ind.</span>
          <span className="col-span-2 text-right">% acum.</span>
          <span className="col-span-1 text-center">Clase</span>
          <span className="col-span-1"></span>
        </div>
        {partidasMostradas.map((p) => (
          <Fragment key={p.id}>
          <div className="grid grid-cols-12 gap-2 items-center text-xs py-1 border-b border-gray-100">
            <span className="col-span-1 text-gray-400">{p.rank}</span>
            <div className="col-span-4 flex items-baseline gap-1.5 min-w-0">
              {p.codigo && <span className="font-mono text-[11px] text-gray-400 shrink-0">{p.codigo}</span>}
              <span className="px-1 min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
            </div>
            <span className="col-span-2 text-right tabular-nums">{fmt(p.monto)}</span>
            <span className="col-span-1 text-right text-gray-500">{d1(p.pctInd)}%</span>
            <span className="col-span-2 text-right text-gray-500">{d1(p.pctAcum)}%</span>
            <span className="col-span-1 text-center">
              <span style={{ background: claseInfo[p.clase].bg, color: claseInfo[p.clase].color }} className="px-2 py-0.5 rounded text-xs font-medium">
                {p.clase}
              </span>
            </span>
            <span className="col-span-1"></span>
          </div>
          {p.rank === corteRevision && (
            <div className="my-2 flex items-center gap-3">
              <span className="h-px flex-1 bg-cimbra-amber" style={{ background: "#C9922B" }}></span>
              <span className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "#C9922B" }}>
                Hasta aquí llega tu revisión
              </span>
              <span className="h-px flex-1" style={{ background: "#C9922B" }}></span>
            </div>
          )}
          {p.rank === corteRevision && (
            <p className="text-xs text-gray-500 mb-3">
              Estas {corteRevision} partidas concentran el {porClase.A.length ? porClase.A[porClase.A.length - 1].pctAcum.toFixed(0) : 0}% del valor del presupuesto.
              {analizadas.length > corteRevision
                ? " Las " + (analizadas.length - corteRevision) + " restantes suman el " + (100 - (porClase.A[porClase.A.length - 1] ? porClase.A[porClase.A.length - 1].pctAcum : 0)).toFixed(0) + "% y pueden revisarse con menor prioridad."
                : ""}
            </p>
          )}
          </Fragment>
        ))}
        </>
        )}
        {analizadas.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4">No hay partidas cargadas todavía.</p>
        )}
      </div>

      <div className="mb-6">
        {(topN === "80" ? ["A"] : topN === "90" ? ["A", "B"] : ["A", "B", "C"]).map((c) =>
          porClase[c].length === 0 ? null : (
            <div key={c} className="mb-3 border border-gray-200 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ background: claseInfo[c].bg, color: claseInfo[c].color }} className="px-2 py-0.5 rounded text-xs font-medium">
                  {c}
                </span>
                <span className="text-sm font-medium">{claseInfo[c].label}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{fasePorClase[c]}</p>
              {c === "A" && (
                <p className="text-xs text-gray-500 mb-2 italic">
                  Vale la pena que reflexiones si alguna de estas partidas corresponde a un insumo importado, de fabricación especializada o de entrega larga: al concentrar tanto peso, cualquier riesgo cambiario o de suministro en ellas afecta de forma desproporcionada al resto de la oferta.
                </p>
              )}
              <p className="text-xs text-gray-500">{resumirNombres(porClase[c], 8)}</p>
            </div>
          )
        )}
      </div>

      {familias.length > 0 && (
        <div className="mb-6 border border-gray-200 rounded p-3">
          <h3 className="text-sm font-medium mb-1">Familias de partidas</h3>
          <p className="text-xs text-gray-500 mb-2">
            Partidas que comparten el mismo código en tu archivo{analizadas.some((p) => p.codigo) ? "" : " o la misma descripción"}. Una familia puede pesar mucho aunque ninguna de sus partidas destaque por separado.
            {familiaDestacada
              ? " Aquí la familia " + familiaDestacada.etiqueta + " suma " + d1(familiaDestacada.pct) + "% del presupuesto, más que la partida individual de mayor peso."
              : ""}
          </p>
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 border-b border-gray-200 pb-1 mb-1">
            <span className="col-span-5">Familia</span>
            <span className="col-span-2 text-center">Partidas</span>
            <span className="col-span-3 text-right">Monto total</span>
            <span className="col-span-2 text-right">% del total</span>
          </div>
          {familias.slice(0, 8).map((f) => (
            <div key={f.clave} className="grid grid-cols-12 gap-2 items-center text-xs py-1 border-b border-gray-100">
              <span className="col-span-5 truncate" title={f.nombre}>
                {f.etiqueta !== f.nombre && <span className="font-mono text-[11px] text-gray-400 mr-1.5">{f.etiqueta}</span>}
                {f.nombre}
              </span>
              <span className="col-span-2 text-center text-gray-500">{f.partidas.length}</span>
              <span className="col-span-3 text-right tabular-nums">{fmt(f.monto)}</span>
              <span className="col-span-2 text-right text-gray-500">{d1(f.pct)}%</span>
            </div>
          ))}
          {familias.length > 8 && (
            <p className="text-xs text-gray-400 mt-2">Y {familias.length - 8} familias más en la hoja «Familias de Partidas» del reporte en Excel.</p>
          )}
        </div>
      )}

      <div className="mt-10 pt-4 border-t-2" style={{ borderColor: "#E5E7EB" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3A5A73" }}>Resultados complementarios</p>
        <p className="text-xs text-gray-500 mt-1 mb-2">A partir del mismo presupuesto, estas herramientas dan una referencia inicial de tiempo, dinero y compras. Son aproximaciones tempranas para apoyar tu oferta; no sustituyen tu programación detallada.</p>
      </div>
      <h2 className="text-base font-semibold mt-4 mb-1">2. {M.cronograma}</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        {analizadas.length === 0 && <p className="text-xs text-gray-400 italic">Sube un presupuesto para poder estimar un cronograma.</p>}
        {analizadas.length > 0 && (
        <>
        <div className="flex items-center justify-end gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500" title="Define en qué punto de una fase arranca la siguiente.">Encadenamiento</label>
            <select className="border border-gray-200 rounded px-1 py-0.5 text-xs" value={solape} onChange={(e) => setSolape(Number(e.target.value))}>
              <option value={0}>Cada fase empieza al terminar la anterior</option>
              <option value={15}>Empieza con la anterior al 85% (solape leve)</option>
              <option value={30}>Empieza con la anterior al 70% (solape moderado)</option>
              <option value={50}>Empieza con la anterior al 50% (obra muy solapada)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Unidad</label>
            <select className="border border-gray-200 rounded px-1 py-0.5 text-xs" value={unidadEfectiva}
              onChange={(e) => { setUnidadTiempo(e.target.value); setUnidadElegida(true); }}>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="años">Años</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Plazo total estimado ({unidadLabel})</label>
            <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-20 border border-gray-200 rounded px-1 py-0.5 text-right"
              placeholder={unidadEfectiva === "semanas" ? "Ej: 36" : unidadEfectiva === "meses" ? "Ej: 8" : "Ej: 2"}
              step="any"
              value={plazoTotal === null ? "" : aUnidad(plazoTotal)}
              onChange={(e) => { const raw = e.target.value; setPlazoTotal(raw === "" ? null : aDias(Number(raw))); }} />
          </div>
        </div>
        {plazoEsProvisional && (
          <p className="text-xs mb-3 px-2 py-1.5 rounded" style={{ background: "#FBEFD9", color: "#8A5A0B" }}>
            Plazo provisional de {plazoTexto(plazoTotal)}: Cimbra no puede deducir la duración real de tu obra.
            Escribe arriba el plazo de tu proyecto y el cronograma, el {M.flujoCaja} y las {M.procura} se recalculan.
          </p>
        )}
        {plazoTotal !== null && plazoTotal > 0 && (
        <>
        <p className="text-xs text-gray-500 mb-3">
          {huboMinimo ? "Las fases de menor peso reciben una duración mínima para que el cronograma sea ejecutable, y el conjunto se reajusta al plazo que indicaste. " : ""}
          {solape > 0
            ? "Las fases se solapan: cada una arranca cuando la anterior lleva " + (100 - solape) + "% de avance, que es lo habitual en obra. El solape acorta el calendario, no la duración de cada fase. Puedes cambiarlo arriba. "
            : "Las fases van una detrás de otra, sin solape. En obra lo normal es que se solapen: cámbialo arriba si es tu caso. "}
          La duración de cada fase se estima en proporción al peso de sus partidas dentro del presupuesto total, no a partir de rendimientos reales de cuadrilla. Si ya tienes fechas y duraciones reales de tu propio cronograma (en Primavera, Project o Excel), edita el inicio y la duración de cada fase abajo (en {unidadLabel}); el {M.flujoCaja} y las {M.procura} usarán esos valores en lugar de los calculados automáticamente.
        </p>
        {cronograma.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mb-2 text-xs">
              <span className="text-gray-600">
                Fin estimado de la obra: <strong className="font-semibold">{aUnidadEd(finDeObra)} {unidadLabel}</strong>
              </span>
              {Math.abs(finDeObra - plazoTotal) > Math.max(diasPorUnidad, plazoTotal * 0.02) && (
                <span style={{ color: "#92400e" }}>
                  {finDeObra > plazoTotal ? "Excede" : "Se queda corto frente a"} el plazo indicado de {aUnidad(plazoTotal)} {unidadLabel} en {d1(Math.abs(finDeObra - plazoTotal) / diasPorUnidad)} {unidadLabel}; ajusta duraciones o el plazo.
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={cronograma.length * (cronograma.length > 25 ? 18 : 40) + 40}>
              <BarChart data={cronogramaDisplay} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, aUnidad(domainMax)]} tick={{ fontSize: 11 }} label={{ value: unidadLabel, position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => (n === "dias" ? v + " " + unidadLabel : null)} labelFormatter={(l) => l} />
                <Bar dataKey="inicio" stackId="g" fill="transparent" />
                <Bar dataKey="dias" stackId="g" fill="#3A5A73" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3">
              {cronograma.map((f) => (
                <div key={f.key} className="mb-2 border-t border-gray-100 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs mb-1">
                    <span className="font-medium">{f.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-gray-500">
                      Inicio ({unidadAbrev})
                      <input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={aUnidadEd(f.inicio)}
                        onChange={(e) => setInicioManual((m) => ({ ...m, [f.key]: Math.max(0, unidadEdADias(Number(e.target.value) || 0)) }))} />
                      {f.esManualInicio && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setInicioManual((m) => { const c = { ...m }; delete c[f.key]; return c; })}>
                          inicio auto
                        </button>
                      )}
                      Duración ({unidadAbrev})
                      <input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={aUnidadEd(f.dias)}
                        onChange={(e) => setDuracionManual((m) => ({ ...m, [f.key]: Math.max(1, unidadEdADias(Number(e.target.value) || 1)) }))} />
                      <span className="text-gray-400">→ termina en {aUnidadEd(f.fin)}</span>
                      {f.esManualDuracion && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setDuracionManual((m) => { const c = { ...m }; delete c[f.key]; return c; })}>
                          duración auto
                        </button>
                      )}
                    </span>
                  </div>
                  {f.partidas.length > 1 && (
                    <p className="text-xs text-gray-500">
                      {resumirNombres(f.partidas, 8, (p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name) + (p.clase === "A" ? " (prioridad alta)" : ""))}
                    </p>
                  )}
                  {f.partidas.length === 1 && f.partidas[0].clase === "A" && (
                    <p className="text-xs text-gray-500">Prioridad alta (clase A)</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        </>
        )}
        </>
        )}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">3. {M.flujoCaja}</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        {(analizadas.length === 0 || plazoTotal === null) ? (
          <p className="text-xs text-gray-400 italic">
            {analizadas.length === 0 ? "Sube un presupuesto para ver el flujo de caja." : "Define el plazo total en " + M.cronograma + " (módulo 2) para poder calcular el flujo de caja."}
          </p>
        ) : (
        <>
        <div className="flex items-center justify-end mb-3">
          <span className="text-xs text-gray-500">
            Periodicidad: <strong className="font-semibold">{PERIODICIDAD_LABEL[unidadEfectiva]}</strong> — la misma unidad del {M.cronograma}. Cámbiala allí y este flujo se recalcula.
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Curva del presupuesto total del proyecto, no solo de las partidas clase A. El avance físico se representa igual al avance financiero (ponderado por presupuesto), práctica habitual sin metrados de campo independientes.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={flujoCaja} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={numPeriodos > 8 ? -35 : 0} textAnchor={numPeriodos > 8 ? "end" : "middle"} height={numPeriodos > 8 ? 55 : 30} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={ejeMonto} width={62} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} tickFormatter={ejePct} width={40} />
            <Tooltip formatter={(v, n) => (String(n).startsWith("Avance") ? d1(v) + "%" : fmt(v))} />
            <Bar yAxisId="left" dataKey="monto" fill="#3A5A73" name="Flujo de caja del período" />
            <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} name="Avance físico-financiero acumulado" />
          </ComposedChart>
        </ResponsiveContainer>
        </>
        )}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">4. {M.procura}</h2>
      <p className="text-xs text-gray-400 mb-2">Ejecución — para usar una vez adjudicado el proyecto</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-500 mb-3">
          Las partidas de mayor peso económico (clase A y B), ordenadas por el momento en que las necesitas según el cronograma. Incluyen materiales, equipos, servicios y subcontratos.
        </p>
        {analizadas.length === 0 && <p className="text-xs text-gray-400 italic">Sube un presupuesto para ver las prioridades de procura.</p>}
        {analizadas.length > 0 && prioridadesCompra.length === 0 && <p className="text-xs text-gray-400 italic">No se detectaron partidas de compra crítica con la información actual.</p>}
        {prioridadesCompra.length > 0 && (
          <>
            <div className="flex flex-wrap gap-4 mb-3 text-xs">
              <span className="text-gray-600">A gestionar: <strong className="font-semibold">{prioridadesCompra.length} partidas</strong></span>
              <span className="text-gray-600">Peso en el presupuesto: <strong className="font-semibold">{d1(prioridadesCompra.reduce((a, p) => a + p.pctInd, 0))}%</strong></span>
              {hayPlazo && <span className="text-gray-600">La primera se necesita desde <strong className="font-semibold">{desdeMomento(prioridadesCompra[0].inicioFase)}</strong></span>}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left font-medium py-1 w-8">#</th>
                  <th className="text-left font-medium py-1">Partida</th>
                  <th className="text-right font-medium py-1 whitespace-nowrap">Se necesita</th>
                  <th className="text-right font-medium py-1 w-16">% ppto.</th>
                </tr>
              </thead>
              <tbody>
                {(verTodaProcura ? prioridadesCompra : prioridadesCompra.slice(0, 10)).map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1 text-gray-400">{i + 1}</td>
                    <td className="py-1 pr-2">
                      {p.codigo ? <span className="text-gray-400">{p.codigo} </span> : null}{encabezado(p.name, 60)}
                      <span className="ml-1 px-1 rounded" style={{ background: claseInfo[p.clase].bg, color: claseInfo[p.clase].color }}>{p.clase}</span>
                    </td>
                    <td className="py-1 text-right text-gray-500 whitespace-nowrap">{hayPlazo ? momentoDeDia(p.inicioFase) : "—"}</td>
                    <td className="py-1 text-right text-gray-500">{d1(p.pctInd)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {prioridadesCompra.length > 10 && (
              <button className="text-xs text-blue-600 hover:underline mt-2" onClick={() => setVerTodaProcura((v) => !v)}>
                {verTodaProcura ? "Ver solo las 10 primeras" : "Ver las " + prioridadesCompra.length + " partidas"}
              </button>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Cimbra no distingue todavía qué se compra y qué se contrata, ni si el insumo es de entrega larga o inmediata: usa esto como guía de orden y aplica tu criterio sobre cuáles requieren más antelación. La lista completa va en el reporte de Excel.
            </p>
          </>
        )}
      </div>

      {MOSTRAR_CRITICAL_ACTIVITIES && (
        <>
          <h2 className="text-base font-semibold mt-6 mb-1">{M.actividadesCriticas}</h2>
          <p className="text-xs text-gray-400 mb-2">Pausado — hoy no aporta información distinta a {M.costDrivers}</p>
          <div className="mb-6 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500 mb-3">
              Combina peso en el presupuesto y urgencia según el cronograma (qué tan pronto se necesita). No es una ruta crítica calculada por dependencias reales entre actividades, sino una priorización razonable para dar seguimiento cercano.
            </p>
            {actividadesCriticas.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs mb-1.5 border-b border-gray-100 pb-1.5">
                <span>{i + 1}. {p.codigo ? p.codigo + " — " : ""}{encabezado(p.name, 70)}</span>
                <span className="text-gray-500">{d1(p.pctInd)}% del presupuesto · fase {p.fase} · {momentoDeDia(p.inicioFase)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-base font-semibold mt-6 mb-2">5. {M.reporteEjecutivo}</h2>
      <div className="mb-6 border border-gray-200 rounded p-3 bg-gray-50">
        <p className={analizadas.length ? "text-sm text-gray-800 leading-relaxed" : "text-xs text-gray-400 italic"}>
          {analizadas.length ? textoEjecutivo : "Sube un presupuesto para generar el reporte ejecutivo."}
        </p>
      </div>
    </div>
  );
}
