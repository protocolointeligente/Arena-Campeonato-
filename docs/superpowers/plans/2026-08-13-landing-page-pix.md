# Landing Page ARENA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public ARENA landing page that routes visitors to authentication, demo, and Pix-backed plans.

**Architecture:** Add a landing renderer to the existing single-file app and make it the initial unauthenticated route. Reuse `renderAuth`, `renderPlans`, and `enterDemoMode`; authenticated users and public championship query routes retain their existing behavior.

**Tech Stack:** HTML, inline CSS, JavaScript, Firebase client SDK.

## Global Constraints

- Do not alter the existing Pix key or plan prices.
- Do not expose technical/admin tools on the landing page.
- Preserve the current Demo, authentication, plan, and public championship flows.

### Task 1: Landing renderer and initial routing

**Files:**
- Modify: `arena-campeonatos-v2-intervencao-19.html`

- [ ] Add `renderLandingPage()` with hero, benefits, demo CTA, plan cards, final CTA, and footer.
- [ ] Add a public header action for “Entrar”.
- [ ] Route unauthenticated root visits to `renderLandingPage()`.
- [ ] Keep `?ver=` and `?inscrever=` routes unchanged.

### Task 2: Validate and publish

**Files:**
- Modify: `vercel.json` only if needed.

- [ ] Validate embedded JavaScript syntax.
- [ ] Check landing copy and existing function references.
- [ ] Commit the implementation.
- [ ] Push `main` to trigger the production deployment.
