# Papa Production Stabilization Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Papa reliable enough for uninterrupted iPad study: Pencil writing and two-finger navigation never conflict, Submit completes from one tap or gives a recoverable error, successful submission returns to the same chat, and cached chats do not become unavailable.

**Architecture:** Stop patching UI symptoms. Introduce explicit pointer and submit state machines, preserve legacy MCP contracts during a compatibility window, account for ChatGPT fullscreen safe-area overlays, and block release behind automated integration tests plus a real-iPad acceptance run. Work on a stabilization branch and deploy to staging before production.

**Tech Stack:** React 19, TypeScript, Vite, perfect-freehand, MCP Apps SDK, Node test runner plus Vitest/jsdom and Playwright for browser-level regression tests.

---

## Release policy

- Freeze cosmetic changes until every P0 gate passes.
- Do not deploy directly from the current dirty working tree.
- Create a rollback tag from the currently deployed revision before changing production.
- Keep all previously published Papa/Paper tool names and `ui://` URIs until existing chats have aged out and compatibility probes pass.
- Deploy to a staging URL first; production promotion happens only after automated and real-iPad acceptance.

## Acceptance criteria

1. Thirty consecutive Submit runs complete from one tap without duplicate follow-up messages.
2. A failed export/upload/attach/send operation identifies the failed stage and can retry without losing strokes.
3. Successful Submit closes the fullscreen widget and returns to the same conversation.
4. One hundred automated pointer sequences produce no touch ink during two-finger pan/pinch and do not interrupt an active Pencil stroke.
5. Undo/Redo restores pen, eraser, and Clear actions exactly; drawing after Undo clears the redo branch.
6. Toolbar and Submit remain visible and tappable in iPad portrait/landscape and an 800×600 viewport without colliding with ChatGPT’s composer.
7. Current and legacy MCP tools/resources all pass production probes.
8. Typecheck, unit, integration, browser, build, dependency audit, and diff checks all pass from a committed revision.

---

### Task 1: Establish a safe stabilization baseline

**Objective:** Preserve rollback and isolate the stabilization work from the currently dirty main branch.

**Files:**
- Inspect: all currently modified/deleted tracked files
- Create: `.hermes/plans/2026-08-15_074722-papa-production-stabilization.md`

**Steps:**
1. Run `git status --short -b`, `git diff --stat`, `git diff --check`, and `git log -5 --oneline`.
2. Review the 21-file working-tree diff and separate intended Papa changes from accidental build artifacts.
3. Commit the current known deployment state on a stabilization branch without changing behavior.
4. Add a rollback tag identifying that baseline.
5. Verify `npm test`, `npm run build`, and `node --check lib/mcp-app.mjs`.
6. Do not deploy in this task.

**Commit:** `chore: checkpoint papa stabilization baseline`

---

### Task 2: Restore MCP backward compatibility

**Objective:** Prevent cached conversations/connectors from reporting Papa unavailable.

**Files:**
- Modify: `lib/mcp-app.mjs`
- Create: `test/mcp-compatibility.test.mjs`

**Failing tests first:**
1. Assert `tools/list` includes current `papa` plus legacy `paper`, `open_epaper`, and `open_epaper_lite` aliases.
2. Assert `tools/call` succeeds for each alias.
3. Assert `resources/read` succeeds for every previously published URI: Paper v13/v14/v15, Papa v1-v5, and the new current URI.
4. Assert all legacy resources return the current safe widget HTML rather than obsolete implementations.

**Implementation:**
- Register aliases through one data table to avoid duplicated registration logic.
- Register legacy URI aliases through one compatibility list.
- Keep one current canonical tool and resource; aliases forward to that implementation.
- Add a compatibility comment with a removal date/release condition rather than deleting aliases reactively.

**Verification:**
- `node --test test/mcp-compatibility.test.mjs`
- Probe staging `tools/list`, every `tools/call`, and every `resources/read`.

**Commit:** `fix: restore cached papa connector compatibility`

---

### Task 3: Add a testable Submit state machine

**Objective:** Make each Submit stage explicit, bounded, retryable, and observable.

**Files:**
- Create: `src/submit/submitMachine.ts`
- Create: `test/submit-machine.test.mjs` or `src/submit/submitMachine.test.ts`
- Modify: `src/types.ts`
- Modify later: `src/hooks/useSubmitHandwriting.ts`

**State model:**

```text
idle → exporting → uploading → attaching → sending → closing → submitted
                                      ↘ failed(stage, message, retryable)
```

