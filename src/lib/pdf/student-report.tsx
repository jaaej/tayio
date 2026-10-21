import "server-only";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { PDF_BRAND } from "./brand";
import type { BandRating, StudentTermReport, SubjectReport } from "@/lib/student-report";
import { BANDS } from "@/lib/attainment-bands";

const GREEN = "#16A34A";
const RED = "#DC2626";
const GREY = "#CBD5E1";

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 54,
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
    marginBottom: 16,
  },
  company: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark },
  docTitle: { fontSize: 10, color: PDF_BRAND.muted, marginTop: 2 },
  studentName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink, textAlign: "right" },
  metaRight: { fontSize: 9.5, color: PDF_BRAND.inkSoft, textAlign: "right", marginTop: 1 },
  topRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_BRAND.line,
    borderRadius: 6,
    padding: 11,
    backgroundColor: PDF_BRAND.surfaceTint,
  },
  label: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
  },
  bigValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark, marginTop: 3 },
  cardSub: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 2 },
  subject: { borderWidth: 1, borderColor: PDF_BRAND.line, borderRadius: 6, padding: 12, marginBottom: 12 },
  subjectHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  subjectName: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink },
  subjectTutor: { fontSize: 8.5, color: PDF_BRAND.muted, marginTop: 2 },
  overallBox: { alignItems: "flex-end" },
  bandWord: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark, marginTop: 3 },
  section: { marginTop: 10 },
  sectionTitle: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: PDF_BRAND.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_BRAND.line,
  },
  rowName: { flex: 1, fontSize: 9, color: PDF_BRAND.inkSoft },
  tag: { width: 58, fontSize: 7.5, color: PDF_BRAND.muted, textAlign: "right" },
  percent: { width: 40, fontSize: 9, color: PDF_BRAND.ink, textAlign: "right", fontFamily: "Helvetica-Bold" },
  steps: { flexDirection: "row", gap: 2 },
  step: { width: 12, height: 6, borderRadius: 1.5 },
  stripRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  stripLabel: { width: 150, fontSize: 8.5, color: PDF_BRAND.inkSoft },
  squares: { flexDirection: "row", flexWrap: "wrap", gap: 2, flex: 1 },
  square: { width: 8, height: 8, borderRadius: 1.5 },
  stripCount: { width: 76, fontSize: 8, color: PDF_BRAND.muted, textAlign: "right" },
  legend: { flexDirection: "row", gap: 10, marginTop: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3, fontSize: 7.5, color: PDF_BRAND.muted },
  facts: { fontSize: 9, color: PDF_BRAND.inkSoft, lineHeight: 1.45 },
  factLabel: { fontFamily: "Helvetica-Bold", color: PDF_BRAND.ink },
  comment: { marginTop: 5 },
  commentLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: PDF_BRAND.indigoDark },
  commentText: { fontSize: 9.5, color: PDF_BRAND.ink, lineHeight: 1.45, marginTop: 1 },
  commentBy: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 4 },
  empty: { fontSize: 8.5, color: PDF_BRAND.muted },
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

/** Six steps, filled up to the band. */
function Steps({ band }: { band: number }) {
  return (
    <View style={s.steps}>
      {BANDS.map((b) => (
        <View
          key={b.value}
          style={[s.step, { backgroundColor: b.value <= band ? PDF_BRAND.indigo : PDF_BRAND.line }]}
        />
      ))}
    </View>
  );
}

