// Barrido de formatos: genera cientos de presupuestos combinando idioma, encabezados, estilo de
// capítulos y subtotales, rubros de cierre, formato de números y hojas de APU, y comprueba que
// el lector devuelva exactamente las partidas de obra y su total.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSXmod from "xlsx-js-style";
import { leerPresupuesto } from "../src/lectorPresupuesto.js";

const XLSX = XLSXmod.read ? XLSXmod : XLSXmod.default;

// Generador pseudoaleatorio con semilla: los fallos se pueden reproducir.
function azar(semilla) {
  let s = Math.imul(semilla, 2654435761) >>> 0;
  for (let i = 0; i < 5; i++) s = (s * 1664525 + 1013904223) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const ENCABEZADOS = [
  ["ITEM", "DESCRIPCIÓN", "UNIDAD", "CANTIDAD", "VR. UNITARIO", "VR. TOTAL"],
  ["Ítem", "Descripción", "Und.", "Cant.", "Valor unitario", "Valor total"],
  ["Item", "Descripción", "Und.", "Metrado", "Precio S/.", "Parcial S/."],
  ["Clave", "Concepto", "Unidad", "Cantidad", "P.U.", "Importe"],
  ["Código", "Actividad", "UM", "Cantidad", "Precio unitario", "Total"],
  ["Item", "Description", "Unit", "Qty", "Unit Cost", "Total"],
];
const CAPITULOS = ["PRELIMINARES", "CIMENTACIÓN", "ESTRUCTURA", "MAMPOSTERÍA", "CUBIERTA", "INSTALACIONES HIDROSANITARIAS", "ACABADOS", "CARPINTERÍA METÁLICA"];
const PARTIDAS = ["Localización y replanteo", "Excavación manual en material común", "Concreto de 3000 psi para zapatas", "Acero de refuerzo fy=420 MPa", "Muro en bloque de concreto", "Pañete liso sobre muros", "Teja termoacústica", "Tubería PVC sanitaria 4\"", "Piso en cerámica 45x45", "Pintura en vinilo tipo 1", "Puerta metálica cal. 18", "Ventana en aluminio"];
const UNIDADES = ["m2", "m3", "ml", "kg", "un", "gl"];

function generar(semilla) {
  const r = azar(semilla);
  const elegir = (lista) => lista[Math.floor(r() * lista.length)];
  const enc = elegir(ENCABEZADOS);
  const estiloCap = elegir(["una_celda", "codigo_titulo", "padre_con_subtotal", "subtotal_al_pie", "total_capitulo", "repite_nombre", "sin_capitulos"]);
  const numeros = elegir(["numero", "texto_latino", "texto_eeuu"]);
  const cierre = elegir(["aiu", "s10", "eeuu", "ninguno"]);
  const conApu = r() < 0.3;
  const formato = (n) => {
    if (numeros === "numero") return n;
    const [ent, dec] = n.toFixed(2).split(".");
    const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, numeros === "texto_latino" ? "." : ",");
    return "$ " + miles + (numeros === "texto_latino" ? "," : ".") + dec;
  };
  const filas = [["PRESUPUESTO DE OBRA"], [], enc];
  let total = 0;
  let partidas = 0;
  const nCap = 2 + Math.floor(r() * 5);
  for (let c = 1; c <= nCap; c++) {
    const titulo = CAPITULOS[(c - 1) % CAPITULOS.length];
    const items = [];
    const nItems = 1 + Math.floor(r() * 5);
    for (let k = 1; k <= nItems; k++) {
      const cant = Math.round((1 + r() * 500) * 100) / 100;
      const pu = Math.round(1000 + r() * 900000);
      const monto = Math.round(cant * pu * 100) / 100;
      items.push([c + "." + k, elegir(PARTIDAS) + " " + c + "." + k, elegir(UNIDADES), cant, formato(pu), formato(monto)]);
      total += monto;
      partidas++;
    }
    const sumaCap = Math.round(items.reduce((s, f) => s + valor(f[5]), 0) * 100) / 100;
    if (estiloCap === "una_celda") filas.push([null, titulo]);
    if (estiloCap === "codigo_titulo") filas.push([c, titulo]);
    if (estiloCap === "padre_con_subtotal") filas.push([String(c), titulo, null, null, null, formato(sumaCap)]);
    if (["subtotal_al_pie", "total_capitulo", "repite_nombre"].includes(estiloCap)) filas.push([null, titulo]);
    filas.push(...items);
    if (estiloCap === "subtotal_al_pie") filas.push([null, "SUBTOTAL " + titulo, null, null, null, formato(sumaCap)]);
    if (estiloCap === "total_capitulo") filas.push([null, "Total capítulo " + c, null, null, null, formato(sumaCap)]);
    if (estiloCap === "repite_nombre") filas.push([null, titulo, null, null, null, formato(sumaCap)]);
  }
  const t = Math.round(total * 100) / 100;
  if (cierre === "aiu") filas.push([], [null, "COSTO DIRECTO", null, null, null, formato(t)], [null, "ADMINISTRACIÓN", "%", 0.2, null, formato(t * 0.2)], [null, "IMPREVISTOS", "%", 0.05, null, formato(t * 0.05)], [null, "UTILIDAD", "%", 0.05, null, formato(t * 0.05)], [null, "IVA SOBRE LA UTILIDAD", "%", 0.19, null, formato(t * 0.0095)], [null, "VALOR TOTAL", null, null, null, formato(t * 1.3095)]);
  if (cierre === "s10") filas.push([null, "COSTO DIRECTO", null, null, null, formato(t)], [null, "GASTOS GENERALES (10%)", null, null, null, formato(t * 0.1)], [null, "UTILIDAD (5%)", null, null, null, formato(t * 0.05)], [null, "SUB TOTAL", null, null, null, formato(t * 1.15)], [null, "IGV (18%)", null, null, null, formato(t * 0.207)], [null, "PRESUPUESTO TOTAL", null, null, null, formato(t * 1.357)]);
  if (cierre === "eeuu") filas.push([null, "Subtotal", null, null, null, formato(t)], [null, "Overhead & profit 10%", null, null, null, formato(t * 0.1)], [null, "Sales tax", null, null, null, formato(t * 0.07)], [null, "Grand Total", null, null, null, formato(t * 1.17)]);
  if (cierre === "ninguno") filas.push([null, "TOTAL", null, null, null, formato(t)]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Presupuesto");
  if (conApu) {
    const apu = [["ANÁLISIS DE PRECIOS UNITARIOS"], ["Descripción", "Unidad", "Cantidad", "Precio", "Total"]];
    for (let i = 0; i < 60; i++) apu.push(["Insumo " + i + " cemento, arena y mano de obra", "un", 1 + i, 1000, 1000 * (1 + i)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(apu), "APU");
  }
  return { bytes: new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })), partidas, total: t, descripcion: { semilla, enc: enc[1], estiloCap, numeros, cierre, conApu } };
}

