import type { ReactNode } from "react";
import type { RichText } from "../_lib/deletion-copy";

/** A RichText sentence with its `{ strong }` parts in bold. */
export function richText(rich: RichText): ReactNode {
  return rich.map((part, i) => (typeof part === "string" ? part : <b key={i}>{part.strong}</b>));
}
