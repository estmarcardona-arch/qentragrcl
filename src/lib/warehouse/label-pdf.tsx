import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

// Rótulo del lote en PDF, 10 × 7 cm (S-14, RF-20 v1.9): estado legible a un metro, ubicación, código interno,
// material, lote del proveedor, vencimiento, empaques, orden de compra, almacenamiento y QR.

const MM = 2.8346;
const BANDS: Record<string, { bg: string; fg: string }> = {
  cuarentena: { bg: "#FFF1D6", fg: "#7A4A00" },
  aprobado: { bg: "#E6F4EA", fg: "#1B6B3A" },
  rechazado: { bg: "#FDE8E8", fg: "#A4262C" },
  vencido: { bg: "#FDE8E8", fg: "#A4262C" },
};

const s = StyleSheet.create({
  page: { padding: 7, fontFamily: "Helvetica", fontSize: 7, color: "#161B23" },
  frame: { borderWidth: 1.5, borderColor: "#161B23", padding: 5, height: "100%" },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
  },
  band: { marginTop: 4, borderWidth: 1.5, alignItems: "center", paddingVertical: 4 },
  bandText: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: 1 },
  body: { flexDirection: "row", marginTop: 4, gap: 6 },
  label: { fontSize: 5.5, color: "#4D596B", textTransform: "uppercase" },
  loc: { fontFamily: "Courier-Bold", fontSize: 14 },
  code: { fontFamily: "Courier-Bold", fontSize: 10 },
  mono: { fontFamily: "Courier-Bold" },
  foot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    borderTopWidth: 0.5,
    borderColor: "#B6C1CE",
    paddingTop: 2,
  },
});

export type LabelPdfData = {
  kind: string;
  received: string;
  state: string;
  band: string;
  note: string;
  location: string;
  code: string;
  material: string;
  supplierLot: string;
  expiryLabel: string;
  expiry: string;
  qty: string;
  packages: string | null;
  purchaseOrder: string | null;
  storage: string | null;
  supplier: string;
  qrDataUrl: string;
};

export async function renderLabelPdf(d: LabelPdfData) {
  const c = BANDS[d.state] ?? BANDS.cuarentena;
  const doc = (
    <Document title={`Rótulo ${d.code}`} author="GRUFARCOL eBR">
      <Page size={[100 * MM, 70 * MM]} style={s.page}>
        <View style={s.frame}>
          <View style={s.head}>
            <Text>GRUFARCOL · {d.kind}</Text>
            <Text>Recibido {d.received}</Text>
          </View>
          <View style={[s.band, { backgroundColor: c.bg, borderColor: c.fg }]}>
            <Text style={[s.bandText, { color: c.fg }]}>{d.band}</Text>
          </View>
          <View style={s.body}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.label}>Ubicación</Text>
              <Text style={s.loc}>{d.location}</Text>
              <Text style={s.label}>Código interno</Text>
              <Text style={s.code}>{d.code}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{d.material}</Text>
              <Text>
                Lote proveedor <Text style={s.mono}>{d.supplierLot}</Text> · {d.expiryLabel}{" "}
                <Text style={s.mono}>{d.expiry}</Text>
              </Text>
              <Text>
                Cantidad <Text style={s.mono}>{d.qty}</Text>
                {d.packages ? ` · ${d.packages}` : ""}
                {d.purchaseOrder ? ` · OC ${d.purchaseOrder}` : ""}
              </Text>
              {d.storage ? <Text>Almacenamiento: {d.storage}</Text> : null}
            </View>
            <View style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt */}
              <Image src={d.qrDataUrl} style={{ width: 22 * MM, height: 22 * MM }} />
              <Text style={[s.mono, { fontSize: 6 }]}>{d.code}</Text>
            </View>
          </View>
          <View style={s.foot}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.note}</Text>
            <Text>{d.supplier}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
