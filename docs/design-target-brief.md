# Fabula target experience and UI design brief

## How to use this brief

This is a target-state brief, not an audit. It describes what Fabula should become for the person in the director's chair, what each surface is for, and what it should make possible. It deliberately leaves the information architecture, page count, navigation model, visual language, component patterns, and interaction mechanics open. The surface inventory below is a starting menu of jobs to be done, not a sitemap. Add surfaces, merge them, split them, rename them, or remove them if the journeys remain intact and the product laws remain visible. Where this brief names a pattern such as an inline card, a full-screen map, or a bottom composer, treat it as an example of the outcome, never as a required widget.

The brief is addressed to a design partner with taste, judgment, and permission to propose a stronger product. Aim for best practice in information architecture, interaction design, accessibility, responsive behavior, content design, and performance. Aim equally for delight: the product is about stories, performances, and the pleasure of directing a talented cast. It should not look or feel like a generic AI chat application, a database administration tool, or a form builder. It should feel like a place where stories are made.

## The product and the promise

Fabula is a realtime roleplay studio where the entire cast is played by AI and the human is the director. A scene has a premise, a world, a tone, content boundaries, a chosen presentation style, and an ensemble of structured roles. The story unfolds in beats, one turn at a time. The human can shape it in three ways: choose one of several AI-written continuations, give an out-of-character direction from the wings, or step into any role and perform a line themselves. Every choice can branch. Nothing is destroyed. Editing or regenerating a moment creates a new path while the original remains.

The promise is not "chat with characters." The promise is "direct a story that feels written for you, with the control of a director and the surprise of live performance." The product should make the human feel creative, in command, and a little thrilled. It should make the AI cast feel like a troupe with chemistry, secrets, and voices rather than a set of text generators. It should make the story's memory, branches, and consequences tangible without turning the experience into project management.

The product is guest-first. A person can arrive, start a scene, meet a cast, and play without an account. Identity and scene ownership should be easy to claim later, never demanded up front. The entire application is self-hostable, with AI providers as the only external dependency, so the design must not assume a managed platform, a social login monopoly, or a cloud-only account model. It should also be ready to grow into co-play, spectators, voice, and a public gallery without needing a new shell or a new mental model.

## The experience target

The emotional target is a warm, focused rehearsal room with a stage attached. The story is the brightest thing in the room. The controls are close at hand, precise, and quiet until needed. The director can read for a while, then reach out and change the temperature of the scene without leaving the page or losing the thread. The interface should feel literary and theatrical, not corporate, not gamified, and not sterile. It should have moments of ceremony: the cast arriving, the first voice, the opening beat, the first fork, the wrap.

The functional target is flow. A first-time visitor should understand the promise in seconds, start a scene in a minute, and reach a playable opening without a manual. A returning director should resume a scene in a couple of actions and immediately know what happened while they were away. A deep user should be able to inspect the story's memory, navigate a tree of branches, compare paths, see what a generation cost, and understand why a role said what it said, without those powers crowding the reading experience. The interface should use progressive disclosure so that the beginner sees a stage and the expert can open the wings.

The craft target is high. Typography should make long-form reading a pleasure. Hierarchy should make the next action obvious without making every action equally loud. Color should give roles identity and give the interface emotional temperature. Motion should clarify change and never delay it. Sound, if used, should be optional and restrained. Empty states should teach. Errors should reassure and recover. The product should feel inevitable in use, as if directing a story could not have been designed any other way.

## Design principles

The story is the interface. During reading, chrome should recede. Controls should appear when the director signals intent: a hover, a focus, a tap, a keyboard shortcut, an explicit mode. The scene should not be trapped inside a dashboard. The measure, type, spacing, and pacing of prose deserve the same care as the controls. If a surface does not help someone read, direct, or understand, it should justify its presence.

Directing should feel like a creative act, not configuration. The three verbs, choose, steer, and perform, should be distinct in intent and consequence. Choosing a path is committing to a future. Steering is adjusting the weather. Performing is stepping onto the stage. The interface should make those differences obvious in wording, placement, and feedback, and should never make the director wonder which one they are about to do.

Consequence should be visible. Branching is the product's signature idea, and it should be felt rather than memorized. A fork should look like a fork. A ghost path should feel like a possibility that is still alive. Memory should be understood as what this timeline knows, not as a hidden database. Undo should be present, honest, and fast. The director should never fear that experimentation will ruin the story.

Complexity should be progressive. The first session should ask for very little and reveal depth only when it helps. The expert surfaces, including prompt provenance, token budgets, branch comparison, and memory scopes, should be reachable, legible, and clearly separated from the primary creative flow. Recognition should beat recall: show the current state, the available moves, and the consequence of the selected move rather than relying on documentation.