**Failing tests first:**
1. One operation cannot start while another is active.
2. Rapid taps invoke export/upload/follow-up exactly once.
3. Each stage times out and reports the exact failed stage.
4. Retry reuses the exported Blob and uploaded file ID when safe.
5. Retry after attach/send failure does not upload the image again.
6. Completion records a submission ID so duplicate follow-ups are suppressed.
7. Failure preserves board content and does not reset automatically to an ambiguous idle state.

**Implementation:**
- Use an immediate ref/operation lock, not React state alone.
- Inject bridge/export dependencies so the state machine is testable without React.
- Use bounded timeout helpers around host calls.
- Keep non-sensitive stage timings and error codes for diagnostics.

**Commit:** `feat: add deterministic papa submit state machine`

---

### Task 4: Integrate reliable one-tap Submit and return to chat

**Objective:** Connect the tested state machine to the widget and close fullscreen only after successful handoff.

**Files:**
- Modify: `src/hooks/useSubmitHandwriting.ts`
- Modify: `src/types.ts`
- Modify: `src/components/BottomBar.tsx`
- Modify: `src/constants.ts`
- Create: `src/hooks/useSubmitHandwriting.test.tsx`

**Failing tests first:**
1. A single click calls `uploadFile`, `setWidgetState`, and `sendFollowUpMessage` once in order.
2. Successful follow-up calls `window.openai.requestClose()` once; fallback requests inline mode if close is unavailable.
3. Missing bridge APIs produce a visible recoverable error, never a fake “Submitted” or silent download inside ChatGPT.
4. Timeout shows `ส่งไม่สำเร็จตอนอัปโหลด — ลองอีกครั้ง` or the relevant stage.
5. Retry preserves the existing drawing and uses the cached payload.
6. Double click/tap cannot create duplicate uploads or messages.

**Implementation:**
- Add `requestClose` to `Window.openai` typing.
- Keep explicit Thai status text for each stage.
- Do not reset error status on a timer; require Retry or Cancel.
- Keep Submit disabled only while an operation is genuinely active.
- On success, briefly show confirmation, then close the widget.

**Commit:** `fix: make handwriting submit one-tap and recoverable`

---

### Task 5: Reduce export latency and main-thread work

**Objective:** Avoid encoding and uploading a full 3600×2400 PNG when the handwritten content occupies a small region.

**Files:**
- Modify: `src/utils/drawing.ts`
- Create: `src/utils/drawing.test.ts`

**Failing tests first:**
1. Export computes a content bounding box with padding.
2. Empty work is rejected before export.
3. Export maximum dimension is bounded while preserving aspect ratio.
4. The output includes all visible strokes without clipping.
5. Export metadata reports width, height, and byte size for diagnostics.

**Implementation:**
- Crop to stroke bounds plus grid/padding.
- Cap the longest edge at a model-readable size rather than always exporting 8.64 million pixels.
- Preserve PNG transparency/background behavior required by the model.
- Run expensive export only once per submission attempt and cache the Blob for Retry.

**Commit:** `perf: bound papa handwriting export size`

---

### Task 6: Replace pointer globals with an exclusive input state machine

**Objective:** Ensure Pencil owns drawing and two-finger touch owns viewport gestures without cross-contamination.

**Files:**
- Create: `src/input/pointerMachine.ts`
- Create: `src/input/pointerMachine.test.ts`
- Modify later: `src/hooks/useWhiteboard.ts`

**State model:**

```text
idle
├─ pen-drawing(pointerId)
├─ touch-drawing(pointerId)   [only if finger drawing remains enabled]
└─ touch-gesture(pointerIds, pinchStart)
```

**Failing tests first:**
1. Pen down + touch down never creates a touch stroke or changes the Pencil stroke owner.
2. Touch up never terminates an active Pencil stroke.
3. Two touch pointers cancel an incomplete touch stroke and enter gesture mode.
4. Two-finger movement changes viewport only and appends zero stroke points.
5. Returning from two fingers to one finger does not resume drawing mid-gesture.
6. `pointercancel`, `lostpointercapture`, blur, fullscreen exit, and visibility loss clear relevant state safely.
7. Hover/move without an active pointer cannot draw, erase, or pan.
8. A third touch does not corrupt pinch state.

**Implementation:**
- Track `drawingPointerId` separately from active gesture pointers.
- Process drawing moves only when `event.pointerId === drawingPointerId`.
- Keep gesture and drawing modes mutually exclusive for touch.
- Decide and document the user policy: Pencil writes; fingers navigate. If finger writing is retained, expose it deliberately rather than inferring it mid-gesture.