function valor(v) {
  if (typeof v === "number") return v;
  const s = String(v).replace(/[$\s]/g, "");
  const latino = /,\d{2}$/.test(s);
  return parseFloat(latino ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
}

test("1.000 presupuestos con formatos combinados", () => {
  const fallos = [];
  const vistos = new Set();
  for (let semilla = 1; semilla <= 1000; semilla++) {
    const caso = generar(semilla);
    const r = leerPresupuesto(caso.bytes);
    const d = caso.descripcion;
    vistos.add([d.enc, d.estiloCap, d.numeros, d.cierre, d.conApu].join("|"));
    const suma = r.partidas ? r.partidas.reduce((s, p) => s + p.monto, 0) : NaN;
    if (r.error || r.hoja !== "Presupuesto" || r.partidas.length !== caso.partidas || Math.abs(suma - caso.total) > 0.05) {
      fallos.push({ ...caso.descripcion, esperado: [caso.partidas, caso.total], leido: r.error || [r.hoja, r.partidas.length, suma] });
    }
  }
  assert.ok(vistos.size >= 500, "el barrido debe cubrir muchas combinaciones: " + vistos.size);
  assert.equal(fallos.length, 0, fallos.length + " fallos, p. ej.: " + JSON.stringify(fallos.slice(0, 5), null, 1));
});