Teaching should happen in context. Empty states, first-run moments, microcopy, and small demonstrations should explain the mental model at the moment it becomes relevant. The product should not require a manual to understand pick, steer, write, fork, or wrap. A help surface should exist, but the interface itself should be the best teacher.

Design for the second session, not only the first. The first scene is a conversion event. The second scene is the product. Returning directors need a home, a sense of continuity, a way to resume, a recap of what changed, and a reason to come back. The library, the scene overview, notifications, and the wrap experience matter as much as the creation flow.

Safety and reversibility should be designed, not promised. Destructive language and destructive actions should be absent. Confirmation should appear where it prevents a real mistake, not as a tax on every action. Undo should be the default safety net. Soft states such as off-stage, muted, archived, and artifact should be explained in human terms. The director should always know whether they are changing canon, creating an alternative, or merely adjusting the lens.

Mobile is a first-class directing chair, not a collapsed desktop. The phone experience should be designed around one hand, short sessions, thumb reach, interruptions, and reading in bed. The spatial idea of branching needs a mobile expression that is not a tiny desktop graph. The composer, the options, the cast, and the memory should each have a native-feeling mobile pattern. Tablet should feel like a director's clipboard, not a squeezed laptop.

Accessibility is craft. Every core journey should work with a keyboard, a screen reader, zoom, reduced motion, and high contrast. Color should never be the only carrier of meaning. Streaming and live updates should be announced politely, not constantly. Touch targets should be generous. Language should be plain. The product should meet WCAG 2.2 AA at minimum, with body reading text aspiring to AAA contrast where the visual system allows it. Accessibility should shape the design from the first sketch, not be retrofitted.

Performance is a feature. The story should feel immediate. Streaming should start quickly, feedback should be optimistic where safe, lists should stay smooth at hundreds of beats, and heavy surfaces should load only when opened. Loading, offline, reconnecting, and degraded-network states should be designed as first-class experiences. A beautiful interface that stutters is not a beautiful interface.

Trust should be visible. The director should know when text is AI-generated, what it costs, who can see a shared scene, what a permission allows, and where their scenes live. Cost should be transparent and predictable, with soft budgets and clear estimates. Privacy should be explained in plain language. Sharing should be revocable and legible. The product should never use dark patterns to keep attention, hide spending, or obscure control.

Delight should be restrained. The product should have personality: a turn of phrase, a sound of a curtain, a well-timed transition, a beautiful avatar, a voice that lands. But delight should never compete with reading, slow down a decision, or become noise after the tenth time. The best delight is the feeling that the tool understands the creative act.

Design a system, not a pile of screens. The visual language, spacing, type, color, motion, states, and components should form a coherent system that can absorb new surfaces such as co-play, voice, gallery, and spending without a redesign. The system should be documented enough to keep quality high and flexible enough to allow surprise.

## The target journeys

The first visit should feel like being handed a playbill. A visitor lands on a public page that explains the promise in one breath, shows a glimpse of a cast and a scene, and offers a way to start without an account. The page should answer three questions instantly: what is this, what do I do, and what happens if I try. A short interactive demonstration or a playable sample is worth more than a feature grid. The call to action should be specific and inviting, not generic. The visitor should be able to start with a single line and no configuration, while seeing that deeper control exists if they want it.

The first scene should feel like a spark. The director gives a premise, chooses a tone and perhaps a role, and watches a cast arrive. The wait should be part of the performance: progressive reveals, names appearing, voices forming, a sense of a troupe walking in. The director should be able to react during the reveal, skip ahead, or simply wait. When the cast is ready, the director meets them in a green room, hears a voice, adjusts a detail, and raises the curtain on an opening beat. The time from first visit to first playable beat should be short enough to feel effortless, and the experience should teach the three verbs before the first decision arrives.

The first decision should feel like possibility, not homework. When path options appear, the director should understand that these are possible futures, not a quiz. Each option should communicate who speaks, what kind of move it is, and enough of the moment to choose by instinct, with the full text available on demand. Choosing should feel consequential and safe at the same time. The director should see the chosen path become canon and the other options remain visible as paths not taken. Undo should be one gesture away.

The returning session should feel like coming back to a rehearsal. The director opens a personal home, sees the scenes in progress, a short recap of what happened, and a clear way to resume. The library should preserve the emotional attachment to a story: a title, a cast, a last line, a sense of where it paused. It should also make room for new experiments. The path from arrival to the right scene should take seconds, not navigation archaeology.

