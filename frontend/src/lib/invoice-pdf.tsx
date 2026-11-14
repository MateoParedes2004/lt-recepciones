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
  toPrintable,
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

/** Recuadro del emisor (logo, nombre, actividades, teléfono, dirección): igual en la factura y en el presupuesto. */
function IssuerBox({ issuer, logoUrl }: { issuer: InvoiceIssuer; logoUrl: string }) {
  const activities = issuer.activities.split("\n").filter(Boolean);
  return (
    <View style={[s.box, { flex: 1.65, flexDirection: "row", gap: 8 }]}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no es un <img> HTML */}
      <Image src={logoUrl} style={{ width: 58, height: 58 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.tradeName}>{issuer.tradeName.toUpperCase()}</Text>
        {issuer.slogan && <Text style={[s.bold, { color: NAVY, fontSize: 8.5 }]}>{issuer.slogan.toUpperCase()}</Text>}
        <Text style={[s.bold, { marginTop: 2 }]}>de {issuer.businessName}</Text>
        {activities.map((a) => (
          <Text key={a} style={s.small}>* {a}</Text>
        ))}
        {issuer.phone && <Text style={[s.bold, { marginTop: 3 }]}>Cel.: {issuer.phone}</Text>}
        <Text style={s.small}>{issuer.address} - {issuer.city} - Paraguay</Text>
        {issuer.email && <Text style={s.small}>{issuer.email}</Text>}
      </View>
    </View>
  );
}