function RatingCell({ rating }: { rating: BandRating | null }) {
  if (!rating) return <Text style={[s.empty, { width: 170, textAlign: "right" }]}>Not yet assessed</Text>;
  return (
    <View style={{ width: 170, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
      <Steps band={rating.band} />
      <Text style={{ width: 80, fontSize: 9, color: PDF_BRAND.ink, textAlign: "right" }}>{rating.label}</Text>
    </View>
  );
}

const SQUARE_COLOUR = {
  attended: GREEN,
  made_up: GREEN,
  missed: RED,
  cancelled: GREY,
  unmarked: "#ffffff",
} as const;

function SubjectBlock({ sub }: { sub: SubjectReport }) {
  const facts = [
    sub.homework.set > 0 ? ["Homework handed in", `${sub.homework.handedIn} of ${sub.homework.set}`] : null,
    sub.covered.length > 0 ? ["Covered", sub.covered.join("; ")] : null,
  ].filter((f): f is [string, string] => f !== null);
  return (
    <View style={s.subject}>
      <View style={s.subjectHead} wrap={false}>
        <View>
          <Text style={s.subjectName}>{sub.subjectName}</Text>
          {sub.tutorNames.length > 0 && <Text style={s.subjectTutor}>{sub.tutorNames.join(", ")}</Text>}
        </View>
        <View style={s.overallBox}>
          <Text style={s.label}>Overall</Text>
          {sub.overall ? (
            <>
              <View style={{ marginTop: 4 }}>
                <Steps band={sub.overall.band} />
              </View>
              <Text style={s.bandWord}>{sub.overall.label}</Text>
            </>
          ) : (
            <Text style={[s.empty, { marginTop: 3 }]}>Not yet assessed</Text>
          )}
        </View>
      </View>

      {sub.topicRatings.length > 0 && (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>Topics</Text>
          {sub.topicRatings.map((t) => (
            <View key={t.name} style={s.row}>
              <Text style={s.rowName}>{t.name}</Text>
              <RatingCell rating={t.rating} />
            </View>
          ))}
        </View>
      )}

      <View style={s.section} wrap={false}>
        <Text style={s.sectionTitle}>Quiz and test results</Text>
        {sub.results.length === 0 ? (
          <Text style={s.empty}>No quizzes or tests this term.</Text>
        ) : (
          sub.results.map((r, i) => (
            <View key={`${r.label}-${i}`} style={s.row}>
              <Text style={s.rowName}>{r.label}</Text>
              <Text style={s.tag}>{r.kind === "test" ? "Test" : r.counts ? "Major quiz" : "Quiz"}</Text>
              <Text style={s.percent}>{r.percent}%</Text>
            </View>
          ))
        )}
      </View>

      {sub.attendanceHistory.length > 0 && (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>Attendance</Text>
          {sub.attendanceHistory.map((h) => {
            const counted = h.cells.filter((c) => c.state !== "cancelled" && c.state !== "unmarked");
            const attended = counted.filter((c) => c.state !== "missed").length;
            return (
              <View key={h.classLabel} style={s.stripRow}>
                <Text style={s.stripLabel}>{h.classLabel}</Text>
                <View style={s.squares}>
                  {h.cells.map((c) => (
                    <View
                      key={c.date}
                      style={[
                        s.square,
                        { backgroundColor: SQUARE_COLOUR[c.state] },
                        c.state === "unmarked" ? { borderWidth: 0.75, borderColor: GREY } : {},
                      ]}
                    />
                  ))}
                </View>
                <Text style={s.stripCount}>
                  {counted.length > 0 ? `${attended} of ${counted.length} attended` : ""}
                </Text>
              </View>
            );
          })}
          <View style={s.legend}>
            {[
              [GREEN, "Attended, or made up that week"],
              [RED, "Missed"],
              [GREY, "Cancelled by Taiyo"],
              ...(sub.attendanceHistory.some((h) => h.cells.some((c) => c.state === "unmarked"))
                ? [["#ffffff", "Not recorded"]]
                : []),
            ].map(([colour, text]) => (
              <View key={text} style={s.legendItem}>
                <View
                  style={[
                    s.square,
                    { backgroundColor: colour },
                    colour === "#ffffff" ? { borderWidth: 0.75, borderColor: GREY } : {},
                  ]}
                />
                <Text>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {facts.length > 0 && (
        <View style={[s.section, s.facts]} wrap={false}>
          {facts.map(([label, value]) => (
            <Text key={label}>
              <Text style={s.factLabel}>{label}: </Text>
              {value}
            </Text>
          ))}
        </View>
      )}

      {sub.entry && (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>From the tutor</Text>
          {[
            ["Strengths", sub.entry.strengths],
            ["To work on", sub.entry.toWorkOn],
            ["Goals for next term", sub.entry.goals],
          ].map(([label, text]) => (
            <View key={label} style={s.comment}>
              <Text style={s.commentLabel}>{label}</Text>
              <Text style={s.commentText}>{text}</Text>
            </View>
          ))}
          {sub.entry.writtenBy && <Text style={s.commentBy}>{sub.entry.writtenBy}</Text>}
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
  const homeworkPct =
    report.homework.set > 0 ? `${Math.round((report.homework.handedIn / report.homework.set) * 100)}%` : "-";
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
              {[student.yearLevel, student.school, `${term.year} Term ${term.termNumber}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        <View style={s.topRow}>
          <View style={s.card}>
            <Text style={s.label}>Attendance</Text>
            <Text style={s.bigValue}>
              {report.attendance.percent !== null ? `${report.attendance.percent}%` : "-"}
            </Text>
            <Text style={s.cardSub}>
              {report.attendance.present} of {report.attendance.total} lessons attended
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Homework handed in</Text>
            <Text style={s.bigValue}>{homeworkPct}</Text>
            <Text style={s.cardSub}>
              {report.homework.handedIn} of {report.homework.set} tasks
            </Text>
          </View>
        </View>

        {report.subjects.length === 0 ? (
          <Text style={s.empty}>No classes this term.</Text>
        ) : (
          report.subjects.map((sub) => <SubjectBlock key={sub.subjectId} sub={sub} />)
        )}

        <Text style={[s.empty, { marginTop: 2, lineHeight: 1.4 }]}>
          Ratings place a student among everyone taking the same subject this term, from its topic tests and
          major quizzes, from Below average through Low average, Average, High average and Above average to
          Proficient. Where fewer than ten students have a score, the rating comes from the score itself.
        </Text>

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
