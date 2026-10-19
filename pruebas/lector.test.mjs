// Pruebas del lector de presupuestos: `npm test`.
// Cada caso comprueba que se lean solo las partidas de obra (sin capítulos, subtotales,
// totales ni rubros de cierre) y que el total coincida con el del archivo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSXmod from "xlsx-js-style";
import { leerPresupuesto } from "../src/lectorPresupuesto.js";

const XLSX = XLSXmod.read ? XLSXmod : XLSXmod.default;

function libro(hojas) {
  const wb = XLSX.utils.book_new();
  for (const [nombre, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}
const csv = (texto) => new TextEncoder().encode(texto);
const suma = (r) => r.partidas.reduce((s, p) => s + p.monto, 0);
const nombres = (r) => r.partidas.map((p) => p.name);

function verificar(r, { partidas, total, excluidas = [], hoja }) {
  assert.ok(!r.error, "error de lectura: " + r.error);
  if (hoja) assert.equal(r.hoja, hoja, "hoja elegida");
  assert.equal(r.partidas.length, partidas, "número de partidas: " + JSON.stringify(nombres(r)));
  assert.ok(Math.abs(suma(r) - total) < 0.01, "total " + suma(r) + " ≠ " + total);
  for (const t of excluidas) assert.ok(!nombres(r).some((n) => n.toUpperCase().startsWith(t.toUpperCase())), "no debía leerse como partida: " + t);
}

// ------------------------------------------------------------ presupuestos oficiales reales (SECOP II)

const archivo = (n) => new Uint8Array(fs.readFileSync(new URL("./archivos/" + n, import.meta.url)));

test("SECOP II · formulario de oferta económica (Mosquera)", () => {
  verificar(leerPresupuesto(archivo("secop_mosquera_oferta_economica.xlsx")), { partidas: 217, total: 1052785005, excluidas: ["VALOR TOTAL", "SUBTOTAL"] });
});

// El urbanismo viene como un solo ítem (12) con el detalle en otra hoja: es obra, no AIU.
test("SECOP II · presupuesto con cantidades por vivienda y AIU (Caldas)", () => {
  const r = leerPresupuesto(archivo("secop_caldas_salamina.xlsx"));
  verificar(r, { partidas: 67, total: 1337880874, hoja: "PRESUPUESTO SALAMINA", excluidas: ["REALIZAR OBRAS PRELIMINARES", "COSTO DIRECTO VIVIENDAS", "COSTO TOTAL", "(A) - ADMINISTRACI"] });
  const urbanismo = r.partidas.find((p) => p.codigo === "12");
  assert.ok(urbanismo, "falta el ítem 12 de urbanismo");
  assert.match(urbanismo.capitulo, /^12 /, "el urbanismo quedó en otro capítulo");
  assert.ok(r.partidas.every((p) => !/\d\.\d{7,}/.test(p.codigo || "")), "códigos con error de coma flotante");
});

test("SECOP II · formulario 1 con hoja de la entidad y hoja del proponente (IDIGER)", () => {
  verificar(leerPresupuesto(archivo("secop_idiger_formulario1.xlsx")), { partidas: 81, total: 481825169, hoja: "PRESUPUESTO OFICIAL (Entidad)", excluidas: ["ADMINISTRACI", "UTILIDAD", "IVA"] });
});

test("SECOP II · presupuesto del CDI pasado de PDF a Excel (Nobsa)", () => {
  verificar(leerPresupuesto(archivo("secop_nobsa_cdi.xlsx")), { partidas: 98, total: 4065402558 });
});

test("SECOP II · capítulos «número | título» reconocidos para agrupar las partidas", () => {
  for (const [f, n] of [["secop_mosquera_oferta_economica.xlsx", 20], ["secop_idiger_formulario1.xlsx", 9], ["secop_nobsa_cdi.xlsx", 18], ["secop_caldas_salamina.xlsx", 12]]) {
    const r = leerPresupuesto(archivo(f));
    assert.equal(r.capitulos, n, f);
    assert.ok(r.partidas.every((p) => p.capitulo || p.categoria), f + ": hay partidas sin capítulo");
  }
});

// ------------------------------------------------------------ formatos habituales

test("S10 (Perú): capítulos y subcapítulos con parcial propio, gastos generales e IGV", () => {
  const r = leerPresupuesto(libro({
    Presupuesto: [
      ["Presupuesto", "0101001 VIVIENDA MULTIFAMILIAR"],
      ["Cliente", "MUNICIPALIDAD"],
      [],
      ["Item", "Descripción", "Und.", "Metrado", "Precio S/.", "Parcial S/."],
      ["01", "OBRAS PROVISIONALES", null, null, null, 3500],
      ["01.01", "TRABAJOS PRELIMINARES", null, null, null, 3500],
      ["01.01.01", "Cartel de obra 3.60x2.40", "und", 1, 1500, 1500],
      ["01.01.02", "Limpieza de terreno manual", "m2", 400, 5, 2000],
      ["02", "ESTRUCTURAS", null, null, null, 30000],
      ["02.01", "Concreto f'c=210 kg/cm2 en zapatas", "m3", 20, 1000, 20000],
      ["02.02", "Acero fy=4200 kg/cm2", "kg", 2000, 5, 10000],
      [],
      ["", "COSTO DIRECTO", null, null, null, 33500],
      ["", "GASTOS GENERALES (10%)", null, null, null, 3350],
      ["", "UTILIDAD (5%)", null, null, null, 1675],
      ["", "SUB TOTAL", null, null, null, 38525],
      ["", "IGV (18%)", null, null, null, 6934.5],
      ["", "PRESUPUESTO TOTAL", null, null, null, 45459.5],
    ],
  }));
  verificar(r, { partidas: 4, total: 33500, excluidas: ["OBRAS PROVISIONALES", "TRABAJOS PRELIMINARES", "ESTRUCTURAS", "GASTOS", "IGV"] });
});

test("Colombia: capítulo con código, subtotal al pie de cada capítulo y AIU", () => {
  const r = leerPresupuesto(libro({
    Presupuesto: [
      ["ITEM", "DESCRIPCIÓN", "UNIDAD", "CANTIDAD", "VR. UNITARIO", "VR. TOTAL"],
      [1, "PRELIMINARES"],
      ["1.1", "Localización y replanteo", "m2", 100, 5000, 500000],
      ["1.2", "Campamento", "un", 1, 2000000, 2000000],
      ["", "SUBTOTAL PRELIMINARES", null, null, null, 2500000],
      [2, "CIMENTACIÓN"],
      ["2.1", "Excavación manual", "m3", 50, 40000, 2000000],
      ["2.2", "Concreto ciclópeo", "m3", 20, 400000, 8000000],
      ["", "Total capítulo 2", null, null, null, 10000000],
      [3, "ESTRUCTURA", null, null, null, 6000000],
      ["3.1", "Columnas en concreto 3000 psi", "m3", 4, 1500000, 6000000],
      ["", "COSTO DIRECTO", null, null, null, 18500000],
      ["", "ADMINISTRACIÓN", "%", 0.2, null, 3700000],
      ["", "IMPREVISTOS", "%", 0.05, null, 925000],
      ["", "UTILIDAD", "%", 0.05, null, 925000],
      ["", "IVA SOBRE LA UTILIDAD", "%", 0.19, null, 175750],
      ["", "VALOR TOTAL", null, null, null, 24225750],
    ],
  }));
  verificar(r, { partidas: 5, total: 18500000, excluidas: ["PRELIMINARES", "SUBTOTAL", "Total capítulo", "ESTRUCTURA", "ADMINISTRACI", "IMPREVISTOS", "IVA"] });
});

test("Subtotal de capítulo al pie, sin la palabra «subtotal» (repite el nombre del capítulo)", () => {
  const r = leerPresupuesto(libro({
    Presupuesto: [
      ["Descripción", "Unidad", "Cantidad", "Precio unitario", "Total"],
      ["MAMPOSTERÍA"],
      ["Muro en bloque #5", "m2", 100, 50000, 5000000],
      ["Dintel en concreto", "ml", 20, 50000, 1000000],
      ["MAMPOSTERÍA", null, null, null, 6000000],
      ["PAÑETES"],
      ["Pañete liso muros", "m2", 200, 20000, 4000000],
      ["Filos y dilataciones", "ml", 100, 10000, 1000000],
      ["PAÑETES", null, null, null, 5000000],
      ["TOTAL", null, null, null, 11000000],
    ],
  }));
  verificar(r, { partidas: 4, total: 11000000 });
});

// General conditions es costo real de obra (como el campamento o la administración de obra) y se
// conserva; overhead, profit y bond se calculan sobre el costo directo y quedan fuera.
test("Estados Unidos: divisiones, subtotales, overhead, contingencia y grand total", () => {
  const r = leerPresupuesto(libro({
    Estimate: [
      ["Project:", "Retail build-out"],
      ["Item", "Description", "Qty", "Unit", "Unit Cost", "Total"],
      ["", "DIVISION 03 - CONCRETE"],
      ["03-100", "Slab on grade 4\"", 2000, "SF", 8, 16000],
      ["03-200", "Footings", 30, "CY", 600, 18000],
      ["", "Subtotal Division 03", null, null, null, 34000],
      ["", "DIVISION 09 - FINISHES"],
      ["09-100", "Gypsum board partitions", 3000, "SF", 4, 12000],
      ["09-200", "Paint", 6000, "SF", 1.5, 9000],
      ["", "Subtotal Division 09", null, null, null, 21000],
      ["", "General conditions", null, null, null, 5500],
      ["", "Overhead & profit 10%", null, null, null, 6050],
      ["", "Bond", null, null, null, 600],
      ["", "Grand Total", null, null, null, 67150],
    ],
  }));
  verificar(r, { partidas: 5, total: 60500, excluidas: ["Subtotal", "DIVISION", "Overhead", "Bond", "Grand Total"] });
});

test("México: clave, concepto, importe, total por partida e IVA", () => {
  const r = leerPresupuesto(libro({
    Catalogo: [
      ["CATÁLOGO DE CONCEPTOS"],
      ["Clave", "Concepto", "Unidad", "Cantidad", "P.U.", "Importe"],
      ["A", "PRELIMINARES"],
      ["A-01", "Trazo y nivelación", "m2", 500, 12.5, 6250],
      ["A-02", "Despalme", "m3", 100, 85, 8500],
      ["", "Total PRELIMINARES", null, null, null, 14750],
      ["B", "ALBAÑILERÍA"],
      ["B-01", "Muro de block 15 cm", "m2", 300, 450, 135000],
      ["", "Total ALBAÑILERÍA", null, null, null, 135000],
      ["", "SUBTOTAL", null, null, null, 149750],
      ["", "IVA 16%", null, null, null, 23960],
      ["", "TOTAL", null, null, null, 173710],
    ],
  }));
  verificar(r, { partidas: 3, total: 149750 });
});

test("Libro con hojas de APU más largas que el presupuesto: se analiza el presupuesto", () => {
  const apu = [["ANÁLISIS DE PRECIOS UNITARIOS"], ["Descripción", "Unidad", "Cantidad", "Precio", "Total"]];
  for (let i = 1; i <= 40; i++) {
    apu.push(["ITEM " + i + " - Partida de obra " + i]);
    apu.push(["Cemento gris 50 kg", "bulto", 2, 30000, 60000]);
    apu.push(["Arena de pega", "m3", 0.1, 80000, 8000]);
    apu.push(["Oficial y ayudante", "hc", 0.5, 40000, 20000]);
    apu.push(["Herramienta menor (5% MO)", "%", 0.05, 20000, 1000]);
  }
  const r = leerPresupuesto(libro({
    "Presupuesto": [
      ["ITEM", "DESCRIPCIÓN", "UND", "CANTIDAD", "VALOR UNITARIO", "VALOR TOTAL"],
      ["1", "PRELIMINARES"],
      ["1.1", "Localización y replanteo", "m2", 100, 5000, 500000],
      ["1.2", "Descapote", "m2", 100, 3000, 300000],
      ["2", "MAMPOSTERÍA"],
      ["2.1", "Muro en ladrillo", "m2", 50, 80000, 4000000],
      ["", "TOTAL COSTO DIRECTO", null, null, null, 4800000],
    ],
    "APU": apu,
  }));
  verificar(r, { partidas: 3, total: 4800000, hoja: "Presupuesto" });
});

test("Montos escritos como texto con formato latino y signo de pesos", () => {
  const r = leerPresupuesto(libro({
    Hoja1: [
      ["Ítem", "Descripción", "Und", "Cant.", "Vr. Unitario", "Vr. Total"],
      ["1", "Demolición de muros", "m2", "10", "$ 25.000", "$ 250.000"],
      ["2", "Retiro de escombros", "m3", "5", "$ 40.000,50", "$ 200.002,50"],
      ["3", "Pintura de fachada", "m2", "120", "$ 18.500", "$ 2.220.000"],
      ["", "TOTAL", "", "", "", "$ 2.670.002,50"],
    ],
  }));
  verificar(r, { partidas: 3, total: 2670002.5 });
});

test("CSV con punto y coma", () => {
  const r = leerPresupuesto(csv("Código;Descripción;Unidad;Cantidad;Precio unitario;Total\n1.1;Excavación;m3;10;50000;500000\n1.2;Relleno;m3;8;30000;240000\n;Subtotal;;;;740000\n;IVA 19%;;;;140600\n;Total;;;;880600\n"));
  verificar(r, { partidas: 2, total: 740000 });
});

test("Solo cantidad y precio unitario, sin columna de total", () => {
  const r = leerPresupuesto(libro({
    Hoja1: [
      ["Item", "Descripción", "Unidad", "Cantidad", "Precio unitario"],
      ["1", "Cubierta en teja termoacústica", "m2", 200, 90000],
      ["2", "Canal en lámina galvanizada", "ml", 40, 60000],
    ],
  }));
  verificar(r, { partidas: 2, total: 20400000 });
});
