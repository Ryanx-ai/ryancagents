# Everyday work in Ryan HQ

**Direction:** make useful work feel like progress in a shared 2D office. The priority is a dependable workflow product that can eventually serve other people. Game mechanics should make that work easier to understand and enjoyable to return to.

## Foundation in this repository

- A two-level, side-scrolling office with six existing Ryans, shared animation states, short public-progress captions, attention markers and brief completion celebrations.
- An authenticated Mac-to-Codex prompt bridge with separate queue, delivery and reply receipts; a review list with persisted **Mark done** acknowledgements.
- Documented workflow maps and local editing experiments. Agent drafts, sandbox graphs and wardrobe preferences are browser-local configuration, not a production multiuser system. Saving a draft does not activate an agent or grant connector access.

There is no XP ledger, reward balance, public-office service, visitor permission system or funded credit programme. Agent activity and final replies are reported observations, not independent proof of every business outcome. See [workflow capabilities](workflow-capabilities.md) and [agent creation](agent-creation-contract.md).

## 1. Make the work loop dependable

Keep the everyday loop short: **give a task → see meaningful progress → review the result → finish or refine**. Prioritize clear errors, safe recovery, readable outputs, useful links and reliable review state. Workflow editing must remain distinct from execution until a real runner and permission model exist.

Before a public launch, establish individual accounts, isolated workspaces, scoped connector grants, durable storage, account recovery and an explicit agent-activation process. Test reconnects, ambiguous dispatch, mobile access and failure recovery. A shared office key and this Mac's chat mappings are not a multiuser foundation.

Judge this phase by successful task handoffs, time to a reviewable result and recovery without duplicated actions—not time spent watching the office.

## 2. Add an optional experience meter

Prototype XP for **useful outcomes the user has reviewed**, with a small explanation of what earned each award. Do not award XP for prompts, tokens, tool calls, emails sent, polling, repeated heartbeats or leaving the app open.

The current completion key and review acknowledgement are useful starting points, but **Mark done currently means acknowledged**, not independently verified. Define an eligible task outcome before attaching rewards. Group related agent turns under one task so splitting work into more messages cannot increase XP.

A production award needs a server-owned ledger and an atomic unique key such as `(workspace, task-completion, reward-rule-version)`. Repeated clicks, retries, reconnects and re-imported local data must yield one award. Reopening a task must not mint another award for the same outcome. Demo and sandbox activity earn no production XP. Keep corrections auditable; never trust a browser-supplied balance.

Start with modest, capped, non-monetary awards. Make meters optional; avoid streak penalties, productivity rankings and incentives to create unnecessary work.

## 3. Let the office become personal

Use progression for optional jackets, shirts, trousers, desk details, plants, rooms and small celebrations. Preserve each Ryan's identity and complete animation set. Keep readable progress, reduced motion and a calm office available.

Cosmetics never unlock essential tools, connector permissions, faster task handling or review controls. Every core work action remains available without grinding or buying items.

## 4. Explore visiting other offices

Treat a public office as a separate, **opt-in view**. Default to private. Let owners preview exactly what a visitor will see and revoke sharing. Start with chosen cosmetics and generic office ambience; exclude prompts, results, email/contact details, client names, private links and task history.

Visitors must not inherit the owner's agent access or be able to issue work. Shared-office identity, access controls, reporting and abuse handling need their own implementation before visits launch. Local browser preferences are not public profiles.

## 5. Research credit rewards later

Credit rewards or “rolls” are **unfunded future research**, not a promised feature, redeemable balance or current entitlement. Explore funding, operating cost, eligibility, fraud resistance, transparent reward terms and any required review before designing an economy. Keep this separate from connector/API credentials and existing service credits. Manager Ryan cannot promise or issue money, credits or purchases through a cosmetic interaction.

Ship sequence: reliable private workflow core → public-ready account foundations → optional XP experiment → cosmetics → opt-in visits → only then evaluate funded rewards. This document authorizes no economy, social backend or live feature by itself.
