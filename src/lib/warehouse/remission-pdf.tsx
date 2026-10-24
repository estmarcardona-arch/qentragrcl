import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

// Remisión del traslado (RF-25): origen, destino (y tercero), líneas con lote y cantidad, motivo y firmas de
// despacho y recepción. La genera la plataforma; la firma de recepción del maquilador queda en el acta.

const C = { ink: "#161B23", muted: "#4D596B", line: "#161B23", soft: "#B6C1CE", sunken: "#F1F4F8" };

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderColor: C.line,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  code: { fontSize: 14, fontFamily: "Courier-Bold" },
  row: { flexDirection: "row", marginTop: 10, gap: 16 },
  box: { flex: 1, borderWidth: 1, borderColor: C.soft, padding: 8 },
  label: { fontSize: 8, color: C.muted, textTransform: "uppercase", marginBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginTop: 14, borderWidth: 1, borderColor: C.line },
  tr: { flexDirection: "row", borderTopWidth: 1, borderColor: C.soft },
  th: { flexDirection: "row", backgroundColor: C.sunken },
  cell: { padding: 5, fontSize: 9 },
  mono: { fontFamily: "Courier" },
  sigs: { flexDirection: "row", marginTop: 20, gap: 10 },
  sig: { flex: 1, borderWidth: 1, borderColor: C.line, padding: 8, minHeight: 64 },
  foot: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: C.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export type RemissionData = {
  code: string;
  status: string;
  from: string;
  to: string;
  party: string | null;
  address: string | null;
  reason: string;
  lines: {
    lot: string;
    supplierLot: string;
    material: string;
    qty: string;
    from: string;
    to: string;
  }[];
  signatures: { label: string; name: string; date: string }[];
  receptionRef: string | null;
  generatedBy: string;
  generatedAt: string;
};

export async function renderRemissionPdf(d: RemissionData) {
  const cols = [
    { w: "16%", k: "lot" as const, h: "Código interno" },
    { w: "16%", k: "supplierLot" as const, h: "Lote proveedor" },
    { w: "26%", k: "material" as const, h: "Material" },
    { w: "12%", k: "qty" as const, h: "Cantidad" },
    { w: "15%", k: "from" as const, h: "Origen" },
    { w: "15%", k: "to" as const, h: "Destino" },
  ];
  const doc = (
    <Document title={`Remisión ${d.code}`} author="GRUFARCOL eBR">
      <Page size="LETTER" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>Remisión de traslado</Text>
            <Text style={{ color: C.muted }}>GRUFARCOL · Bodega</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.code}>{d.code}</Text>
            <Text>{d.status}</Text>
          </View>
        </View>
        <View style={s.row}>
          <View style={s.box}>
            <Text style={s.label}>Origen</Text>
            <Text style={s.bold}>{d.from}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.label}>Destino</Text>
            <Text style={s.bold}>{d.to}</Text>
            {d.party ? <Text>Tercero: {d.party}</Text> : null}
            {d.address ? <Text>{d.address}</Text> : null}
          </View>
        </View>
        <View style={[s.box, { marginTop: 10 }]}>
          <Text style={s.label}>Motivo</Text>
          <Text>{d.reason}</Text>
        </View>
        <View style={s.table}>
          <View style={s.th}>
            {cols.map((c) => (
              <Text key={c.k} style={[s.cell, s.bold, { width: c.w }]}>
                {c.h}
              </Text>
            ))}
          </View>
          {d.lines.map((l, i) => (
            <View key={i} style={s.tr}>
              {cols.map((c) => (
                <Text key={c.k} style={[s.cell, { width: c.w }, c.k !== "material" ? s.mono : {}]}>
                  {l[c.k]}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <View style={s.sigs}>
          {d.signatures.map((g) => (
            <View key={g.label} style={s.sig}>
              <Text style={s.label}>{g.label}</Text>
              <Text style={s.bold}>{g.name || " "}</Text>
              <Text>{g.date}</Text>
            </View>
          ))}
        </View>
        {d.receptionRef ? (
          <Text style={{ marginTop: 8 }}>Acta de recepción: {d.receptionRef}</Text>
        ) : null}
        <View style={s.foot} fixed>
          <Text>
            Generada por {d.generatedBy} · {d.generatedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
