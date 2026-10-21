# Pre-release QA Checklist: Messaging and Meetings

Run this manual pass against the release candidate before every release. Use test accounts and non-sensitive content. Record each result, attach evidence for failures, and block sign-off on any unresolved release-critical issue.

## Release Run Record

| Field | Value |
|-------|-------|
| Release tag / version | Upcoming release (tag not yet assigned) |
| Target release date | TBD by release owner |
| First run window | Before release-candidate sign-off for the upcoming release; calendar date to be assigned by release owner |
| QA owner | Unassigned |
| Build / environment | TBD |
| Overall result | Not run |

The repository does not identify a release version or date. At release planning, assign the QA owner and calendar date above; execute this pass before approving the release candidate. Do not treat the pending run as passed.

## Test Setup

- [ ] Use two test wallets belonging to the client and freelancer on the same test job.
- [ ] Use separate browser profiles or devices for the two participants; confirm the release build uses a shared messaging transport before interpreting cross-device delivery results.
- [ ] Prepare one browser/device in a second timezone and note both timezone names and UTC offsets.
- [ ] Record the release build identifier, browser/device, locale, and any network simulation used.
- [ ] Use a meeting reminder lead time defined for this release. If no reminder policy or configured lead time exists, record it as a finding and do not pass reminder timing.

## Messaging

### Start a thread

- [ ] From a job detail page, choose **Message** for the other job participant. Expected: the conversation opens with the correct participant address and, where applicable, job context.
- [ ] Start a conversation from a profile page. Expected: the thread is associated with the selected profile, not another participant.
- [ ] Return to **Messages**. Expected: each new thread appears once, sorted by latest activity; the empty state and wallet-connect prompt are appropriate when there are no threads or no connected wallet.

### Send, receive, and retain history

- [ ] Send a plain-text message from participant A. Expected: it appears once in A's thread and arrives once in participant B's thread with the correct sender and order.
- [ ] Reply from B. Expected: A receives the reply and both views show the same conversation history after refresh and sign-out/sign-in.
- [ ] Send a blank message and a message containing markup-like text. Expected: blank content is not sent; markup is displayed as text or safely removed, never executed.
- [ ] Send while offline, then restore connectivity. Expected: the UI either clearly reports that delivery failed or queues and delivers the message once; it never reports success for a lost message or creates duplicates after reconnecting.
- [ ] Throttle or interrupt the connection during send and receive. Expected: history remains intact, delivery state is truthful, and retry/reconnect does not duplicate messages.

### Unread state, read receipts, and typing

- [ ] With B outside the thread, send B a message from A. Expected: the conversation and navigation show the correct unread count.
- [ ] Open B's thread. Expected: unread count clears and remains cleared after returning to the inbox or refreshing.
- [ ] With read receipts enabled, have B read A's message. Expected: A sees a read receipt only after B opens the thread; receipt state is consistent after refresh.
- [ ] Disable read receipts in **Settings > Privacy**, then repeat. Expected: no new receipt is exposed to A; B's local unread state still clears. Re-enable the setting after the test.
- [ ] Type in A's composer without sending. Expected: B sees the typing indicator promptly; it clears after A stops typing, sends, navigates away, or disconnects.

## Meetings

### Schedule and confirm

- [ ] From the test job, propose a meeting with a title, date, start time, and end time. Expected: a pending proposal appears for the intended job and both participants.
- [ ] Submit a proposal with missing fields, an end time before the start time, and a slot that conflicts with an existing confirmed meeting. Expected: invalid or conflicting proposals are rejected with a clear explanation and no pending meeting is created. Record the actual behavior for each case.
- [ ] Have the other participant select a proposed slot. Expected: the meeting becomes confirmed, both participants see the same slot and status, and the displayed duration is correct.

### Reschedule, cancel, and reminders

- [ ] Reschedule a confirmed meeting to a new slot. Expected: the old slot is no longer presented as confirmed; participants see the new proposal and confirmation state is clear.
- [ ] Cancel a pending proposal and a confirmed meeting. Expected: each becomes cancelled for both participants, is excluded from upcoming meetings, and cannot be accidentally confirmed afterward.
- [ ] Confirm a meeting sufficiently far in advance to observe its reminder. Expected: the reminder arrives at the release's documented lead time in both participant timezones, refers to the correct meeting and local time, and is not duplicated.
- [ ] Change the meeting time after a reminder has been scheduled. Expected: obsolete reminders are withdrawn or updated; only the new time generates a reminder.

### Timezones and locale

- [ ] Propose and confirm a meeting while the participants use different timezones. Expected: both see the same instant with an unambiguous local date/time and timezone; the exported calendar file represents that same instant.
- [ ] Repeat around a daylight-saving transition when supported by the release schedule. Expected: no one-hour shift, invalid local time, or ambiguous date is silently accepted.
- [ ] Switch locale while a conversation with existing history is open. Expected: message text, ordering, unread state, and thread identity remain unchanged; dates and controls update to the selected locale without truncation or duplicated messages.

## Wallet and Session State

- [ ] Disconnect the wallet while viewing the inbox and an open thread. Expected: protected message actions stop, the connect-wallet prompt is shown, and no other wallet's conversation is exposed.
- [ ] Reconnect the same wallet. Expected: its conversation history and unread state are restored without duplication or loss.
- [ ] Connect the other test wallet. Expected: only that wallet's inbox and threads are shown; sending and receiving still target the intended participant.

## Findings

Record runtime findings during the first run and subsequent releases. Include severity, reproduction steps, expected and actual behavior, evidence link, owner, and disposition.

| ID | Severity | Finding / evidence | Owner | Status |
|----|----------|-------------------|-------|--------|
| | | | | |

### Pre-run baseline findings

These are code-review observations, not results from a completed manual run. Reproduce them against the release candidate, then update each disposition:

| ID | Severity | Finding / evidence | Owner | Disposition |
|----|----------|-------------------|-------|-------------|
| QA-BASE-01 | High | Messaging uses browser local storage and simulates recipient delivery locally; separate participants do not share a live transport ([messaging implementation](../frontend/lib/messaging.ts)). | Unassigned | Verify on release candidate; unresolved cross-device delivery blocks messaging sign-off. |
| QA-BASE-02 | High | The meeting form/context reviewed has no conflict validation and the meetings page exposes no reschedule action ([meeting context](../frontend/lib/meetings-context.tsx), [meetings page](../frontend/app/meetings/page.tsx)). | Unassigned | Verify on release candidate; record missing rejection or reschedule behavior. |
| QA-BASE-03 | High | No reminder policy, scheduling, or delivery path was found in the meeting UI/context reviewed ([meeting context](../frontend/lib/meetings-context.tsx), [meetings page](../frontend/app/meetings/page.tsx)). | Unassigned | Define the release reminder lead time and verify delivery; missing reminders block reminder sign-off. |
| QA-BASE-04 | High | Read marking updates the local thread copy; the reviewed path does not apply the read-receipt preference or propagate a receipt to the sender ([messaging implementation](../frontend/lib/messaging.ts)). | Unassigned | Verify enabled and disabled preference cases on release candidate; unresolved receipt behavior blocks receipt sign-off. |

## Sign-Off

Complete one row per release. All release-critical findings must be resolved or have an explicit go/no-go decision before approval.

| Release | QA owner | Run date | Result (Pass / Fail / Blocked) | Open finding IDs | Reviewer sign-off |
|---------|----------|----------|--------------------------------|------------------|-------------------|
| Upcoming release (tag TBD) | Unassigned | TBD | Not run | None recorded; see pre-run observations | Pending |
| | | | | | |