A deep session should feel like having the whole production at hand. The director can read the story, pause the automatic floor, steer the cast, write in character, branch deliberately, inspect what the scene remembers, look at the shape of the timeline, compare two paths, and see the cost of a generation. None of those powers should force themselves into the reading view. The transition between the story and the control room should be smooth, reversible, and clearly signposted.

Sharing should feel like inviting someone into the audience. The director creates a link, chooses whether the guest can watch or also pick paths, and sees who is present. The guest should not need an account. The shared surface should be beautiful, legible, and unmistakably read-only or direct-capable. Revocation should feel immediate and safe. Presence should add warmth, not surveillance.

Wrapping should feel like closing a production, not deleting a file. The director receives an offer when the story feels resolved, never an automatic ending. Wrapping should summarize, freeze the canonical tree, and open a replay that feels like a finished work. The archive should celebrate the story: a cover, a cast, a synopsis, every branch, the paths not taken, and a way to share or export. Reopening should be possible without loss.

Claiming an account should feel like keeping a ticket stub. The director can continue as a guest, then optionally claim their scenes, keep their identity across devices, and understand exactly what is stored and who can see it. The account should never gate the first scene or the joy of experimentation. It should feel like a library card, not a subscription.

The future co-play journey should feel like a table read with friends. Human seats, AI roles, spectators, turn handoff, passing, and private knowledge should all be legible without turning the scene into a lobby with a settings panel. The future voice journey should feel like a radio play, with per-role voices, continuous playback, captions, and a text experience that never depends on audio. The future community journey should feel like a curated shelf of worlds, with publishing, discovery, remixing with attribution, and moderation that protects the audience.

## Target surfaces

The surfaces below are a starting inventory of jobs. A surface can be a page, a mode, a pane, a sheet, a command, or an overlay. The designer should choose the pattern that best serves the job and should feel free to combine or eliminate surfaces. What matters is that every job has a home and every home has a clear purpose.

### The public home

The public home is a doorway, not a dashboard. Its job is to make a curious visitor understand the product, feel its personality, and start a scene with minimal commitment. It should lead with the promise and a glimpse of the experience: a cast with faces and voices, a line of prose, a fork in a story, a sense of a director shaping a scene. It should explain the three ways to direct in plain language and show that no account is required. It should offer one primary path into creation and a secondary path for browsing worlds. It should carry trust signals about AI use, privacy, cost, and self-hosting without turning into a policy page.

The target qualities are welcome, intrigue, and confidence. It should feel like a poster for a play, not a SaaS landing page. It can be editorial, cinematic, or interactive. It should have a clear hierarchy and a fast path to action. It should work beautifully on a phone and not overwhelm on a large screen. The design should make the product memorable in ten seconds and credible in thirty.

The home should have a designed experience for a visitor who has been there before, without hiding the public promise from someone who has not. It should be the place where a returning director can see their scenes, or at least the doorway to that place. The designer may choose a single adaptive home with both public and personal modes.

### The director's home and scene library

The director's home is the personal studio. Its job is to answer "what am I working on, what happened, and what should I do next" in a single glance. It should show scenes in progress, paused, wrapped, and archived, with enough context to recognize each one: title, premise, cast faces, last line, branch count, last activity, and status. It should make resuming effortless and creation inviting. It should support search, filters, sorting, and grouping when the library grows, without making the simple case feel heavy.

This surface should feel like a writing desk with a few beloved notebooks, not an enterprise dashboard. The cards or rows should have emotional weight. A scene that has not been touched in a while should invite a return, perhaps with a short recap or a "continue where you left off" cue. An empty library should teach the product and offer a strong first step. The surface should also be the natural home for account status, preferences, and the claim prompt, without turning into a settings warehouse.

The designer should consider whether the library is a page, a panel, or the default state of the home. It should be possible to add scenes, duplicate or remix a scene, archive a scene, export a scene, and share a scene from here. The library should scale to hundreds of scenes and to co-play invitations without losing calm.

### The create hub

The create hub is the moment of choosing how to begin. Its job is to reduce decision fatigue while preserving creative control. It should present a small number of genuinely different starting modes, each with a clear promise about time, control, and output. A one-line quick start, a guided setup, a curated world, a remix, and a blank page are all legitimate modes. The designer may replace the "hub" with a single adaptive flow that asks one question at a time, or with a gallery that includes a quick start. The important outcome is that a newcomer can start in one action and an experienced director can reach the exact kind of control they want without hunting.

The target qualities are momentum and clarity. The surface should feel like the first minute of a rehearsal: welcoming, full of possibility, and not yet bureaucratic. It should state the cost of each path in time and attention, not just in features. It should never require an account, and it should preserve a draft or a premise if the director is interrupted. The design should make the difference between "surprise me" and "let me build it" obvious.

### Quick start

