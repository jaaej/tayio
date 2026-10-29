import type { UserRole } from "@/db/schema";
import type { MessageRow } from "@/lib/dm-queries";
import { ConversationHeader } from "./conversation-header";
import { MessageComposer } from "./message-composer";
import { MessageList } from "./message-list";

/**
 * Right pane of the shared messaging workspace for every role, drawn inside
 * the layout's glass frame: the title row, then one white panel holding the
 * message history and composer.
 */
export function ConversationPanel({
  threadId,
  meId,
  otherName,
  otherRole,
  messages,
  rolePrefix,
  profileHref,
  profileLabel,
  context,
}: {
  threadId: string;
  meId: string;
  otherName: string;
  otherRole: UserRole;
  messages: MessageRow[];
  rolePrefix: "parent" | "student" | "tutor" | "admin";
  profileHref?: string;
  profileLabel?: string;
  context?: string;
}) {
  return (
    <section
      aria-labelledby="conversation-title"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <ConversationHeader
        otherName={otherName}
        otherRole={otherRole}
        backHref={`/${rolePrefix}/messages`}
        profileHref={profileHref}
        profileLabel={profileLabel}
        context={context}
        titleId="conversation-title"
      />
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* column-reverse keeps the scroller pinned to the newest message on
            load and after sending, with no scroll script. */}
        <div className="relative flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-3.5 py-4 sm:p-5">
          <MessageList messages={messages} meId={meId} otherName={otherName} />
        </div>
        {/* Keyed so a draft never carries over into another conversation. */}
        <MessageComposer key={threadId} threadId={threadId} rolePrefix={rolePrefix} />
      </div>
    </section>
  );
}
