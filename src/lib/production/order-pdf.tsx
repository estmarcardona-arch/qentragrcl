import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

// PDF de los documentos generados por la OP (RF-38): solicitudes, rótulos, orden de codificado y órdenes/registros de
// etapa. Carta vertical; encabezado con producto, orden, lote y versiones congeladas; tabla de líneas.

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#161B23" },
  head: { borderWidth: 1, borderColor: "#161B23", padding: 8, marginBottom: 10 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 2 },
  code: { fontFamily: "Courier-Bold", fontSize: 11 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  label: { color: "#4D596B", fontSize: 7, textTransform: "uppercase" },
  table: { borderWidth: 1, borderColor: "#C7CDD6" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E3E7EC" },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#F2F4F7", padding: 4, fontSize: 8 },
  td: { padding: 4, fontSize: 8.5 },
  label3: { borderWidth: 1.5, borderColor: "#161B23", padding: 8, marginBottom: 8, width: "48%" },
  big: { fontFamily: "Helvetica-Bold", fontSize: 14, marginVertical: 3 },
  foot: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#4D596B" },
});

export type PdfDoc = {
  title: string;
  code: string;
  meta: [string, string][];
  columns?: { key: string; label: string; width: string }[];
  rows?: Record<string, string>[];
  /** Rótulos: cada uno es una tarjeta (material, cantidad, OP, lote). */
  labels?: { title: string; qty: string; lines: string[] }[];
  note?: string;
  generatedBy: string;
  generatedAt: string;
};

export async function renderOrderPdf(d: PdfDoc) {
  return renderToBuffer(
    <Document title={`${d.code} · ${d.title}`} author="GRUFARCOL eBR">
      <Page size="LETTER" style={s.page}>
        <View style={s.head}>
          <Text style={s.title}>{d.title}</Text>
          <Text style={s.code}>{d.code}</Text>
          <View style={s.meta}>
            {d.meta.map(([k, v]) => (
              <View key={k}>
                <Text style={s.label}>{k}</Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
        </View>
        {d.columns && d.rows ? (
          <View style={s.table}>
            <View style={s.row}>
              {d.columns.map((c) => (
                <Text key={c.key} style={[s.th, { width: c.width }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {d.rows.map((r, i) => (
              <View key={i} style={s.row} wrap={false}>
                {d.columns!.map((c) => (
                  <Text key={c.key} style={[s.td, { width: c.width }]}>
                    {r[c.key] ?? ""}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}
        {d.labels ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {d.labels.map((l, i) => (
              <View key={i} style={s.label3} wrap={false}>
                <Text style={s.label}>Rótulo de dispensación y alistamiento</Text>
                <Text style={s.big}>{l.title}</Text>
                <Text style={[s.big, { fontSize: 16 }]}>{l.qty}</Text>
                {l.lines.map((x) => (
                  <Text key={x}>{x}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}
        {d.note ? <Text style={{ marginTop: 10 }}>{d.note}</Text> : null}
        <Text style={s.foot} fixed>
          Generado por {d.generatedBy} el {d.generatedAt} (hora de Bogotá) · GRUFARCOL eBR ·
          Documento generado al aprobar la orden
        </Text>
      </Page>
    </Document>,
  );
}