Quick start is the shortest bridge from curiosity to a playable scene. Its job is to take a premise, a tone, a decision about whether the director performs, and a cast size, and turn them into a troupe and an opening without a long form. It should ask only for what changes the result and hide the rest behind an optional advanced disclosure. It should offer inspiration, examples, and a "surprise me" path. It should make the director feel that one good line is enough.

The wait after submission is part of the experience. It should communicate progress honestly, show the cast taking shape, allow the director to cancel or retry, and avoid a blank spinner. If something fails, the premise and choices should survive. When the cast arrives, the quick path should hand off to the same cast studio and opening experience as the guided path, with a lighter default view rather than a different product.

The design should make the promise concrete: a playable opening in a small number of minutes. It should be usable on a phone with one hand and on a desktop with a keyboard. It should be warm, fast, and free of account friction.

### Guided setup

Guided setup is for the director who wants intention. Its job is to turn a vague idea into a world with a tone, a style, boundaries, a human role or a director-only perspective, and a cast size. It should feel like a conversation with a dramaturg, not a tax form. Each step should have a clear question, a meaningful default, a concise explanation of why the answer matters, and a visible way to go back. It should show a live preview or a growing summary so the director can see the scene forming.

The target is control without overwhelm. The flow should be short enough to finish in one sitting and flexible enough to skip, save, or revisit. The URL or session state should allow a reload without losing progress. Errors should be specific and recoverable. The final step should feel like a green light, not a submit button at the end of a questionnaire. The designer may choose a linear wizard, a single page with progressive sections, or a conversational flow, as long as the mental model stays simple and the director never loses the thread.

### The template gallery and world discovery

The gallery is a shelf of invitations. Its job is to help a director who does not arrive with a premise find a world worth entering. Each template should communicate a genre, a mood, a premise, a cast shape, and a promise of play in a glance. It should be possible to preview a first beat or a sample voice, and to start from a template without editing every field. The gallery should support browsing, searching, filtering, and a playful "surprise me" path. It should be curated enough to feel intentional and open enough to grow into a community gallery later.

The target qualities are taste, atmosphere, and ease. The gallery should feel like a collection of worlds, not a list of configuration presets. Each card should have a strong visual identity and a clear invitation. The designer should feel free to invent collections, editorial features, seasonal shelves, or a recommendation surface. The template should remain a starting point, not a cage: every generated role and setting must be editable, and the product should make that clear.

### The casting reveal and the green room

The arrival of the cast is the product's first piece of theater. Its job is to turn a generation wait into a memorable reveal and then into a place where the director can meet the troupe. The reveal should be progressive, with names, faces, hooks, and voices appearing in a way that feels alive. It should tolerate slowness gracefully and allow the director to interact as soon as enough is ready. It should surface casting warnings and constraints in human language, not as a validation report.

The green room is where the director and the cast meet before the scene begins. It should be a place of delight and judgment: the cast should feel like an ensemble, with visible chemistry, relationships, contrasts, and distinct voices. The director should be able to hear a sample line, read a secret, change a detail, lock what they love, regenerate what they do not, reorder the ensemble, add a role, duplicate one, move one off-stage, and resize the cast. It should be possible to do all of that without losing the sense of the characters as people.

The surface should support two depths: a fast review for the director who wants to start, and a deep studio for the director who wants to shape every detail. The fast view should show the essentials that create confidence: name, face, hook, voice, relationships, and one strong line. The deep view should expose psychology, voice mechanics, goals, boundaries, relationships, and casting metadata. The transition between the two should be obvious and reversible. Locks, changes, and regeneration effects should be unmistakable. The human role, when there is one, should be edited with the same care and should feel like part of the ensemble rather than a special case in a settings panel.

The target feeling is "I know this troupe, and I want to see them play." The design should avoid the feeling of editing a spreadsheet or a character sheet database. It should use voice, typography, color, grouping, and performance to make the cast feel embodied. Mobile should offer a rhythm of one role at a time, a swipeable ensemble, or a compact green room, not a horizontally squeezed grid.

### The opening and the curtain

The opening is the first moment of the story and the last step before play. Its job is to let the director choose how the scene begins: generate an opening, reroll it, write it themselves, or shape it with a short direction. It should show the opening in the chosen presentation style, at reading quality, and make it feel like the curtain rising. It should be possible to choose or change the opening speaker or point of view, and to hear the voice that will carry it.

The target is agency without pressure. The director should be able to accept the first good opening and start immediately, or linger and craft it. The opening should never be committed accidentally. The transition into play should feel continuous, as if the director steps from the green room onto the stage. The design should make clear what will happen when the scene starts, and should preserve the opening as an editable, forkable moment later.

