// PDF de la factura electrónica (KuDE) y del presupuesto, armado en el
// navegador: no usa el servidor. Replica el formato del talonario de papel
// (encabezado en dos recuadros, datos del cliente, tabla con columnas
// Exentas / 5 % / 10 %, total en letras y liquidación del IVA) y agrega lo que
// exige la factura electrónica: QR y CDC.
//
// Este archivo carga @react-pdf/renderer (pesado): importarlo SIEMPRE con
// `await import("…/invoice-pdf")` en el momento de generar el PDF, nunca arriba
// de un componente, para que no entre en la carga normal del panel.
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Invoice, InvoiceIssuer, InvoiceSettings, Rental } from "../types";
import {
  computeTotals,
  formatCalendarDate,
  formatInvoiceNumber,
  formatLongDate,
  formatThousands,
  linesFromRental,
  numberToSpanishWords,
  type InvoiceLine,
} from "./invoice";

// react-pdf no parte una palabra larguísima sin espacios (una dirección pegada, por ejemplo):
// se sale del recuadro. Se le agregan espacios cada 28 caracteres solo en ese caso extremo.
const softWrap = (text: string) => text.replace(/\S{28,}/g, (word) => word.match(/.{1,28}/g)!.join(" "));

const NAVY = "#004080";
const INK = "#0f172a";
const LINE = "#334155";
const SOFT = "#e8f0f8";

const s = StyleSheet.create({
  page: { padding: 26, fontSize: 8.5, fontFamily: "Helvetica", color: INK },
  row: { flexDirection: "row" },
  box: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 7 },
  banner: { borderWidth: 1.5, borderColor: "#dc2626", color: "#dc2626", fontFamily: "Helvetica-Bold", textAlign: "center", fontSize: 11, padding: 5, marginBottom: 8, borderRadius: 4 },
  tradeName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  docTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "center", marginVertical: 5 },
  th: { backgroundColor: SOFT, fontFamily: "Helvetica-Bold", fontSize: 7.5, textAlign: "center", paddingVertical: 4 },
  cell: { paddingVertical: 3, paddingHorizontal: 4, borderRightWidth: 1, borderColor: LINE },
  num: { textAlign: "right" },
});

// Anchos de las columnas de la tabla (suman 100 %).
const COLS = { qty: "8%", desc: "39%", unit: "14%", ex: "13%", five: "13%", ten: "13%" } as const;

interface DocData {
  kind: "FACTURA" | "PRESUPUESTO";
  banner?: string;
  issuer: InvoiceIssuer;
  logoUrl: string;
  /** Recuadro derecho del encabezado: renglones "etiqueta: valor". */
  stamp: [string, string][];
  numberLabel: string;
  /** Recuadro de datos del cliente. */
  dateLabel: string;
  condition?: "CONTADO" | "CREDITO";
  customer: [string, string][];
  lines: InvoiceLine[];
  footer: { cdc: string; qrDataUrl: string } | { note: string };
}

const Checkbox = ({ checked }: { checked: boolean }) => (
  <View style={{ width: 9, height: 9, borderWidth: 1, borderColor: LINE, marginLeft: 3, alignItems: "center", justifyContent: "center" }}>
    {checked && <Text style={[s.bold, { fontSize: 7, lineHeight: 1 }]}>X</Text>}
  </View>
);