**Commit:** `fix: isolate pencil drawing from touch gestures`

---

### Task 7: Integrate pointer state and complete lifecycle cleanup

**Objective:** Wire the tested pointer machine into React and WebKit event paths.

**Files:**
- Modify: `src/hooks/useWhiteboard.ts`
- Modify: `src/components/DrawingBoard.tsx`
- Modify: `src/types.ts`
- Create: `src/hooks/useWhiteboard.test.tsx`

**Failing tests first:**
1. Dispatch the exact Pencil + two-finger sequences from the production report.
2. Verify `onLostPointerCapture` resets state.
3. Verify fullscreen exit cancels incomplete strokes and gestures.
4. Verify eraser/pan do nothing on hover-only pointer moves.
5. Verify pointer capture rejection still permits normal Pencil drawing.

**Implementation:**
- Bind `onLostPointerCapture`.
- Add window/document cleanup listeners where required.
- Remove stale global `activeStrokeId` behavior after the new owner model is active.
- Keep `preventDefault`/`stopPropagation` canvas-scoped.

**Commit:** `fix: harden ipad pointer lifecycle`

---

### Task 8: Replace stroke-only Undo/Redo with reversible history

**Objective:** Make pen, eraser, and Clear actions reversible and expose accurate button states.

**Files:**
- Create: `src/history/boardHistory.ts`
- Create: `src/history/boardHistory.test.ts`
- Modify: `src/hooks/useWhiteboard.ts`
- Modify: `src/components/BottomBar.tsx`
- Modify: `src/App.tsx`

**Failing tests first:**
1. Undo/Redo restores a pen stroke exactly.
2. Undo restores strokes removed by eraser.
3. Undo restores all strokes removed by Clear.
4. Redo reapplies erase and Clear.
5. A new action after Undo clears the redo branch.
6. Cancelled two-finger touch strokes never enter history.
7. `canUndo` and `canRedo` match actual history state.

**Implementation:**
- Use reversible commands or bounded snapshots; choose the simpler implementation that preserves correctness.
- Commit one history action per completed stroke/erase gesture/Clear, not per pointer move.
- Disable Undo/Redo buttons when unavailable.

**Commit:** `feat: add reversible papa board history`

---

### Task 9: Make fullscreen controls safe-area aware and one-dimensional

**Objective:** Keep the writing surface and primary action accessible above ChatGPT’s overlaid composer.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useOpenAiHost.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/FloatingTools.tsx`
- Modify: `src/components/BottomBar.tsx`
- Modify: `src/styles.css`
- Create: `src/components/fullscreen-layout.test.tsx`

**Failing tests first:**
1. Host `safeArea` updates apply bottom padding to controls.
2. Submit remains inside the visible area at 800×600.
3. Portrait and landscape layouts have no overlapping controls.
4. Fullscreen mode does not display another “เต็มจอ” button.
5. Every interactive target is at least 44×44 CSS pixels.

**Implementation:**
- Subscribe to `window.openai.safeArea` through `openai:set_globals`.
- Put essential controls in one compact row or two responsive groups above the safe-area inset.
- Remove the redundant fullscreen button from fullscreen mode.
- Keep Submit visually primary; make destructive Clear secondary.
- Use Thai labels consistently or accessible icon labels where space is constrained.

**Commit:** `fix: keep papa controls above chatgpt composer`

---

### Task 10: Persist unsent work

**Objective:** Prevent accidental fullscreen closure or host reload from destroying the learner’s work.

**Files:**
- Create: `src/persistence/widgetDraft.ts`
- Create: `src/persistence/widgetDraft.test.ts`
- Modify: `src/hooks/useWhiteboard.ts`
- Modify: `src/hooks/useOpenAiHost.ts`

**Failing tests first:**
1. Completed strokes are serialized after a debounce.
2. A remounted widget restores valid saved strokes.
3. Corrupt/oversized state is rejected safely.
4. Successful submission clears only the submitted draft at the correct time.
5. Failed submission preserves the draft.

**Implementation:**
- Persist compact vector strokes through widget state/private content where bridge limits permit.
- Restore once at mount without overwriting newer in-memory changes.
- Bound serialized state size and avoid storing sensitive conversation text.

**Commit:** `feat: preserve unsent papa handwriting drafts`

---

### Task 11: Add production diagnostics without exposing user work

**Objective:** Identify whether failures occur during export, upload, attachment, follow-up, close, or MCP resource lookup.

**Files:**
- Create: `src/diagnostics/submitDiagnostics.ts`
- Create: `src/diagnostics/submitDiagnostics.test.ts`
- Modify: `src/hooks/useSubmitHandwriting.ts`
- Modify: `lib/mcp-app.mjs`

**Tests:**
1. Diagnostic events contain stage, duration, status, app version, and anonymized operation ID.
2. Events never include image bytes, strokes, equations, prompts, credentials, or file contents.
3. User-facing errors remain plain Thai and do not expose raw exceptions.

**Implementation:**
- Add a visible “รายละเอียด” diagnostic code on failures for support.
- Add server-side request IDs and structured MCP errors.
- Keep logs bounded and privacy-safe.

**Commit:** `chore: add privacy-safe papa diagnostics`

---

### Task 12: Install missing quality gates and CI

**Objective:** Make regressions block deployment automatically.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.github/workflows/ci.yml`
- Create: `playwright.config.ts`
- Create: browser tests under `e2e/`