### The play console

The play console is the heart of the product. Its job is to make reading the story and directing it feel like one continuous activity. The story should be the hero of the surface: a beautiful, legible, paced reading experience that works for chat, script, and novel presentation styles. The cast should be present as people, not as a dropdown. The floor should be legible at a glance. The next action should be obvious without the interface shouting.

The console should support three directing intentions without ambiguity. Choosing a path should feel like selecting a future. Steering should feel like adjusting the performance from the wings. Performing should feel like stepping into a role. The composer, the options, and the shortcuts should make those intentions distinct, and the director should always understand whether an action will create canon, fork a branch, or queued for the next beat. Confirmation should be reserved for genuinely surprising or branch-creating consequences; everything reversible should be undoable in place.

The story surface should be a pleasure to read for a long time. It should support a comfortable measure, adjustable type and density if useful, clear speaker identity, role color used with restraint, and a distinction between speech, narration, and stage direction that is typographic rather than noisy. Streaming should feel alive but not jittery. New beats should arrive without stealing the director's scroll position. A live beat should be distinguishable from a finished one. A failed attempt should be recoverable without corrupting the story. A pinned or important beat should be findable.

The console should make the shape of the story available without leaving the reading experience. A lightweight sense of where the director is in the timeline, where forks exist, and how many alternatives remain should be present. The full map, memory, and provenance can live in deeper surfaces, but the console should never make the director feel lost in time.

The console should be designed for interruption and return. A director may close the tab mid-beat, switch devices, lose connection, or come back hours later. The state should be durable, and the surface should explain what happened while they were away. Reconnection should feel calm. Offline or degraded states should preserve reading and clearly indicate what cannot be changed yet.

The console should be a joy on mobile. It should not be a desktop control room squeezed into a phone. The reading experience should be primary, the composer should be reachable with a thumb, the cast and the deeper surfaces should open as focused modes, and the spatial story should have a mobile expression that is understandable without pinch-zooming a graph. One-handed use, safe areas, short sessions, and interruption recovery should shape the design.

The target feeling is flow. The director should be able to play for an hour without fighting the interface, and should be able to explain the story's state to a friend in one sentence.

### The directing layer

The directing layer is the set of controls through which the director shapes the next beat. Its job is to make choose, steer, and perform feel like three natural creative acts. It should be present when needed, quiet when not, and consistent across desktop and mobile. It should offer suggestions without prescribing them, quick actions without hiding depth, and feedback that makes the consequence of an action clear before it lands.

Choosing should present a small number of genuinely different futures with enough context to choose by instinct: who speaks, what kind of move it is, and a preview of the text. The full text should be available without leaving the moment. The options should belong to the beat that produced them, not float in a generic panel. Taking a path should feel decisive and reversible.

Steering should accept an out-of-character direction in natural language, offer inspiration for directors who are stuck, support standing constraints and do-not instructions, and make it clear when a steer applies. It should be possible to steer and continue, or steer and rewrite the last beat, without confusing the two. Active notes should be visible and removable.

Performing should let the director write as any active role, with the role's voice and context visible, and should make it clear that the line will become canon. It should respect the scene's boundaries and presentation style. It should be possible to draft, edit, and cancel before committing.

The directing layer should support keyboard-first use, command search, and shortcuts without requiring them. It should have a clear hierarchy of primary and secondary actions. It should never present a wall of equal-weight buttons. It should make the cost and latency of an action predictable, and should degrade gracefully when the model is slow or unavailable.

### The story map and branch explorer

The story map is the director's view from above. Its job is to make the multiverse of the scene legible: the active path, the decision points, the forks, the ghost paths, the branches that were abandoned, and the shape of the whole story. It should answer "where am I, what else exists, and what happens if I go there" without requiring the director to read a graph legend.

The map should be spatial where space helps and narrative where space does not. It should show beats as moments with speaker, origin, and status, branches as paths with identity, and decisions as genuine forks. The active path should be unmistakable. Ghosts should feel like preserved possibilities, not errors. Switching branches should be safe and explicit, and the director should understand that switching context does not rewrite the story. The map should support zoom, pan, focus, search, and a keyboard-navigable alternative. It should be beautiful enough to be a poster of the story and practical enough to navigate a hundred beats.

On mobile, the map should have a different expression, perhaps a timeline, a chapter list, a branch switcher, or a vertical tree that preserves the same understanding. The designer should not simply shrink the desktop canvas. The map should also be the natural home for comparing two branches, reading a branch summary, renaming or annotating a branch, and exporting a subtree. It can be a page, a mode, a panel, or a dedicated studio, as long as it is reachable in one clear action and does not compete with reading.

### Memory and the story bible

