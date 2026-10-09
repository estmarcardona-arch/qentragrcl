import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { SECTIONS, docDate, versionLabel } from "./labels";

// PDF del documento controlado (PRD 2.5.3, RF-103): encabezado con código, versión, fechas y
// «página x de y» en cada hoja; cuerpo con las secciones mínimas; pie con historial (últimas tres
// versiones), cuadro de firmas y sello «Copia controlada», «Copia no controlada» u «OBSOLETO».

const C = {
  ink: "#161B23",
  muted: "#4D596B",
  line: "#161B23",
  soft: "#B6C1CE",
  primary: "#1E4E8C",
  sunken: "#F1F4F8",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 118,
    paddingBottom: 150,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.ink,
  },
  header: {
    position: "absolute",
    top: 30,
    left: 40,
    right: 40,
    borderWidth: 1.5,
    borderColor: C.line,
    flexDirection: "row",
  },
  logo: {
    width: 110,
    borderRightWidth: 1.5,
    borderColor: C.line,
    padding: 8,
    justifyContent: "center",
  },
  logoText: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.primary },
  title: {
    flex: 1,
    borderRightWidth: 1.5,
    borderColor: C.line,
    padding: 8,
    justifyContent: "center",
  },
  titleText: { fontFamily: "Helvetica-Bold", fontSize: 11.5, textAlign: "center" },
  meta: { width: 190, flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "50%",
    borderBottomWidth: 0.75,
    borderColor: C.soft,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  cellK: { fontSize: 6.5, color: C.muted, textTransform: "uppercase" },
  cellV: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 10 },
  h: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3, textTransform: "uppercase" },
  p: { lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 1.5,
    borderColor: C.line,
    paddingTop: 6,
  },
  small: { fontSize: 7.5, color: C.muted },
  histRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: C.soft,
    paddingVertical: 1.5,
  },
  sigs: { flexDirection: "row", borderWidth: 1, borderColor: C.line, marginTop: 5 },
  sig: { flex: 1, padding: 4 },
  stampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  stamp: {
    borderWidth: 1.5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 60,
    fontSize: 92,
    color: "#B6C1CE",
    opacity: 0.35,
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
});

export type PdfInput = {
  title: string;
  code: string;
  versionNo: number;
  issueDate: string | null;
  reviewDate: string | null;
  status: string;
  content: Record<string, string>;
  history: { version_no: number; issue_date: string | null; change_description: string }[];
  signatures: { label: string; name: string; jobTitle: string; short: string; date: string }[];
  copy: "controlada" | "no_controlada" | "obsoleto";
  /** Formatos e instructivos que se distribuyen: cuadro e historial solo en la copia de AQ (PRD 2.5.3). */
  showSignatures: boolean;
  downloadedBy: string;
  downloadedAt: string;
};

const STAMP = {
  controlada: { text: "COPIA CONTROLADA", color: C.primary },
  no_controlada: { text: "COPIA NO CONTROLADA", color: C.muted },
  obsoleto: { text: "OBSOLETO", color: C.ink },
};

