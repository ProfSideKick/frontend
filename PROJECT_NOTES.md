# Deferred observations — not a work queue

These are historical observations and potential improvements only. **Do not investigate, implement, assign, convert into issues, or prioritize any entry without explicit professor authorization.** This file is not a backlog, specification, or instruction to agents. No implementation is requested.

## 2026-11-24 — Occasional Realtime interruption

During a relatively long live test of the revised Core Instructions, the professor reported a connection interruption while the interface appeared to be transcribing his voice. Rare occurrence; professor believes it predates experiment 1 and is not caused by the prompt change. Root cause unknown; no causal claim or regression established. Repository inspection alone cannot diagnose the specific incident. A recurrence would be better investigated with browser console/WebRTC/data-channel state, Realtime events/errors, and correlated backend logs where relevant. No live incident diagnostics available for this report. Defer unless frequency/impact increases and the professor explicitly authorizes investigation.

## 2026-11-24 — Conversation continuity after disconnect/reconnect

Professor reports that the existing disconnect/reconnect recovery effectively starts a fresh conversation: the learner experiences the agent as having forgotten what was covered. Code inspection confirms reconnect requests a fresh ephemeral key and establishes a new connection; slide position recovery exists, but this is not equivalent to restoring conversation context. Potential future enhancement: preserve a compact checkpoint of current slide, coverage, recent discussion, and unanswered questions, and rehydrate a new Realtime conversation after reconnect. Consider recent verbatim turns when needed, privacy, interrupted turns, and avoiding duplicate speech/tool calls. Do not change or remove the existing recovery mechanism. No implementation or debugging requested; low urgency.

## 2026-11-24 — Global Core Instructions (architecture)

Existing sessions store their own copy of the non-editable core prompt, alongside editable professor instructions. This predates experiment 1. Professor clarified that global current core instructions would be preferable, but explicitly deferred the architectural change as not urgent. Existing sessions continue to retain their stored core; new sessions use current defaults. No backend or migration work authorized.