Memory is what the story knows. Its job is to make the scene's continuity understandable and editable without exposing the machinery of retrieval. It should show the facts, relationships, promises, secrets, open threads, and summaries that shape the next beat, organized around the director's mental model of the story rather than around database tables. It should make clear what belongs to this path, what is global canon across branches, what is off-path, and what is muted. It should make contradictions visible and easy to resolve.

The target is a dramaturg's bible, not a debug log. The director should be able to ask "what does this character know," "what has the story established," and "why did the cast forget that?" and get a human answer. Facts should be phrased as story truths, grouped by subject, time, and relevance. Relationships should be navigable as a social web. Summaries should read like recaps. Pins and mutes should be explained in terms of consequence. The surface should support editing, adding, and reconciling canon, with clear feedback about what will change in future prompts.

The designer should decide whether memory is a page, a panel, a mode, or a layer of the story map. It should be discoverable when continuity matters and invisible when it does not. It should be accessible to non-technical directors and still satisfy power users who want to audit exactly what the model will see.

### The scene overview and production settings

Every scene needs a production page. Its job is to be the home base for a single story: the title, premise, cast, world, tone, presentation style, boundaries, pacing rules, branch cadence, budget, sharing, exports, and status. It should show the story's life cycle clearly: draft, in progress, paused, wrapped, archived. It should make it easy to rename, revise, continue, duplicate, remix, share, export, or archive. It should offer a recap for a director returning after time away and a cast gallery for anyone who wants to remember who is in the story.

The target feeling is a playbill and a production binder in one. It should be informative, beautiful, and calm. It should not be a settings maze. The most important controls should be obvious; the rest should be grouped and explained. Changes that affect future generations should say so. Changes that affect canon or existing branches should be treated with extra care. The page should make the relationship between the scene, its branches, and its archive obvious. It should be reachable from the library, the play console, and the archive, and it should be the natural place to invite collaborators or spectators in the future.

### The archive and replay

The archive is the finished story as an object. Its job is to let a director revisit a completed scene with pleasure, understand its whole shape, and share or export it. It should present the story as a work: a title, a cast, a synopsis, a cover-like identity, and a replay experience that honors the prose. It should show every branch, not just the mainline, and it should preserve the paths not taken as part of the story's history. It should offer a timeline or scrubber, chapter markers, a branch explorer, and a director's commentary if that enriches the experience.

The replay should be read-only in the sense that it cannot accidentally alter canon, but it should not feel dead. It can be cinematic, paced, and atmospheric. It should let the director jump to a moment, switch branches, inspect a beat, and export. It should also make it possible to reopen a scene, with a clear explanation of what that means, because the product's promise is that nothing is destroyed. The archive should work as a live snapshot for an in-progress scene and as a finished artifact for a wrapped one.

The target qualities are closure, pride, and portability. The director should want to share the archive, reread it, and keep it. Exports should be clean, complete, and understandable outside the product. The archive should be a natural bridge to the public gallery in the future.

### Sharing, watching, and presence

Sharing is the audience door. Its job is to let a director invite someone into the story with exactly the right permission and no account friction. The flow should make the difference between watching and directing unmistakable. A viewer should see a beautiful live or archived scene, understand that it is read-only, and feel present. A director guest should be able to pick paths and nothing else, with the same clarity about what that permission allows. The host should be able to see who is present, revoke access immediately, and understand that revocation does not harm the story.

The shared surface should feel like a theater audience experience. It should have a clear title, a sense of liveness, presence that adds warmth without surveillance, and a graceful state for a scene that is paused, wrapped, or unavailable. It should work on a phone, require no account, and explain itself in one line. Future spectators, reactions, and watch parties should be able to grow from the same surface without turning it into a social network.

The target is trust. The director should never wonder who can see the scene or what a link can do. The guest should never wonder whether they are allowed to act.

### Account, identity, and claiming

Identity should be optional and legible. The account surface should let a guest claim their scenes, continue across devices, choose a display name, manage preferences, and understand where their data lives. It should explain the difference between a browser session and an account in plain language, and it should make claiming feel like preserving something valuable rather than signing up for a service. Sign-in methods should be simple and appropriate for a self-hosted product. Sign-out should be explicit about what happens to guest data.

The target qualities are safety, continuity, and privacy. The account surface should not feel like a gate, a subscription funnel, or a corporate profile. It should feel like a library card for a creative practice. It should include data export and a clear privacy explanation. It should be reachable from the library, the scene overview, and a quiet prompt after the first scene, never from a blocking modal before the first scene.

### Help, learning, and the director's handbook

