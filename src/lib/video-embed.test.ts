import { describe, expect, it } from "vitest";
import { hostedEmbedUrl } from "./video-embed";

describe("hostedEmbedUrl", () => {
  it("embeds YouTube watch, short and embed links without cookies", () => {
    expect(hostedEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
    expect(hostedEmbedUrl("https://youtu.be/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
    expect(hostedEmbedUrl("https://youtube.com/embed/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("embeds Vimeo, Google Drive and Loom", () => {
    expect(hostedEmbedUrl("https://vimeo.com/76979871")).toBe(
      "https://player.vimeo.com/video/76979871",
    );
    expect(hostedEmbedUrl("https://drive.google.com/file/d/FILE_ID/view")).toBe(
      "https://drive.google.com/file/d/FILE_ID/preview",
    );
    expect(hostedEmbedUrl("https://www.loom.com/share/xyz")).toBe(
      "https://www.loom.com/embed/xyz",
    );
  });

  it("returns null for anything it cannot embed", () => {
    expect(hostedEmbedUrl("not a url")).toBeNull();
    expect(hostedEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(hostedEmbedUrl("https://www.youtube.com/watch")).toBeNull();
  });
});
