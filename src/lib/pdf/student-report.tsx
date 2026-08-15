import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PDF_BRAND } from "./brand";
import type { StudentTermReport } from "@/lib/student-report";

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
  metaRight: { fontSize: 10, color: PDF_BRAND.inkSoft, textAlign: "right" },
  studentName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink },
  topRow: { flexDirection: "row", gap: 12, marginBottom: 22 },
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
  bigValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.indigoDark,
    marginTop: 4,
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
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.line,
    paddingVertical: 5,
  },
  th: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
  },
  td: { fontSize: 10, color: PDF_BRAND.inkSoft },
  colSubject: { width: "52%" },
  colScore: { width: "24%", textAlign: "right" },
  colGrade: { width: "24%", textAlign: "right" },
  gradeLetter: { fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark },
  empty: { fontSize: 9, color: PDF_BRAND.muted, paddingVertical: 6 },
  comment: {
    borderLeftWidth: 2,
    borderLeftColor: PDF_BRAND.indigo,
    paddingLeft: 8,
    marginBottom: 8,
  },
  commentMeta: {
    fontSize: 8,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  commentText: { fontSize: 9, color: PDF_BRAND.inkSoft, lineHeight: 1.4 },
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

function gradeText(g: StudentTermReport["overall"]): string {
  return g ? `${g.letter} · ${g.percent}%` : "-";
}

export function StudentReportPdf({
  report,
  generatedAtLabel,
}: {
  report: StudentTermReport;
  generatedAtLabel: string;
}) {
  const { student, term } = report;
  const studentName = `${student.firstName} ${student.lastName}`.trim();
  return (
    <Document
      title={`${studentName} - ${term.year} Term ${term.termNumber} report`}
      author={PDF_BRAND.companyName}
    >
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <View>
            <Text style={s.company}>{PDF_BRAND.companyName}</Text>
            <Text style={s.docTitle}>Student progress report</Text>
          </View>
          <View>
            <Text style={s.studentName}>{studentName}</Text>
            <Text style={s.metaRight}>
              {student.yearLevel ? `${student.yearLevel} · ` : ""}
              {term.year} Term {term.termNumber}
            </Text>
          </View>
        </View>

        <View style={s.topRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Overall grade</Text>
            <Text style={s.bigValue}>{gradeText(report.overall)}</Text>
            <Text style={s.cardSub}>Quiz + test average, equal weight</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Attendance</Text>
            <Text style={s.bigValue}>
              {report.attendance.percent !== null
                ? `${report.attendance.percent}%`
                : "-"}
            </Text>
            <Text style={s.cardSub}>
              {report.attendance.present}/{report.attendance.total} lessons
              attended
            </Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Results by subject</Text>
        {report.subjects.length === 0 ? (
          <Text style={s.empty}>No enrolled subjects for this term.</Text>
        ) : (
          <View>
            <View style={s.tHead}>
              <Text style={[s.th, s.colSubject]}>Subject</Text>
              <Text style={[s.th, s.colScore]}>Score</Text>
              <Text style={[s.th, s.colGrade]}>Grade</Text>
            </View>
            {report.subjects.map((sub) => (
              <View key={sub.subjectId} style={s.tRow} wrap={false}>
                <Text style={[s.td, s.colSubject]}>{sub.subjectName}</Text>
                <Text style={[s.td, s.colScore]}>
                  {sub.grade ? `${sub.grade.percent}%` : "No scores yet"}
                </Text>
                <Text style={[s.td, s.colGrade, s.gradeLetter]}>
                  {sub.grade ? sub.grade.letter : "-"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 18 }} />

        <Text style={s.sectionTitle}>Tutor comments</Text>
        {report.comments.length === 0 ? (
          <Text style={s.empty}>No tutor comments recorded this term.</Text>
        ) : (
          report.comments.map((c, i) => (
            <View key={i} style={s.comment} wrap={false}>
              <Text style={s.commentMeta}>
                {c.date}
                {c.subjectName ? ` · ${c.subjectName}` : ""}
              </Text>
              <Text style={s.commentText}>{c.comment}</Text>
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {PDF_BRAND.companyName} - {studentName}
          </Text>
          <Text style={s.footerText}>Generated {generatedAtLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