Help should teach the product's mental model at the moment it is needed and remain available as a reference. Its job is to explain the three directing modes, branching and ghosts, memory and canon, the floor, presentation styles, sharing, cost, privacy, and the keyboard map. It should use the product's own language and real examples from a scene. An interactive fork demonstration, a short guided tour, or a replayable first-scene walkthrough will teach more than a glossary alone.

The target is confidence. A director should be able to recover from confusion without leaving the story, and a curious director should be able to go deeper without reading a manual. Help should be contextual, searchable, and friendly in tone. It should be a place, a command, and a set of inline explanations that share one voice. The designer should feel free to invent a "director's handbook," a set of short animated lessons, or a contextual coach that appears only when the director is stuck.

### Global navigation and the command layer

The product needs a fast, coherent way to move between the library, creation, a scene, the archive, help, and account. The navigation should be shallow, predictable, and quiet. It should make the current context obvious, support going back without losing state, and keep deep links shareable. A command palette or universal search should make every important action reachable from the keyboard and from a single search field. It should understand scenes, roles, actions, and help topics, and it should learn from recency without becoming a mystery.

The target is a sense of a single place with many rooms, not a collection of disconnected pages. The navigation should never compete with the story. On mobile it should use patterns that respect the thumb and the back gesture. On desktop it should support multi-pane work without turning into an IDE. The designer may invent a spatial navigation metaphor, a persistent rail, a scene switcher, or a command-first interface, as long as orientation stays effortless.

### Notifications and gentle presence

A director should be able to leave and return without missing the moment. Notifications, if the product uses them, should be sparse, batched, and meaningful: a beat is ready, a shared scene has a visitor, a wrap is suggested, a collaborator is waiting. They should respect preferences and never become a growth mechanic. In-app presence should be warm and optional. The target is a stage manager's tap on the shoulder, not a slot machine.

### Surfaces that must be able to grow

The design should leave room for co-play without repainting the whole product. Seats and invitations should be able to live near the cast, the scene overview, or the shared surface. A human turn should be a clear state with passing, waiting, and private knowledge. Spectators should extend the audience surface. Private facts and whispers should be explainable as who knows what, with collapsed rendering for those who are not entitled. Branch comparison and merge should be able to live in the map or the archive, with explicit provenance and undo. Voice and radio mode should be able to sit alongside the text as an optional layer, with captions and per-role identity. Publishing, gallery discovery, remixing with attribution, moderation, localization, offline reading, and a spend center should each have a natural home in the library, the scene overview, the archive, or a dedicated surface. The system should be designed for these additions without making the core experience feel like a platform roadmap.

## Cross-cutting design standards

The visual system should be distinctive, coherent, and built for long-form reading. It should establish a clear typographic hierarchy for display, prose, interface, metadata, and code-like information such as prompt provenance. It should define a color system with semantic roles, accessible contrast pairs, and a stable identity palette for cast members that survives across the audition, thread, map, archive, and share surfaces. It should define spacing, radii, elevation, iconography, avatar treatment, data visualization, and motion. It should support dark and light themes with equal care, and it should avoid the generic visual tropes of AI products. The brand should feel literary, theatrical, warm, and confident, with enough personality to be memorable and enough restraint to disappear during reading.

Content design should be part of the system. Interface copy should use verbs, be specific about consequences, and avoid internal jargon. Empty states should teach and invite. Errors should say what happened, what is safe, and what to do next. Confirmation dialogs should explain the consequence in human terms. Loading copy should be honest about what is happening. The tone should be warm, intelligent, and never cute at the expense of clarity. The product vocabulary should be consistent: scene, role, beat, path, branch, floor, cast, director, archive. Internal terms should never leak into the interface.

Accessibility should be treated as a design material. Every interactive surface should have a visible focus state, a logical focus order, a keyboard path, and a label that makes sense out of context. Streaming and live updates should be announced politely and sparingly. Color should not be the only way to distinguish speakers, statuses, or options. Motion should respect reduced-motion preferences. Text should support zoom and reflow. Touch targets should be generous. The reading experience should support screen readers without losing the theatricality. The product should meet WCAG 2.2 AA at minimum and should test with real assistive technology, not only automated tools.

Responsive behavior should be designed as a set of distinct experiences rather than a single canvas that shrinks. The phone experience should prioritize reading, one-handed directing, and focused modes. The tablet experience should feel like a director's clipboard with a clear primary surface and quick access to the cast and the story shape. The desktop experience can support multiple panes, but the story should keep a comfortable measure and the chrome should remain quiet. The ultrawide experience should absorb extra space without stretching prose. Orientation changes, safe-area insets, virtual keyboards, and interruptions should all be considered.

