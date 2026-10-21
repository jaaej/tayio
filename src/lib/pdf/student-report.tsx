import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PDF_BRAND } from "./brand";
import type { StudentTermReport, SubjectReport } from "@/lib/student-report";
import { REPORT_RATINGS, ratingLabel } from "@/lib/term-report-entry-rules";

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
  subject: {
    borderWidth: 1,
    borderColor: PDF_BRAND.line,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  subjectHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subjectName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink },
  subjectTutor: { fontSize: 8.5, color: PDF_BRAND.muted, marginTop: 2 },
  grade: { fontSize: 12, fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark, textAlign: "right" },
  gradeSub: { fontSize: 8, color: PDF_BRAND.muted, textAlign: "right", marginTop: 2 },
  ratings: { flexDirection: "row", gap: 10, marginTop: 10 },
  rating: { flex: 1, backgroundColor: PDF_BRAND.surfaceTint, borderRadius: 5, padding: 7 },
  ratingLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
  },
  dots: { flexDirection: "row", gap: 3, marginTop: 5, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  ratingWord: { fontSize: 8.5, color: PDF_BRAND.inkSoft, marginLeft: 5 },
  facts: { marginTop: 9, fontSize: 9, color: PDF_BRAND.inkSoft, lineHeight: 1.45 },
  factLabel: { fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink },
  summary: {
    marginTop: 9,
    borderLeftWidth: 2,
    borderLeftColor: PDF_BRAND.indigo,
    paddingLeft: 8,
  },
  summaryText: { fontSize: 9.5, color: PDF_BRAND.ink, lineHeight: 1.5 },
  summaryBy: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 3 },
  empty: { fontSize: 9, color: PDF_BRAND.muted, paddingVertical: 6 },
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

function Dots({ value }: { value: number }) {
  return (
    <View style={s.dots}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[s.dot, { backgroundColor: i <= value ? PDF_BRAND.indigo : PDF_BRAND.line }]}
        />
      ))}
      <Text style={s.ratingWord}>{ratingLabel(value)}</Text>
    </View>
  );
}

function SubjectBlock({ sub }: { sub: SubjectReport }) {
  const facts = [
    sub.attendance.total > 0 ? ["Attendance", `${sub.attendance.attended} of ${sub.attendance.total} lessons`] : null,
    sub.homework.set > 0 ? ["Homework handed in", `${sub.homework.handedIn} of ${sub.homework.set}`] : null,
    sub.quizzes.length > 0
      ? ["Quizzes", sub.quizzes.map((q) => `${q.label} ${q.percent}%`).join(", ")]
      : null,
    sub.topics.length > 0 ? ["Covered", sub.topics.join("; ")] : null,
  ].filter((f): f is [string, string] => f !== null);
  return (
    <View style={s.subject} wrap={false}>
      <View style={s.subjectHead}>
        <View>
          <Text style={s.subjectName}>{sub.subjectName}</Text>
          {sub.tutorNames.length > 0 && <Text style={s.subjectTutor}>{sub.tutorNames.join(", ")}</Text>}
        </View>
        <View>
          <Text style={s.grade}>{sub.grade ? `${sub.grade.letter} · ${sub.grade.percent}%` : "-"}</Text>
          <Text style={s.gradeSub}>{sub.grade ? "Quiz + test average" : "No scores yet"}</Text>
        </View>
      </View>
      {sub.entry && (
        <View style={s.ratings}>
          {REPORT_RATINGS.map((r) => (
            <View key={r.key} style={s.rating}>
              <Text style={s.ratingLabel}>{r.label}</Text>
              <Dots value={sub.entry![r.key]} />
            </View>
          ))}
        </View>
      )}
      {facts.length > 0 && (
        <View style={s.facts}>
          {facts.map(([label, value]) => (
            <Text key={label}>
              <Text style={s.factLabel}>{label}: </Text>
              {value}
            </Text>
          ))}
        </View>
      )}
      {sub.entry && (
        <View style={s.summary}>
          <Text style={s.summaryText}>{sub.entry.summary}</Text>
          {sub.entry.writtenBy && <Text style={s.summaryBy}>{sub.entry.writtenBy}</Text>}
        </View>
      )}
    </View>
  );
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

        <Text style={s.sectionTitle}>Subjects</Text>
        {report.subjects.length === 0 ? (
          <Text style={s.empty}>No classes this term.</Text>
        ) : (
          report.subjects.map((sub) => <SubjectBlock key={sub.subjectId} sub={sub} />)
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
