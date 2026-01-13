# Email Skill

Compose and preview emails in the terminal, then open them in Gmail for sending.

## Claude Implementation Guide

The email preview canvas handles Gmail integration directly - no need for `--wait` or manual URL construction.

### Required Steps

1. **Draft the email** based on user's request
2. **Spawn the preview**:
   ```bash
   bun run src/cli.ts spawn document --scenario email-preview \
     --config '{"to":["..."],"subject":"...","content":"..."}'
   ```
3. **User presses `Ctrl+G`** → Gmail opens automatically in their browser
4. **User presses `Esc`** → Canvas closes without action

### Live Updates via IPC

The email preview supports live updates while displayed. Use this for iterative drafting:

```bash
# Update subject
bun run src/cli.ts update document-1 --config '{"subject": "New Subject"}'

# Update body
bun run src/cli.ts update document-1 --config '{"content": "Updated content..."}'

# Update recipients
bun run src/cli.ts update document-1 --config '{"to": ["new@example.com"], "cc": ["added@example.com"]}'

# Update multiple fields at once
bun run src/cli.ts update document-1 --config '{"subject": "Revised", "content": "New body", "cc": ["manager@example.com"]}'
```

**Updatable fields**: `to`, `cc`, `bcc`, `subject`, `content`, `from`

### Gmail URL Handling

When the user presses `Ctrl+G`, the canvas:
1. Builds a Gmail compose URL with all email fields
2. Opens it directly in the default browser
3. Handles URL length limits by truncating long bodies (with `[truncated]` marker)
4. Sends an IPC `gmail` message for logging (optional to handle)

**Note:** The `--wait` flag is optional - use it only if you need to know whether the user sent or cancelled.

---

## Example Prompts

- "Draft an email to the marketing team about the Q1 launch"
- "Write an email to john@example.com asking about the project status"
- "Compose a follow-up email to the client"
- "Help me write an email declining the meeting invitation"

## Workflow

1. **Compose**: Claude drafts the email based on your request
2. **Preview**: Email displayed in terminal canvas with formatted headers (To, Cc, Bcc, Subject)
3. **Review**: You can scroll and review the email content
4. **Send**: Press `Ctrl+G` to open in Gmail, or `Esc` to cancel

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑↓` / scroll | Navigate email content |
| `Ctrl+G` (`^G`) | Open email in Gmail |
| `Esc` | Cancel and close |

## Email Configuration

```typescript
interface EmailConfig {
  to: string[];        // Recipients (required)
  cc?: string[];       // CC recipients
  bcc?: string[];      // BCC recipients
  subject: string;     // Email subject
  content: string;     // Email body (Markdown)
  from?: string;       // Sender (for display only)
}
```

## CLI Usage

### Basic Preview

```bash
# Preview an email (fire and forget)
bun run src/cli.ts spawn document --scenario email-preview --config '{
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "subject": "Meeting Tomorrow",
  "content": "Hi,\\n\\nJust a reminder about our meeting tomorrow at 2pm.\\n\\nBest,\\nAlice"
}'
```

### With Response Capture (--wait)

The `--wait` flag captures the user's action and returns it as JSON. Note that Gmail opens automatically when the user presses `Ctrl+G` - the response is for logging/tracking only:

```bash
# Wait for user interaction and capture response
RESPONSE=$(bun run src/cli.ts spawn document --scenario email-preview --config '{
  "to": ["recipient@example.com"],
  "subject": "Project Update",
  "content": "Hi,\\n\\nHere is the latest update...\\n\\nBest,\\nAlice"
}' --wait)

echo "$RESPONSE"
# If user pressed Ctrl+G: {"type":"gmail","data":{"to":["recipient@example.com"],"subject":"Project Update","content":"Hi,\n\nHere is the latest update...\n\nBest,\nAlice"}}
# If user pressed Esc: {"type":"cancelled","reason":"User quit"}
```

### With Timeout

```bash
# Wait up to 60 seconds for user response
bun run src/cli.ts spawn document --scenario email-preview \
  --config '{"to":["test@example.com"],"subject":"Test"}' \
  --wait --timeout 60000
```

## Gmail Integration

When you press `Ctrl+G`, the canvas automatically:

1. Builds a Gmail compose URL with all email fields (to, cc, bcc, subject, body)
2. Opens the URL directly in the default browser
3. Handles URL length limits (~2000 chars) by truncating long email bodies
4. Sends a `gmail` IPC message for optional logging/tracking

### Gmail URL Format

```
https://mail.google.com/mail/?view=cm&to=a@b.com&cc=c@d.com&su=Subject&body=Body+text
```

### IPC Message Format (Optional)

If using `--wait`, you'll receive these messages:

```typescript
// When user presses Ctrl+G (Gmail already opened by canvas)
{
  type: "gmail",
  data: {
    to: string[],
    cc?: string[],
    bcc?: string[],
    subject: string,
    content: string  // Note if body was truncated
  }
}

// When user presses Esc
{
  type: "cancelled",
  reason: "User quit"
}
```

## Integration Example

The simplest approach - just spawn and let the canvas handle Gmail:

```typescript
// Spawn canvas - Gmail opens automatically when user presses Ctrl+G
await spawnEmailPreview({
  to: ["recipient@example.com"],
  subject: "Meeting Follow-up",
  content: "Hi,\n\nThanks for the meeting today...",
});
// No need to handle the response - Gmail already opened!
```

If you need to track the outcome:

```typescript
const response = await spawnEmailPreview({
  to: ["recipient@example.com"],
  subject: "Meeting Follow-up",
  content: "Hi,\n\nThanks for the meeting today...",
}, { wait: true });

if (response.type === "gmail") {
  console.log("User opened email in Gmail");
} else if (response.type === "cancelled") {
  console.log("Email cancelled by user");
}
```

## Notes

- The `from` field is display-only; Gmail uses your logged-in account
- Markdown formatting in the body is preserved as plain text in Gmail
- Long emails may be truncated by Gmail URL length limits (~2000 chars)
- For complex emails with attachments, use Gmail directly
- Use `\\n` in JSON strings to represent newlines (they are automatically converted)
