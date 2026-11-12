import { describe, expect, it } from "vitest";
import { renderNotificationEmail } from "./notification-email-template";

const origin = "https://portal.taiyotuition.com";

describe("notification email", () => {
  it("copies an urgent notification with an Urgent badge and a sentence-case subject", () => {
    const email = renderNotificationEmail({
      title: "URGENT: Cover still needed within 24h",
      body: "Year 9 Maths, 12 September 10 - 11:30 am. Originally assigned to Emma Le.",
      href: "/admin/reschedules#tutor-cover",
      origin,
    });
    expect(email.subject).toBe("Urgent: Cover still needed within 24h");
    expect(email.html).toContain(">Urgent<");
    expect(email.html).toContain(">Cover still needed within 24h<");
    expect(email.html).not.toContain("URGENT:");
    expect(email.html).toContain(
      'href="https://portal.taiyotuition.com/admin/reschedules#tutor-cover"',
    );
    expect(email.text).toBe(
      "Urgent: Cover still needed within 24h\n\n" +
        "Year 9 Maths, 12 September 10 - 11:30 am. Originally assigned to Emma Le.\n\n" +
        "Open in the portal: https://portal.taiyotuition.com/admin/reschedules#tutor-cover",
    );
  });

  it("labels an urgent announcement as one and keeps its own title as the heading", () => {
    const email = renderNotificationEmail({
      title: "Urgent announcement: Centre closed today",
      body: "Flooding on Smith St.",
      href: "/student/notifications?announcement=abc",
      origin,
    });
    expect(email.subject).toBe("Urgent announcement: Centre closed today");
    expect(email.html).toContain(">Urgent announcement<");
    expect(email.html).toContain(">Centre closed today<");
  });

  it("has no badge for an ordinary notification", () => {
    const email = renderNotificationEmail({
      title: "Tutor cover request posted",
      body: "Emma Le cannot teach Year 9 Maths.",
      href: "/admin/reschedules#tutor-cover",
      origin,
    });
    expect(email.subject).toBe("Tutor cover request posted");
    expect(email.html).not.toContain(">Urgent");
  });

  it("escapes text people typed and keeps their line breaks", () => {
    const email = renderNotificationEmail({
      title: 'Urgent announcement: <script>alert("x")</script>',
      body: "Line one & more\nLine <b>two</b>",
      href: "/parent/notifications",
      origin,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(email.html).toContain("Line one &amp; more<br />Line &lt;b&gt;two&lt;/b&gt;");
    expect(email.text).toContain("Line one & more\nLine <b>two</b>");
  });

  it("only ever links into the portal", () => {
    const external = renderNotificationEmail({
      title: "Update",
      body: "",
      href: "https://evil.example/phish",
      origin,
    });
    expect(external.html).toContain('href="https://portal.taiyotuition.com/"');
    const missing = renderNotificationEmail({ title: "Update", body: null, href: null, origin });
    expect(missing.html).toContain('href="https://portal.taiyotuition.com/"');
    expect(missing.text).toBe("Update\n\nOpen in the portal: https://portal.taiyotuition.com/");
  });
});