function FiscalDocument({ d }: { d: DocData }) {
  const totals = computeTotals(d.lines);
  const money = (n: number) => (n ? formatThousands(n) : "");
  const activities = d.issuer.activities.split("\n").filter(Boolean);

  return (
    <Document title={`${d.kind === "FACTURA" ? "Factura" : "Presupuesto"} ${d.numberLabel}`} author={d.issuer.tradeName}>
      <Page size="A4" style={s.page}>
        {d.banner && <Text style={s.banner}>{d.banner}</Text>}

        {/* Encabezado: emisor (izquierda) y timbrado / número (derecha) */}
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <View style={[s.box, { flex: 1.65, flexDirection: "row", gap: 8 }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no es un <img> HTML */}
            <Image src={d.logoUrl} style={{ width: 58, height: 58 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.tradeName}>{d.issuer.tradeName.toUpperCase()}</Text>
              {d.issuer.slogan && <Text style={[s.bold, { color: NAVY, fontSize: 8.5 }]}>{d.issuer.slogan.toUpperCase()}</Text>}
              <Text style={[s.bold, { marginTop: 2 }]}>de {d.issuer.businessName}</Text>
              {activities.map((a) => (
                <Text key={a} style={s.small}>* {a}</Text>
              ))}
              {d.issuer.phone && <Text style={[s.bold, { marginTop: 3 }]}>Cel.: {d.issuer.phone}</Text>}
              <Text style={s.small}>{d.issuer.address} - {d.issuer.city} - Paraguay</Text>
              {d.issuer.email && <Text style={s.small}>{d.issuer.email}</Text>}
            </View>
          </View>
          <View style={[s.box, { flex: 1, justifyContent: "center" }]}>
            {d.stamp.map(([label, value]) => (
              <Text key={label} style={{ marginBottom: 1.5 }}>
                {label}: <Text style={s.bold}>{value}</Text>
              </Text>
            ))}
            <Text style={s.docTitle}>{d.kind === "FACTURA" ? "FACTURA ELECTRÓNICA" : "PRESUPUESTO"}</Text>
            <Text style={[s.bold, { fontSize: 12, textAlign: "center" }]}>{d.numberLabel}</Text>
          </View>
        </View>

        {/* Datos de la operación y del cliente */}
        <View style={[s.box, { marginBottom: 8, gap: 3 }]}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text>{d.dateLabel}</Text>
            {d.condition && (
              <View style={[s.row, { alignItems: "center" }]}>
                <Text>Condición de venta: Contado</Text>
                <Checkbox checked={d.condition === "CONTADO"} />
                <Text style={{ marginLeft: 6 }}>Crédito</Text>
                <Checkbox checked={d.condition === "CREDITO"} />
              </View>
            )}
          </View>
          {d.customer.map(([label, value]) => (
            <Text key={label}>
              {label}: <Text style={s.bold}>{softWrap(value)}</Text>
            </Text>
          ))}
        </View>

        {/* Detalle */}
        <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" }}>
          <View style={[s.row, { borderBottomWidth: 1, borderColor: LINE }]}>
            <Text style={[s.th, s.cell, { width: COLS.qty }]}>CANT.</Text>
            <Text style={[s.th, s.cell, { width: COLS.desc }]}>DESCRIPCIÓN</Text>
            <Text style={[s.th, s.cell, { width: COLS.unit }]}>PRECIO UNITARIO</Text>
            <Text style={[s.th, s.cell, { width: COLS.ex }]}>EXENTAS</Text>
            <Text style={[s.th, s.cell, { width: COLS.five }]}>5 %</Text>
            <Text style={[s.th, s.cell, { width: COLS.ten, borderRightWidth: 0 }]}>10 %</Text>
          </View>
          {d.lines.map((l, i) => {
            const total = l.quantity * l.unitPrice;
            return (
              <View key={i} style={[s.row, { borderBottomWidth: 0.5, borderColor: "#cbd5e1" }]} wrap={false}>
                <Text style={[s.cell, { width: COLS.qty, textAlign: "center" }]}>{l.quantity}</Text>
                <Text style={[s.cell, { width: COLS.desc }]}>{softWrap(l.description)}</Text>
                <Text style={[s.cell, s.num, { width: COLS.unit }]}>{formatThousands(l.unitPrice)}</Text>
                <Text style={[s.cell, s.num, { width: COLS.ex }]}>{l.ivaRate === 0 ? money(total) : ""}</Text>
                <Text style={[s.cell, s.num, { width: COLS.five }]}>{l.ivaRate === 5 ? money(total) : ""}</Text>
                <Text style={[s.cell, s.num, { width: COLS.ten, borderRightWidth: 0 }]}>{l.ivaRate === 10 ? money(total) : ""}</Text>
              </View>
            );
          })}
          {/* Subtotales por tasa */}
          <View style={[s.row, { borderTopWidth: 1, borderColor: LINE }]} wrap={false}>
            <Text style={[s.cell, s.bold, { width: "61%" }]}>SUBTOTALES:</Text>
            <Text style={[s.cell, s.num, { width: COLS.ex }]}>{money(totals.exempt)}</Text>
            <Text style={[s.cell, s.num, { width: COLS.five }]}>{money(totals.taxed5)}</Text>
            <Text style={[s.cell, s.num, { width: COLS.ten, borderRightWidth: 0 }]}>{money(totals.taxed10)}</Text>
          </View>
          <View style={[s.row, { borderTopWidth: 1, borderColor: LINE, backgroundColor: SOFT }]} wrap={false}>
            <Text style={[s.cell, { width: "87%" }]}>
              <Text style={s.bold}>TOTAL A PAGAR Gs.: </Text>
              {numberToSpanishWords(totals.total)}
            </Text>
            <Text style={[s.cell, s.num, s.bold, { width: COLS.ten, borderRightWidth: 0, fontSize: 9.5 }]}>{formatThousands(totals.total)}</Text>
          </View>
          <View style={[s.row, { borderTopWidth: 1, borderColor: LINE }]} wrap={false}>
            <Text style={[s.cell, { width: "35%" }]}>
              <Text style={s.bold}>LIQUIDACIÓN DEL I.V.A.: </Text>(5 %) {formatThousands(totals.iva5)}
            </Text>
            <Text style={[s.cell, { width: "30%" }]}>(10 %) {formatThousands(totals.iva10)}</Text>
            <Text style={[s.cell, s.bold, { width: "35%", borderRightWidth: 0, textAlign: "right" }]}>
              TOTAL I.V.A.: {formatThousands(totals.iva5 + totals.iva10)}
            </Text>
          </View>
        </View>

        {/* Pie: QR + CDC (factura) o aclaración (presupuesto) */}
        {"cdc" in d.footer ? (
          <View style={[s.box, s.row, { marginTop: 10, gap: 10, alignItems: "center" }]} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no es un <img> HTML */}
            <Image src={d.footer.qrDataUrl} style={{ width: 78, height: 78 }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text>Consulte la validez de esta Factura Electrónica con el número de CDC impreso abajo en:</Text>
              <Text style={[s.bold, { color: NAVY }]}>https://ekuatia.set.gov.py/consultas/</Text>
              <Text style={[s.bold, { fontSize: 10, letterSpacing: 0.5 }]}>CDC: {d.footer.cdc.replace(/(\d{4})(?=\d)/g, "$1 ")}</Text>
              <Text style={s.small}>ESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)</Text>
              <Text style={s.small}>
                Si su documento electrónico presenta algún error, podrá solicitar la modificación dentro de las 72 horas siguientes de la emisión de este comprobante.
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[s.small, { marginTop: 10, textAlign: "center" }]}>{d.footer.note}</Text>
        )}
      </Page>
    </Document>
  );
}