Performance should have explicit budgets and perceived-speed goals. The first meaningful paint, the time to a usable scene, the start of a stream, and the smoothness of scrolling should all be designed and measured. Heavy visualizations should load on demand. Lists should virtualize. Images and avatars should not block text. Optimistic updates should be used where they reduce waiting without lying. Offline and reconnecting states should preserve reading and explain what is paused. The interface should feel fast even when the model is slow.

Trust, privacy, and cost should be visible in the design. AI-generated content should be identifiable without being stigmatized. Sharing permissions should be stated in plain language at the moment of creation and at the moment of use. Cost estimates and budgets should be findable and understandable, with no surprise spending. Data ownership, export, and deletion policies should be explicable in the account surface and in help. The product should never use deceptive patterns, hidden defaults, or confusing permission language.

Internationalization should be considered from the start. Copy should be written to allow translation and expansion. Layouts should survive longer strings. Dates, numbers, and currency should be locale-aware. The reading experience should support right-to-left languages. The scene's play language should be a first-class setting, distinct from the interface language. The design should not assume English wordplay or Western genre conventions as universal.

Research and measurement should accompany the design. The team should test the first-session journey with people who have never used the product, the returning-session journey with people who have, and the deep-branching journey with power users. It should test on phones, with keyboards, with screen readers, and on slow connections. Success should be measured by time to first playable beat, comprehension of the three modes, comprehension of branching and ghosts, ability to resume a scene, ability to find memory and cost, sharing success, accessibility conformance, performance budgets, and qualitative delight and trust. The target is not only "usable." It is "I want to do that again."

## Fixed points and creative freedom

The product laws are fixed because they are the promise. Branching must remain additive and non-destructive. Editing or regenerating a moment must fork rather than overwrite. Ghost paths must remain recoverable. Undo must cover directorial actions. Memory must follow the active path, with explicit global overrides. The three directing modes must remain distinct and available. The cast must be visibly AI, and meta systems must never speak in fiction. Guests must be able to start without an account. The application must remain self-hostable. The interface vocabulary must remain human. Accessibility and performance are acceptance criteria.

Everything else is open. The designer may change the page count, the navigation model, the visual identity, the layout, the component patterns, the density, the typography, the color system, the motion language, the shape of the audition, the location of the map, the form of the composer, the structure of the library, and the names of surfaces. Pages may be merged, split, promoted to full-screen modes, or demoted to contextual overlays. A graph may become a timeline. A grid may become a stage. A settings page may become a playbill. A wizard may become a conversation. The only test is whether the jobs remain well served, the laws remain perceptible, and the experience becomes clearer, more delightful, and more humane.

If a surface is removed, its job must have a new home. If a new surface is added, it must earn its place in the navigation and in the director's attention. If a page becomes a mode, the mode must be discoverable and reversible. If a control becomes a gesture, the gesture must have a visible counterpart. The designer should not preserve a pattern merely because it exists, and should not remove a pattern merely because it is familiar. Best practice is the baseline; taste and invention are the differentiator.

## Questions worth designing around

How might the arrival of the cast feel like a table read rather than a loading state? How might the three directing modes be understood in the first thirty seconds without a tutorial? How might branching feel like possibility rather than complexity, and how might a director see the path not taken without feeling loss? How might memory be felt in the story rather than inspected in a panel? How might the play console give the story more room while keeping every directorial power within reach? How might a phone offer a genuine spatial sense of a branching story rather than a miniature desktop graph? How might the interface teach the difference between extending a path, forking a path, and merely steering the next beat? How might cost, latency, and AI generation feel fair and predictable without turning the experience into a dashboard? How might the product feel literary and theatrical without being precious, and playful without being childish? How might the same system welcome a solo director, a group of co-players, a spectator, and a listener in radio mode without losing coherence? How might the first session become the second session, and the second session become a story the director is proud to share?

## A north-star session

A director opens Fabula on a quiet evening and lands in a personal studio that feels like a shelf of plays. One scene is paused mid-argument, with a last line that makes them smile. Another is a finished story with a cover, a cast, and a small constellation of branches. They start a new scene from a single line, choose a tone with a gesture, and watch a troupe arrive: a name, a face, a voice, a relationship, a secret. They hear one sample line and laugh. They adjust one role's voice, lock it, and let the rest be a surprise. The opening arrives like a curtain rising. They read, choose a path, watch the chosen future become canon, and see the other possibilities remain as quiet ghosts. They steer once, write one line as a character, and then follow a ghost into a new branch just to see what happens. The story map shows two timelines side by side, and switching between them feels like turning a lens, not rewriting history. When the scene resolves, they wrap it, read the archive like a small book, share a link with a friend, and close the laptop feeling that the story was theirs and the cast was real for a while. That is the target.
