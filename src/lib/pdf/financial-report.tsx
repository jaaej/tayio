import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PDF_BRAND, formatPdfMoney } from "./brand";
import type { FinancialReport } from "@/app/admin/_lib/queries";

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 10,
    color: PDF_BRAND.ink,
    fontFamily: "Helvetica",
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: PDF_BRAND.indigo,
    paddingBottom: 10,
    marginBottom: 18,
  },
  company: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.indigoDark,
  },
  docTitle: { fontSize: 10, color: PDF_BRAND.muted, marginTop: 2 },
  period: { fontSize: 10, color: PDF_BRAND.inkSoft, textAlign: "right" },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 22 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_BRAND.line,
    borderRadius: 6,
    padding: 12,
    backgroundColor: PDF_BRAND.surfaceTint,
  },
  cardLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
  },
  cardValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.indigoDark,
    marginTop: 5,
  },
  cardSub: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.ink,
    marginBottom: 8,
    marginTop: 4,
  },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.indigo,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.line,
    paddingVertical: 4,
  },
  th: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
  },
  td: { fontSize: 9, color: PDF_BRAND.inkSoft },
  colDate: { width: "18%" },
  colName: { width: "42%" },
  colDesc: { width: "24%" },
  colAmt: { width: "16%", textAlign: "right" },
  empty: { fontSize: 9, color: PDF_BRAND.muted, paddingVertical: 6 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 9,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
    marginRight: 10,
  },
  totalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.ink,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.line,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: PDF_BRAND.muted },
});

function Rows({
  lines,
  currency,
  emptyLabel,
}: {
  lines: FinancialReport["payments"];
  currency: string;
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return <Text style={s.empty}>{emptyLabel}</Text>;
  }
  return (
    <View>
      <View style={s.tHead}>
        <Text style={[s.th, s.colDate]}>Date</Text>
        <Text style={[s.th, s.colName]}>Parent</Text>
        <Text style={[s.th, s.colDesc]}>Detail</Text>
        <Text style={[s.th, s.colAmt]}>Amount</Text>
      </View>
      {lines.map((l) => (
        <View key={l.id} style={s.tRow} wrap={false}>
          <Text style={[s.td, s.colDate]}>{l.date ?? "-"}</Text>
          <Text style={[s.td, s.colName]}>{l.parentName || "-"}</Text>
          <Text style={[s.td, s.colDesc]}>{l.description ?? "-"}</Text>
          <Text style={[s.td, s.colAmt]}>
            {formatPdfMoney(Number(l.amount), currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function FinancialReportPdf({
  report,
  generatedAtLabel,
}: {
  report: FinancialReport;
  generatedAtLabel: string;
}) {
  return (
    <Document
      title={`Financial report ${report.fromIso} to ${report.toIso}`}
      author={PDF_BRAND.companyName}
    >
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <View>
            <Text style={s.company}>{PDF_BRAND.companyName}</Text>
            <Text style={s.docTitle}>Financial report</Text>
          </View>
          <Text style={s.period}>
            {report.fromIso} to {report.toIso}
          </Text>
        </View>

        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Revenue collected</Text>
            <Text style={s.cardValue}>
              {formatPdfMoney(report.revenueTotal, report.currency)}
            </Text>
            <Text style={s.cardSub}>
              {report.paymentCount} payment{report.paymentCount === 1 ? "" : "s"}{" "}
              in period
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Overdue (as of end)</Text>
            <Text style={s.cardValue}>
              {formatPdfMoney(report.overdueTotal, report.currency)}
            </Text>
            <Text style={s.cardSub}>
              {report.overdueCount} invoice
              {report.overdueCount === 1 ? "" : "s"} past due
            </Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Payments received</Text>
        <Rows
          lines={report.payments}
          currency={report.currency}
          emptyLabel="No payments received in this period."
        />
        {report.payments.length > 0 && (
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total collected</Text>
            <Text style={s.totalValue}>
              {formatPdfMoney(report.revenueTotal, report.currency)}
            </Text>
          </View>
        )}

        <View style={{ height: 18 }} />

        <Text style={s.sectionTitle}>Overdue invoices</Text>
        <Rows
          lines={report.overdue}
          currency={report.currency}
          emptyLabel="No overdue invoices. All caught up."
        />
        {report.overdue.length > 0 && (
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total overdue</Text>
            <Text style={s.totalValue}>
              {formatPdfMoney(report.overdueTotal, report.currency)}
            </Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {PDF_BRAND.companyName} - confidential
          </Text>
          <Text style={s.footerText}>Generated {generatedAtLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
