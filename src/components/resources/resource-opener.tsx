"use client";

import { useState, type ReactNode } from "react";
import { openResourceFile } from "@/app/_actions/resources";
import { FileViewerDialog } from "@/components/ui/file-viewer";
import { VideoViewerDialog } from "@/components/ui/video-viewer";
import type { ViewableFileKind } from "@/lib/file-viewer";
import { hostedEmbedUrl } from "@/lib/video-embed";

export type OpenableResource = {
  id: string;
  title: string;
  kind: "file" | "link";
  /** A link's address (already checked by `httpHref`); null for a file. */
  href: string | null;
};

export type ResourceOpenState = "idle" | "loading" | "error";

type OpenedFile = {
  url: string;
  downloadUrl: string;
  kind: ViewableFileKind;
  format: string | null;
  tooLarge: boolean;
};

/**
 * Opens a library resource the same way in every role. A file is signed by
 * `openResourceFile` (which re-checks the viewer's access) and shows in the
 * portal's viewer with Download (Word, PowerPoint and Excel through
 * Microsoft's web viewer); a YouTube, Vimeo, Drive or Loom link plays in the
 * video viewer; any other link opens its site in a new tab, since sites
 * can't be shown inside the portal. Nothing opens a pop-up after waiting on
 * the server, which Safari blocks.
 */
export function useResourceOpener(resource: OpenableResource) {
  const [state, setState] = useState<ResourceOpenState>("idle");
  const [file, setFile] = useState<OpenedFile | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const embeddable = resource.kind === "link" && resource.href ? hostedEmbedUrl(resource.href) !== null : false;
  /** A website link renders as a plain new-tab link instead of a button. */
  const websiteHref = resource.kind === "link" && !embeddable ? resource.href : null;

  async function open() {
    if (resource.kind === "link") {
      // A website link is a plain <a>; one with no usable address can't open.
      if (embeddable) setVideoOpen(true);
      else setState("error");
      return;
    }
    setState("loading");
    try {
      const res = await openResourceFile(resource.id);
      if (!res.ok) throw new Error(res.error);
      setFile(res);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const viewer = (
    <>
      {file && (
        <FileViewerDialog
          open
          url={file.url}
          downloadUrl={file.downloadUrl}
          kind={file.kind}
          format={file.format}
          tooLarge={file.tooLarge}
          title={resource.title}
          onClose={() => setFile(null)}
        />
      )}
      {embeddable && (
        <VideoViewerDialog
          open={videoOpen}
          url={resource.href}
          title={resource.title}
          onClose={() => setVideoOpen(false)}
        />
      )}
    </>
  );

  return { state, open, websiteHref, viewer };
}

export type ResourceOpenerHandle = ReturnType<typeof useResourceOpener>;

/**
 * What the viewer clicks to open a resource (its title, or the whole row): a
 * new-tab link for a website, otherwise a button. Render `opener.viewer`
 * once beside it.
 */
export function OpenerTrigger({
  opener,
  className,
  children,
}: {
  opener: ResourceOpenerHandle;
  className?: string;
  children: ReactNode;
}) {
  if (opener.websiteHref) {
    return (
      <a href={opener.websiteHref} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={opener.open}
      disabled={opener.state === "loading"}
      className={className}
    >
      {children}
    </button>
  );
}
