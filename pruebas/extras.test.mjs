import test from "node:test";
import assert from "node:assert/strict";
import XLSXmod from "xlsx-js-style";
const XLSX = XLSXmod.utils ? XLSXmod : XLSXmod.default;
import { matrizPorFase, hojaFlujoPorFase, hojaGanttSemanal } from "../src/excelExtras.js";

// Cronograma en días (como lo calcula la herramienta): tres fases solapadas, 300 días.
const cronograma = [
  { name: "01 Preliminares", monto: 1000, inicio: 0, dias: 30, fin: 30 },
  { name: "02 Estructura", monto: 6000, inicio: 21, dias: 150, fin: 171 },
  { name: "03 Acabados", monto: 3000, inicio: 126, dias: 174, fin: 300 },
];

test("la matriz por fase reparte todo el monto de cada fase", () => {
  for (const dias of [7, 30]) {
    const { filas } = matrizPorFase(cronograma, dias, 300);
    filas.forEach((f, k) => assert.ok(Math.abs(f.reduce((a, b) => a + b, 0) - cronograma[k].monto) < 1e-6));
  }
});

test("las hojas por fase y el Gantt semanal se escriben sin errores", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaGanttSemanal(XLSX, { cronograma, horizonte: 300 }), "Gantt Semanal");
  XLSX.utils.book_append_sheet(wb, hojaFlujoPorFase(XLSX, { cronograma, periodDias: 7, etiqueta: "Semana", horizonte: 300, total: 10000, fmtMonto: "#,##0" }), "Flujo Semanal por Fase");
  XLSX.utils.book_append_sheet(wb, hojaFlujoPorFase(XLSX, { cronograma, periodDias: 30, etiqueta: "Mes", horizonte: 300, total: 10000, fmtMonto: "#,##0" }), "Flujo Mensual por Fase");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const leido = XLSX.read(bytes);
  assert.deepEqual(leido.SheetNames, ["Gantt Semanal", "Flujo Semanal por Fase", "Flujo Mensual por Fase"]);
  const m = leido.Sheets["Flujo Mensual por Fase"];
  assert.equal(m["A1"].v, "Fase");
  assert.equal(m["L5"].f, "SUM(B5:K5)"); // total del flujo del período (10 meses)
  const g = leido.Sheets["Gantt Semanal"];
  assert.equal(g["B3"].v, 4); // la estructura empieza en el día 21 → semana 4
});

import { etapaDe, ventanasConstructivas } from "../src/secuenciaConstructiva.js";

test("la secuencia constructiva reconoce los capítulos típicos", () => {
  assert.equal(etapaDe("INSTALACIONES HIDROSANITARIAS").etapa, "Instalaciones hidrosanitarias");
  assert.equal(etapaDe("APARATOS SANITARIOS").etapa, "Aparatos y equipos");
  assert.equal(etapaDe("Andén en concreto").etapa, "Obras exteriores");
  const c = etapaDe("CAP. 3 CIMENTACIÓN Y ESTRCUTURA");
  assert.deepEqual([c.ini, c.fin], [0.1, 0.6]);
});

test("las instalaciones quedan en paralelo con la obra gris", () => {
  const fases = ["Preliminares", "Estructura", "Mampostería", "Instalaciones eléctricas", "Pintura"].map((name) => ({ name, monto: 100 }));
  const v = ventanasConstructivas(fases);
  assert.ok(v[3].ini < v[2].fin && v[3].ini < v[1].fin);
  assert.equal(ventanasConstructivas([{ name: "Partida A", monto: 1 }, { name: "Partida B", monto: 1 }]), null);
});