**Steps:**
1. Add TypeScript, Vitest, jsdom/testing-library, and Playwright as development dependencies.
2. Add scripts: `typecheck`, `test:unit`, `test:integration`, `test:e2e`, and `verify`.
3. Make `verify` run syntax, typecheck, all tests, build, dependency audit, and `git diff --check`.
4. Add CI with pinned Node version and artifact capture on browser-test failure.
5. Add MCP compatibility probe as a deployment gate.

**Commit:** `ci: gate papa releases on integration tests`

---

### Task 13: Staging and real-iPad acceptance

**Objective:** Prove the full learner journey before production promotion.

**Environment:** Separate staging Vercel deployment and a newly refreshed staging connector.

**Scripted acceptance:**
1. Ask for one exercise and open Papa.
2. Verify the exact problem appears inside the fullscreen board.
3. Write with Pencil while placing palm and one finger on screen.
4. Pan and pinch with two fingers at least ten times; confirm no ink appears.
5. Undo/Redo pen, eraser, and Clear.
6. Rotate portrait ↔ landscape; confirm toolbar remains above composer.
7. Tap Submit exactly once.
8. Verify visible stage progress, widget closure, image arrival, and one model follow-up.
9. Repeat thirty times under normal Wi-Fi and throttled/briefly interrupted network.
10. Force each failure stage and verify Retry preserves work.
11. Open an older chat/card and verify compatibility aliases still work.

**Evidence:**
- Record pass/fail table, timestamps, screenshots, diagnostic IDs, and duplicate-message count.
- Any failed P0 scenario blocks promotion.

---

### Task 14: Independent review and controlled production promotion

**Objective:** Ship only a verified commit with rollback available.

**Steps:**
1. Run `npm run verify` from a clean working tree.
2. Run an independent security/logic review using the requesting-code-review workflow.
3. Resolve all blocking findings and rerun the complete suite.
4. Commit with `[verified]` prefix.
5. Deploy that exact commit to production.
6. Probe all current and legacy tools/resources on production.
7. Refresh the production connector and run one final iPad smoke test.
8. Monitor Submit diagnostics; rollback immediately if P0 errors recur.

**Commit:** `[verified] fix: stabilize papa learning workflow`

---

## Primary files likely to change

- `lib/mcp-app.mjs`
- `src/hooks/useSubmitHandwriting.ts`
- `src/hooks/useWhiteboard.ts`
- `src/hooks/useOpenAiHost.ts`
- `src/components/DrawingBoard.tsx`
- `src/components/BottomBar.tsx`
- `src/components/FloatingTools.tsx`
- `src/styles.css`
- `src/types.ts`
- `src/utils/drawing.ts`
- `package.json`
- New state-machine/history/persistence modules and tests

## Risks and tradeoffs

- ChatGPT owns inline-card ordering; Papa cannot guarantee that the launcher appears after generated model text. Keep the problem inside the fullscreen app instead of fighting host DOM order.
- `requestClose()` is host-controlled and may be declined; retain an inline-mode fallback and explicit success state.
- Persisted vector drafts must be size-bounded to avoid oversized widget state.
- Legacy aliases increase server metadata temporarily, but removing them early breaks cached chats; compatibility is the safer tradeoff.
- Synthetic tests cannot replace real iPad/WebKit validation, so production remains blocked until the physical-device run passes.

## Recommended execution order

1. Compatibility and rollback safety.
2. Submit state machine and close-to-chat flow.
3. Pointer state machine.
4. Complete history and draft persistence.
5. Safe-area UX.
6. CI, staging, real-iPad acceptance, independent review.