const logoUrl = () => `${window.location.origin}/logo-512.png`;

const render = (d: DocData) => pdf(<FiscalDocument d={d} />).toBlob();

/** KuDE (representación gráfica) de una factura emitida. */
export async function invoicePdf(invoice: Invoice): Promise<Blob> {
  const docLabel = invoice.customerType === "RUC" ? "R.U.C." : invoice.customerType === "CI" ? "C.I. Nº" : "R.U.C. / C.I. Nº";
  const customer: [string, string][] = [
    [docLabel, invoice.customerDocument ?? "—"],
    ["Nombre o razón social", invoice.customerName],
  ];
  if (invoice.customerAddress) customer.push(["Dirección", invoice.customerAddress]);
  if (invoice.customerPhone) customer.push(["Teléfono", invoice.customerPhone]);
  if (invoice.customerEmail) customer.push(["Correo", invoice.customerEmail]);

  const banner =
    invoice.status === "ANULADA"
      ? "FACTURA ANULADA"
      : invoice.environment === "PRUEBA"
        ? "DOCUMENTO DE PRUEBA — SIN VALIDEZ FISCAL"
        : undefined;

  return render({
    kind: "FACTURA",
    banner,
    issuer: invoice.issuer,
    logoUrl: logoUrl(),
    stamp: [
      ["Timbrado Nº", invoice.timbrado || "—"],
      ["Fecha de inicio de vigencia", invoice.issuer.timbradoStart ? formatCalendarDate(invoice.issuer.timbradoStart) : "—"],
      ["R.U.C.", invoice.issuer.ruc],
    ],
    numberLabel: formatInvoiceNumber(invoice),
    dateLabel: `Fecha de emisión: ${formatLongDate(invoice.issuedAt)}`,
    condition: invoice.condition,
    customer,
    lines: invoice.items,
    footer: invoice.cdc
      ? { cdc: invoice.cdc, qrDataUrl: await QRCode.toDataURL(invoice.qrUrl || invoice.cdc, { margin: 0, width: 300 }) }
      : { note: "Factura sin aprobación de la DNIT: no tiene validez fiscal." },
  });
}

export const invoiceFileName = (invoice: Invoice) =>
  `Factura-${formatInvoiceNumber(invoice)}${invoice.environment === "PRUEBA" ? "-PRUEBA" : ""}.pdf`;

/** Presupuesto (sin validez fiscal) de un alquiler todavía sin confirmar o ya confirmado. */
export function quotePdf(rental: Rental, issuer: InvoiceSettings): Promise<Blob> {
  const customer: [string, string][] = [["Cliente", rental.clientName]];
  if (rental.clientPhone) customer.push(["Teléfono", rental.clientPhone]);
  customer.push(["Fecha del evento", `${formatCalendarDate(rental.eventDate)} (devolución ${formatCalendarDate(rental.returnDate)})`]);
  if (rental.city?.name) customer.push(["Ciudad de entrega", rental.city.name]);

  return render({
    kind: "PRESUPUESTO",
    issuer,
    logoUrl: logoUrl(),
    stamp: [["R.U.C.", issuer.ruc]],
    numberLabel: `Nº ${String(rental.id).padStart(6, "0")}`,
    dateLabel: `Fecha: ${formatLongDate(new Date().toISOString())}`,
    customer,
    lines: linesFromRental(rental),
    footer: {
      note: "Este presupuesto no es un comprobante fiscal. Precios en guaraníes con IVA incluido. La disponibilidad se confirma al reservar.",
    },
  });
}

export const quoteFileName = (rental: Rental) => `Presupuesto-LT-${String(rental.id).padStart(6, "0")}.pdf`;
