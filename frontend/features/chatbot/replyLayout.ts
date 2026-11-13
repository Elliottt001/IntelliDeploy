// Retain API line separators; these are text bytes, not a message formatting protocol.
export function splitReplyLines(content: string) {
 const parts = content.split(/(\r?\n)/);
 const lines = [];
 for (let index=0; index<parts.length; index+=2) lines.push({content:parts[index],separator:parts[index+1] ?? ''});
 return lines;
}

// Blank lines must retain their original text flow; source row offsets cover only 1-3 nonempty lines.
export function needsDetailedReplyLayout(content: string): boolean {
 const lines = splitReplyLines(content);
 return content.length > 42 || lines.length > 3 || lines.some(line => line.content.length === 0);
}

type ConversationMessage = {role: string; content: string};

// Dedup is presentation-only and byte-exact: callers retain the original conversation array.
export function latestAssistantForDisplay<T extends ConversationMessage>(conversation: readonly T[], question: string | null | undefined): T | null {
 for (let index=conversation.length-1;index>=0;index--) {
  const message=conversation[index];
  if (message.role==='assistant') return message.content===question?null:message;
 }
 return null;
}
