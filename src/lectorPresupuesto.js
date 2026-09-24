// Lectura de presupuestos: reconoce las columnas de descripción, monto y código en los
// formatos más comunes (español e inglés, con o sin acentos, con o sin encabezados),
// interpreta montos escritos como texto ("1.234,56", "$1,234.56", "(500)") y elige la hoja
// del libro que contiene el presupuesto. No depende de React: recibe y devuelve datos simples.
import * as XLSX from "xlsx-js-style";

// ---------------------------------------------------------------- utilidades de texto

// "Descripción", "DESCRIPCIÓN " y "Descripci�n" (archivo mal codificado) quedan comparables.
export function normalizarEncabezado(t) {
  return String(t == null ? "" : t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const vacia = (c) => c === null || c === undefined || String(c).trim() === "";

// ---------------------------------------------------------------- números

// Convierte una celda en número. Acepta números reales y textos como "1.234,56" (formato
// latino), "1,234.56" (formato estadounidense), "$ 1 234,56", "Bs. 500", "(500)" (negativo).
// Devuelve NaN si la celda no es un número.
export function parsearNumero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (/^-|-$/.test(s)) negativo = true;
  // Quita moneda, unidades y espacios (incluido el espacio duro y el de miles "1 234").
  s = s.replace(/(bs\.?s?|bol[ií]vares|us\$|usd|eur|€|\$|d[oó]lares)/gi, "").replace(/[\s '’]/g, "").replace(/^[-+]|-$/g, "");
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return NaN;
  const tienePunto = s.includes(".");
  const tieneComa = s.includes(",");
  let n;
  if (tienePunto && tieneComa) {
    // El separador que aparece último es el decimal.
    const decimalEsComa = s.lastIndexOf(",") > s.lastIndexOf(".");
    n = decimalEsComa ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (tieneComa) {
    const partes = s.split(",");
    // Varias comas, o una coma seguida de exactamente 3 dígitos (y algo antes): miles.
    const miles = partes.length > 2 || (partes[1].length === 3 && partes[0].length >= 1 && partes[0] !== "0");
    n = miles ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (tienePunto) {
    const partes = s.split(".");
    const miles = partes.length > 2 || (partes[1].length === 3 && partes[0].length >= 1 && partes[0] !== "0");
    n = miles ? s.replace(/\./g, "") : s;
  } else {
    n = s;
  }
  const num = parseFloat(n);
  if (!Number.isFinite(num)) return NaN;
  return negativo ? -num : num;
}

// ---------------------------------------------------------------- clasificación de encabezados

const ES_CANTIDAD = /^(cant|cantidad|cantidades|qty|quantity|metrado|metrados|volumen|computo|computos|cantidad total)\b/;
const ES_UNITARIO = /\b(unitario|unitaria|unit|unitary|p u|pu|p unit|c u|cu)\b/;
const ES_UNIDAD = /^(und|unid|unidad|unidades|un|u m|um|ud|uds|unit of measure|uom|unit)$/;
const ES_CODIGO = /^(item|items|it|n|no|nro|num|numero|cod|codigo|code|ref|referencia|id|partida n|n partida|no partida|nro partida|codigo partida|cod partida|renglon n)\b|\bcodigo\b|\bcode\b/;

// Encabezados de descripción, de mayor a menor confianza.
const NIVELES_DESCRIPCION = [
  /descripci|description|concepto|concept/,
  /\bpartidas?\b|actividad|activity|detalle|detail|rubro|renglon|denominacion|trabajo|work item|scope|alcance/,
  /^(nombre|name|item|items|articulo|material|materiales|servicio|producto)\b/,
];

// Encabezados de monto, de mayor a menor confianza.
const NIVELES_MONTO = [
  /^(total|importe total|monto total|valor total|costo total|precio total|total amount|total cost|total price|total general|line total|extended|extended cost|extended price|ext cost|ext price)$/,
  /\btotal\b(?!.*\b(cantidad|qty)\b)/,
  /^(monto|importe|amount|monto bs|importe bs|monto usd|monto us|valor|valor bs|valor usd|costo|cost|precio|price|extension)\b|\bmonto\b|\bimporte\b|\bamount\b/,
  /sub ?total|parcial|partial/,
  /presupuesto|budget|\bbs\b|\busd\b|us\$|costo|valor|precio|price|cost/,
];

function clasificarColumnas(fila) {
  const cols = [];
  for (let i = 0; i < fila.length; i++) {
    const h = normalizarEncabezado(fila[i]);
    cols.push({ i, h, unitario: ES_UNITARIO.test(h), cantidad: ES_CANTIDAD.test(h), unidad: ES_UNIDAD.test(h), codigo: ES_CODIGO.test(h) });
  }
  return cols;
}

function sumaColumna(filas, desde, idx, max = 400) {
  let s = 0;
  for (let r = desde; r < Math.min(filas.length, desde + max); r++) {
    const n = filas[r] ? parsearNumero(filas[r][idx]) : NaN;
    if (n > 0) s += n;
  }
  return s;
}

// Busca la fila de encabezados y las columnas de descripción, monto (o cantidad × precio unitario) y código.
function detectarPorEncabezados(filas) {
  const limite = Math.min(30, filas.length);
  let mejor = null;
  for (let r = 0; r < limite; r++) {
    const fila = filas[r];
    if (!fila || fila.length < 2) continue;
    const cols = clasificarColumnas(fila);
    if (cols.every((c) => !c.h)) continue;

    // Descripción: el primer nivel con alguna columna (que no sea de código/cantidad/unitario).
    let nombre = -1;
    for (let n = 0; n < NIVELES_DESCRIPCION.length; n++) {
      // Un encabezado tipo "Item" o "N° Partida" es el código, salvo que sea la única opción (último nivel).
      const c = cols.find((k) => k.h && NIVELES_DESCRIPCION[n].test(k.h) && !k.cantidad && !k.unitario && !k.unidad && !(n < 2 && k.codigo && !/descripci|description|concepto/.test(k.h)));
      if (c) { nombre = c.i; break; }
    }
    if (nombre === -1) continue;

    // Monto: el primer nivel con candidatas; entre varias, la de mayor suma en los datos.
    let monto = -1;
    let otrasDeMonto = [];
    for (const nivel of NIVELES_MONTO) {
      const cand = cols.filter((k) => k.i !== nombre && k.h && nivel.test(k.h) && !k.unitario && !k.cantidad && !k.unidad && !k.codigo);
      if (cand.length) {
        cand.sort((a, b) => sumaColumna(filas, r + 1, b.i) - sumaColumna(filas, r + 1, a.i));
        monto = cand[0].i;
        otrasDeMonto = cand.slice(1).filter((k) => sumaColumna(filas, r + 1, k.i) > 0).map((k) => k.i);
        break;
      }
    }
    // Sin columna de monto: cantidad × precio unitario.
    let cantidad = -1;
    let unitario = -1;
    if (monto === -1) {
      const q = cols.find((k) => k.cantidad);
      const u = cols.find((k) => k.unitario && !k.cantidad);
      if (q && u) { cantidad = q.i; unitario = u.i; }
    }
    if (monto === -1 && cantidad === -1) continue;

    // Código: columna con encabezado de código distinta de las anteriores.
    const codigoCol = cols.find((k) => k.codigo && k.i !== nombre && k.i !== monto);
    mejor = { headerRowIdx: r, nameIdx: nombre, amountIdx: monto, qtyIdx: cantidad, unitIdx: unitario, codigoIdx: codigoCol ? codigoCol.i : -1, otrasDeMonto, porContenido: false };
    break;
  }
  return mejor;
}

// Último recurso: el archivo no trae encabezados reconocibles. Se deduce por el contenido:
// la descripción es la columna de texto más largo y el monto, la columna numérica de mayor suma.
function detectarPorContenido(filas) {
  const muestra = filas.slice(0, 400);
  const ancho = Math.max(0, ...muestra.map((f) => (f ? f.length : 0)));
  if (ancho < 2) return null;
  const stats = [];
  for (let c = 0; c < ancho; c++) {
    let texto = 0, largoTexto = 0, numeros = 0, suma = 0, enteros = 0, consecutivos = 0, previo = null;
    for (const f of muestra) {
      const v = f ? f[c] : null;
      if (vacia(v)) continue;
      const n = parsearNumero(v);
      if (Number.isNaN(n)) {
        const t = String(v).trim();
        if (t.length >= 8) { texto++; largoTexto += t.length; }
      } else if (n > 0) {
        numeros++; suma += n;
        if (Number.isInteger(n)) enteros++;
        if (previo !== null && n === previo + 1) consecutivos++;
        previo = n;
      }
    }
    stats.push({ c, texto, prom: texto ? largoTexto / texto : 0, numeros, suma, enteros, consecutivos });
  }
  const nombre = stats.filter((s) => s.texto >= 5).sort((a, b) => b.texto * b.prom - a.texto * a.prom)[0];
  if (!nombre) return null;
  // Columnas numéricas que no son un simple contador de filas (1, 2, 3, …).
  const numericas = stats.filter((s) => s.numeros >= 5 && s.c !== nombre.c && s.consecutivos < s.numeros * 0.6);
  const monto = numericas.sort((a, b) => b.suma - a.suma)[0];
  if (!monto) return null;
  let primera = filas.findIndex((f) => f && !vacia(f[nombre.c]) && String(f[nombre.c]).trim().length >= 4 && parsearNumero(f[monto.c]) > 0);
  if (primera < 0) primera = 0;
  return { headerRowIdx: primera - 1, nameIdx: nombre.c, amountIdx: monto.c, qtyIdx: -1, unitIdx: -1, codigoIdx: -1, otrasDeMonto: [], porContenido: true };
}

// ---------------------------------------------------------------- lectura de una hoja

// Textos de una sola celda que NO son capítulos (títulos de columna, totales, etc.).
const NO_ES_CAPITULO = /^(partidas?|descripci[oó]n|description|[ií]tem|item|total|sub-?total|obra|cliente|servicio|propietario|fecha|project|proyecto|client|date)\b/i;
// Filas que traen totales, subtotales o impuestos en la columna de descripción: no son partidas.
const FILA_DE_TOTAL = /^\s*(i\.?v\.?a\b|i\.?g\.?v\b|impuesto|sub-?total|total\b|grand total|tax\b|vat\b|sales tax)/i;
// Líneas que suelen ser ajustes financieros y no trabajos de obra: se avisan, no se excluyen.
const LINEA_DE_AJUSTE = /variaci[oó]n de precios|escalaci[oó]n|imprevistos|reajuste de precios|contingencias?\b|contingency|escalation|price adjustment|incremento por modificaci|aumento de costos|ajuste por inflaci/i;

function prefijoCodigo(codigo) {
  if (!codigo) return null;
  const partes = String(codigo).trim().split("-");
  if (partes.length <= 1) return null;
  const ultima = partes[partes.length - 1].trim();
  if (/^\d+(\.\d+)?$/.test(ultima)) return partes.slice(0, -1).join("-");
  return codigo;
}

function limpiarCapitulo(t) {
  return t.replace(/\s*\(\s*\d+\s*(al|a|-)\s*\d+\s*\)\s*$/i, "").replace(/\s+/g, " ").trim();
}

// Devuelve { error } o { partidas, sinMonto, totalArchivo, ...detalle }. Las partidas no llevan id.
export function leerHoja(hoja) {
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });
  if (!filas || filas.length < 2) return { error: "El archivo no tiene filas suficientes.", filas: 0 };

  const det = detectarPorEncabezados(filas) || detectarPorContenido(filas);
  if (!det) {
    return { error: "No se detectaron columnas de partida y monto. Verifica los encabezados del archivo.", filas: filas.length };
  }
  const { headerRowIdx, nameIdx, amountIdx, qtyIdx, unitIdx, codigoIdx } = det;
  const montoDe = (row) => {
    if (amountIdx !== -1) return parsearNumero(row[amountIdx]);
    const q = parsearNumero(row[qtyIdx]);
    const u = parsearNumero(row[unitIdx]);
    return Number.isNaN(q) || Number.isNaN(u) ? NaN : q * u;
  };

  // Capítulos del archivo: filas con una sola celda de texto (a la izquierda de la descripción
  // o en ella) y sin monto. Si hay varios niveles, el capítulo es el nivel superior.
  const esEncabezado = (row) => {
    const celdas = [];
    row.forEach((c, j) => { if (!vacia(c)) celdas.push([j, c]); });
    if (celdas.length !== 1) return null;
    const [j, c] = celdas[0];
    const texto = String(c).trim();
    if (typeof c !== "string" || j > nameIdx || texto.length < 4 || NO_ES_CAPITULO.test(texto)) return null;
    return { col: j, texto: limpiarCapitulo(texto) };
  };
  const encabezados = new Map();
  for (let r = headerRowIdx + 1; r < filas.length; r++) {
    if (!filas[r]) continue;
    const h = esEncabezado(filas[r]);
    if (h) encabezados.set(r, h);
  }
  const colTope = encabezados.size ? Math.min(...[...encabezados.values()].map((h) => h.col)) : -1;

  const partidas = [];
  let sinMonto = 0;
  let capituloActual = null;
  for (let r = headerRowIdx + 1; r < filas.length; r++) {
    const row = filas[r];
    if (!row) continue;
    const enc = encabezados.get(r);
    if (enc) {
      if (enc.col === colTope) capituloActual = enc.texto;
      continue;
    }
    const name = row[nameIdx];
    const amount = montoDe(row);
    const nombreLimpio = name ? String(name).trim().replace(/^(descripci[oó]n|description)\s*:\s*/i, "") : "";
    if (!nombreLimpio || FILA_DE_TOTAL.test(nombreLimpio)) continue;
    const codigo = codigoIdx !== -1 && !vacia(row[codigoIdx]) ? String(row[codigoIdx]).trim() : null;
    // Partida escrita en el archivo pero con monto cero: puede ser una omisión del presupuesto.
    if (amount === 0 && (codigo || typeof row[0] === "number")) { sinMonto += 1; continue; }
    if (Number.isNaN(amount) || amount <= 0) continue;
    partidas.push({
      orden: partidas.length, name: nombreLimpio, monto: amount, codigo,
      capitulo: capituloActual, categoria: codigo ? prefijoCodigo(codigo) : null,
      esAjuste: LINEA_DE_AJUSTE.test(nombreLimpio),
    });
  }
  if (partidas.length === 0) {
    // Fórmulas sin valor calculado (archivos generados por programas que no guardan resultados).
    let sinCalcular = 0;
    for (const k of Object.keys(hoja)) {
      if (k[0] === "!") continue;
      const c = hoja[k];
      if (c && c.f && (c.t === "z" || c.v === undefined || c.v === null || c.v === "")) sinCalcular++;
    }
    if (sinCalcular > 0) {
      return { error: "Las celdas de monto de este archivo son fórmulas sin resultado guardado. Ábrelo en Excel, guárdalo (Ctrl+G) y vuelve a subirlo.", filas: filas.length };
    }
    return { error: "No se encontraron partidas válidas en el archivo.", filas: filas.length };
  }

  // ¿Sirven los capítulos del archivo? Deben ser al menos 2 y agrupar en promedio 2 o más partidas.
  const capitulosDistintos = new Set(partidas.map((p) => p.capitulo).filter(Boolean));
  const usarCapitulos = capitulosDistintos.size >= 2 && partidas.length / capitulosDistintos.size >= 2;
  if (usarCapitulos) partidas.forEach((p) => { p.categoria = p.capitulo || "Otras partidas"; });

  // Total declarado por el propio archivo (fila de "Total"): sirve para confirmar la lectura.
  const totalImportado = partidas.reduce((s, p) => s + p.monto, 0);
  let totalArchivo = null;
  let revisadas = 0;
  for (let r = filas.length - 1; r >= 0 && totalArchivo === null && revisadas < 40; r--) {
    const row = filas[r];
    if (!row || !row.some((c) => !vacia(c))) continue;
    revisadas += 1;
    if (!row.some((c) => typeof c === "string" && /total|sub-?total/i.test(c))) continue;
    for (const c of row) {
      const n = parsearNumero(c);
      if (n > 0 && Math.abs(n - totalImportado) / totalImportado < 0.005) { totalArchivo = n; break; }
    }
  }

  const textoContexto = filas.slice(0, Math.max(headerRowIdx, 0) + 1).concat(filas.slice(-25)).flat().filter((c) => typeof c === "string").join(" ");

  const letra = (i) => XLSX.utils.encode_col(i);
  const notas = [];
  if (det.porContenido) {
    notas.push("El archivo no trae encabezados reconocibles: se asumió que la columna " + letra(nameIdx) + " es la descripción y la columna " + letra(amountIdx) + " es el monto. Verifica que sea correcto.");
  } else {
    if (amountIdx === -1) notas.push("El archivo no trae una columna de monto: se calculó multiplicando la cantidad (columna " + letra(qtyIdx) + ") por el precio unitario (columna " + letra(unitIdx) + ").");
    if (det.otrasDeMonto.length) notas.push("El archivo tiene varias columnas de monto; se usó la columna " + letra(amountIdx) + " (" + String(filas[headerRowIdx][amountIdx]).trim() + "), la de mayor valor. Si no es la correcta, deja en el archivo solo la que quieres analizar.");
  }

  return { partidas, sinMonto, totalArchivo, textoContexto, totalImportado, notas, capitulos: usarCapitulos ? capitulosDistintos.size : 0, filas: filas.length };
}

// ---------------------------------------------------------------- lectura del archivo completo

// Decodifica un CSV/TXT: UTF-8 y, si no es válido, Windows-1252 (Excel en español guarda así).
function textoDeBytes(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function esLibroBinario(b) {
  // .xlsx / .xlsm (zip: "PK") y .xls antiguo (OLE2: D0 CF 11 E0). Lo demás se trata como texto.
  return (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
}

// Lee los bytes de un Excel o CSV y devuelve el mejor resultado entre todas las hojas.
// { partidas, sinMonto, totalArchivo, moneda, notas, capitulos, hoja, otrasHojas } o { error }.
export function leerPresupuesto(bytes) {
  let libro;
  try {
    libro = esLibroBinario(bytes)
      ? XLSX.read(bytes, { type: "array", sheetStubs: true })
      // raw: true evita que la librería convierta "1.234" en 1,234: los montos los interpreta parsearNumero.
      : XLSX.read(textoDeBytes(bytes), { type: "string", raw: true });
  } catch (e) {
    return { error: "No se pudo leer el archivo. Verifica que sea un Excel o CSV válido." };
  }
  if (!libro.SheetNames.length) return { error: "El archivo no tiene hojas." };

  let mejor = null;
  let primerError = null;
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja || !hoja["!ref"]) continue;
    let r;
    try { r = leerHoja(hoja); } catch (e) { continue; }
    if (r.error) { if (!primerError) primerError = r.error; continue; }
    if (!mejor || r.partidas.length > mejor.partidas.length) mejor = { ...r, hoja: nombre };
  }
  if (!mejor) return { error: primerError || "No se encontraron partidas válidas en el archivo." };

  const otras = libro.SheetNames.filter((n) => {
    if (n === mejor.hoja) return false;
    const ref = libro.Sheets[n] && libro.Sheets[n]["!ref"];
    if (!ref) return false;
    const rg = XLSX.utils.decode_range(ref);
    return rg.e.r - rg.s.r >= 5;
  });
  // La moneda se busca en TODO el libro: muchos presupuestos la declaran en una hoja de
  // condiciones o carátula distinta de la que trae las partidas.
  let textoLibro = "";
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja || !hoja["!ref"]) continue;
    for (const k of Object.keys(hoja)) {
      if (k[0] === "!") continue;
      const c = hoja[k];
      if (c && typeof c.v === "string") textoLibro += " " + c.v;
      if (c && c.z && typeof c.z === "string") textoLibro += " " + c.z;
    }
  }
  mejor.moneda = /(^|[^a-zñ])bs\.?s?([^a-zñ]|$)|bol[ií]vares\b/i.test(textoLibro) ? "Bs. "
    : /US\$|\bUSD\b|\bd[oó]lares\b|\(\$\)|\$\s*\d/i.test(textoLibro) ? "$" : "";
  delete mejor.textoContexto;

  return { ...mejor, hojaUsadaEsPrimera: libro.SheetNames[0] === mejor.hoja, otrasHojas: otras, totalHojas: libro.SheetNames.length };
}