export function renderDocumentPdf(d: PdfInput) {
  const stamp = STAMP[d.copy];
  const doc = (
    <Document
      title={`${d.code} v${versionLabel(d.versionNo)} · ${d.title}`}
      author="GRUFARCOL eBR"
      language="es-CO"
    >
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.logo}>
            <Text style={s.logoText}>GRUFARCOL</Text>
          </View>
          <View style={s.title}>
            <Text style={s.titleText}>{d.title}</Text>
          </View>
          <View style={s.meta}>
            {[
              ["Código", d.code],
              ["Versión", versionLabel(d.versionNo)],
              ["Fecha de emisión", docDate(d.issueDate)],
              ["Fecha de revisión", docDate(d.reviewDate)],
            ].map(([k, v]) => (
              <View key={k} style={s.cell}>
                <Text style={s.cellK}>{k}</Text>
                <Text style={s.cellV}>{v}</Text>
              </View>
            ))}
            <View style={s.cell}>
              <Text style={s.cellK}>Página</Text>
              <Text
                style={s.cellV}
                render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`}
              />
            </View>
            <View style={s.cell}>
              <Text style={s.cellK}>Estado</Text>
              <Text style={s.cellV}>{d.status}</Text>
            </View>
          </View>
        </View>

        {d.copy === "obsoleto" ? (
          <Text style={s.watermark} fixed>
            OBSOLETO
          </Text>
        ) : null}

        {SECTIONS.filter((x) => x.key in d.content).map((x, i) => (
          <View key={x.key} style={s.section} wrap={false}>
            <Text style={s.h}>
              {i + 1}. {x.label}
            </Text>
            <Text style={s.p}>{d.content[x.key] || "N.A."}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          {d.showSignatures ? (
            <>
              <Text style={[s.small, { fontFamily: "Helvetica-Bold" }]}>
                HISTORIAL DE ACTUALIZACIONES
              </Text>
              {d.history.slice(0, 3).map((h) => (
                <View key={h.version_no} style={s.histRow}>
                  <Text style={[s.small, { width: 40 }]}>{versionLabel(h.version_no)}</Text>
                  <Text style={[s.small, { width: 70 }]}>{docDate(h.issue_date)}</Text>
                  <Text style={[s.small, { flex: 1 }]}>{h.change_description}</Text>
                </View>
              ))}
              <View style={s.sigs}>
                {d.signatures.map((g, i) => (
                  <View
                    key={g.label}
                    style={[s.sig, i < 2 ? { borderRightWidth: 1, borderColor: C.line } : {}]}
                  >
                    <Text style={s.cellK}>{g.label}</Text>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>
                      {g.name || "Pendiente"}
                    </Text>
                    <Text style={s.small}>{g.jobTitle}</Text>
                    <Text style={s.small}>{g.short ? `${g.short} · ${g.date}` : ""}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          <View style={s.stampRow}>
            <Text style={s.small}>
              Descargado por {d.downloadedBy} el {d.downloadedAt}
            </Text>
            <Text style={[s.stamp, { color: stamp.color, borderColor: stamp.color }]}>
              {stamp.text}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

export function renderCertificatePdf(d: {
  person: string;
  code: string;
  versionNo: number;
  title: string;
  score: number | null;
  passScore: number;
  date: string;
  certificate: string;
  trainer: string;
}) {
  const doc = (
    <Document title={`Constancia ${d.certificate}`} author="GRUFARCOL eBR" language="es-CO">
      <Page
        size="LETTER"
        orientation="landscape"
        style={{ padding: 60, fontFamily: "Helvetica", color: C.ink }}
      >
        <View
          style={{
            borderWidth: 2,
            borderColor: C.primary,
            padding: 40,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: C.primary }}>
            GRUFARCOL · Aseguramiento de la calidad
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 28, marginTop: 24 }}>
            Constancia de capacitación
          </Text>
          <Text style={{ fontSize: 13, marginTop: 24, lineHeight: 1.5 }}>
            Se hace constar que {d.person} aprobó la capacitación del documento {d.code} versión{" "}
            {versionLabel(d.versionNo)} «{d.title}»
            {d.score != null
              ? ` con ${d.score} % (mínimo ${d.passScore} %)`
              : " con la confirmación de lectura"}
            .
          </Text>
          <Text style={{ fontSize: 11, marginTop: 24, color: C.muted }}>
            Fecha: {d.date} · Divulgó: {d.trainer} · Constancia {d.certificate}
          </Text>
          <Text style={{ fontSize: 9, marginTop: 40, color: C.muted }}>
            Registro de capacitación y entrenamiento generado por GRUFARCOL eBR. Verifique la
            vigencia del documento en el listado maestro.
          </Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
