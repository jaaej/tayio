import type { UserRole } from "@/db/schema";
import type { MessageRow } from "@/lib/dm-queries";
import { ConversationHeader } from "./conversation-header";
import { MessageComposer } from "./message-composer";
import { MessageList } from "./message-list";

/**
 * Shared conversation surface for every role's DM thread page: one frosted
 * glass card holding the header, the scrolling message list, and the composer.
 */
export function ConversationPanel({
  threadId,
  meId,
  otherName,
  otherRole,
  messages,
  rolePrefix,
}: {
  threadId: string;
  meId: string;
  otherName: string;
  otherRole: UserRole;
  messages: MessageRow[];
  rolePrefix: "parent" | "student" | "tutor" | "admin";
}) {
  return (
    <section className="portal-glass-panel flex h-[calc(100dvh-160px)] min-h-[420px] flex-col overflow-hidden rounded-[22px] border">
      <ConversationHeader
        otherName={otherName}
        otherRole={otherRole}
        backHref={`/${rolePrefix}/messages`}
      />
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <MessageList
          messages={messages}
          meId={meId}
          otherName={otherName}
          otherRole={otherRole}
        />
      </div>
      <MessageComposer threadId={threadId} rolePrefix={rolePrefix} />
    </section>
  );
}