function FiscalDocument({ d }: { d: DocData }) {
  const totals = computeTotals(d.lines);
  const money = (n: number) => (n ? formatThousands(n) : "");

  return (
    <Document title={`Factura ${d.numberLabel}`} author={d.issuer.tradeName}>
      <Page size="A4" style={s.page}>
        {d.banner && <Text style={s.banner}>{d.banner}</Text>}

        {/* Encabezado: emisor (izquierda) y timbrado / número (derecha) */}
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <IssuerBox issuer={d.issuer} logoUrl={d.logoUrl} />
          <View style={[s.box, { flex: 1, justifyContent: "center" }]}>
            {d.stamp.map(([label, value]) => (
              <Text key={label} style={{ marginBottom: 1.5 }}>
                {label}: <Text style={s.bold}>{value}</Text>
              </Text>
            ))}
            <Text style={s.docTitle}>FACTURA ELECTRÓNICA</Text>
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

        {/* Pie: QR + CDC (o aclaración si no tiene validez) */}
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

// ---------------------------------------------------------------- presupuesto

// Anchos de la tabla del presupuesto (suman 100 %).
const QCOLS = { qty: "10%", desc: "50%", unit: "20%", total: "20%" } as const;

interface QuoteData {
  issuer: InvoiceIssuer;
  logoUrl: string;
  numberLabel: string;
  dateLabel: string;
  customer: [string, string][];
  /** Productos + "Transporte". Cada uno con su total (cantidad × precio). */
  lines: InvoiceLine[];
  note: string;
}

/** Presupuesto para el cliente: mismo estilo que la factura, pero sin columnas de IVA ni timbrado. */
function QuoteDocument({ q }: { q: QuoteData }) {
  const total = q.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  return (
    <Document title={`Presupuesto ${q.numberLabel}`} author={q.issuer.tradeName}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <IssuerBox issuer={q.issuer} logoUrl={q.logoUrl} />
          <View style={[s.box, { flex: 1, justifyContent: "center" }]}>
            <Text>R.U.C.: <Text style={s.bold}>{q.issuer.ruc}</Text></Text>
            <Text style={s.docTitle}>PRESUPUESTO</Text>
            <Text style={[s.bold, { fontSize: 12, textAlign: "center" }]}>{q.numberLabel}</Text>
          </View>
        </View>

        <View style={[s.box, { marginBottom: 8, gap: 3 }]}>
          <Text>{q.dateLabel}</Text>
          {q.customer.map(([label, value]) => (
            <Text key={label}>
              {label}: <Text style={s.bold}>{softWrap(value)}</Text>
            </Text>
          ))}
        </View>

        <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" }}>
          <View style={[s.row, { borderBottomWidth: 1, borderColor: LINE }]}>
            <Text style={[s.th, s.cell, { width: QCOLS.qty }]}>CANT.</Text>
            <Text style={[s.th, s.cell, { width: QCOLS.desc }]}>DESCRIPCIÓN</Text>
            <Text style={[s.th, s.cell, { width: QCOLS.unit }]}>PRECIO UNITARIO</Text>
            <Text style={[s.th, s.cell, { width: QCOLS.total, borderRightWidth: 0 }]}>TOTAL</Text>
          </View>
          {q.lines.map((l, i) => (
            <View key={i} style={[s.row, { borderBottomWidth: 0.5, borderColor: "#cbd5e1" }]} wrap={false}>
              <Text style={[s.cell, { width: QCOLS.qty, textAlign: "center" }]}>{l.quantity}</Text>
              <Text style={[s.cell, { width: QCOLS.desc }]}>{softWrap(l.description)}</Text>
              <Text style={[s.cell, s.num, { width: QCOLS.unit }]}>{formatThousands(l.unitPrice)}</Text>
              <Text style={[s.cell, s.num, s.bold, { width: QCOLS.total, borderRightWidth: 0 }]}>{formatThousands(l.quantity * l.unitPrice)}</Text>
            </View>
          ))}
          <View style={[s.row, { borderTopWidth: 1, borderColor: LINE, backgroundColor: SOFT }]} wrap={false}>
            <Text style={[s.cell, { width: "80%" }]}>
              <Text style={s.bold}>TOTAL A PAGAR Gs.: </Text>
              {numberToSpanishWords(total)}
            </Text>
            <Text style={[s.cell, s.num, s.bold, { width: QCOLS.total, borderRightWidth: 0, fontSize: 10.5 }]}>{formatThousands(total)}</Text>
          </View>
        </View>

        <Text style={[s.small, { marginTop: 10, textAlign: "center" }]}>{q.note}</Text>
      </Page>
    </Document>
  );
}

// Un presupuesto se arma con lo que haya cargado en el alquiler (nombres que a veces
// vienen de WhatsApp, con emojis): la fuente del PDF imprimiría basura, así que se limpia
// solo lo que se IMPRIME (el alquiler guardado no cambia).
const printable = (text: string) => toPrintable(text).text;

const toDay = (iso: string) => iso.slice(0, 10);

/** Presupuesto (sin validez fiscal) de un alquiler todavía sin confirmar o ya confirmado. */
export function quotePdf(rental: Rental, issuer: InvoiceSettings): Promise<Blob> {
  // Si el nombre era solo emojis, queda "—" en vez de un "Cliente:" vacío.
  const customer: [string, string][] = [["Cliente", printable(rental.clientName) || "—"]];
  const phone = rental.clientPhone ? printable(rental.clientPhone) : "";
  if (phone) customer.push(["Teléfono", phone]);
  const sameDay = toDay(rental.eventDate) === toDay(rental.returnDate);
  customer.push([
    "Fecha del evento",
    sameDay ? formatCalendarDate(rental.eventDate) : `${formatCalendarDate(rental.eventDate)}  ·  Devolución: ${formatCalendarDate(rental.returnDate)}`,
  ]);
  if (rental.city?.name) customer.push(["Ciudad de entrega", printable(rental.city.name)]);

  // linesFromRental ya agrega el envío como renglón "Transporte" (igual que en el talonario).
  const lines = linesFromRental(rental).map((l) => ({ ...l, description: printable(l.description) || "Producto" }));

  return pdf(
    <QuoteDocument
      q={{
        issuer,
        logoUrl: logoUrl(),
        numberLabel: `Nº ${String(rental.id).padStart(6, "0")}`,
        dateLabel: `Fecha: ${formatLongDate(new Date().toISOString())}`,
        customer,
        lines,
        note: "Este presupuesto no es un comprobante fiscal. Precios en guaraníes con IVA incluido. La disponibilidad se confirma al reservar.",
      }}
    />,
  ).toBlob();
}

export const quoteFileName = (rental: Rental) => `Presupuesto-LT-${String(rental.id).padStart(6, "0")}.pdf`;
