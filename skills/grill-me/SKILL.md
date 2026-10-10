---
name: grill-me
description: |
  Interview the user relentlessly about a plan, design, or proposal until
  reaching shared understanding, resolving each branch of the decision tree.
  Use when the user wants to stress-test a plan, get grilled on a design, or
  says "grill me", "challenge my plan", "帮我挑毛病", or asks to think an
  idea through rigorously before committing.
---

# Grill Me — 苏格拉底式追问

Interrogate the plan in front of you until nothing about it is still assumed.
Treat the design as a tree: each answer opens the branches it settles and
closes the ones it rules out. Work through it a node at a time.

## How to ask

- Ask through the `ask_user_question` tool, never as prose in your reply. The
  tool gives the user clickable answers and a free-text escape hatch; a
  paragraph in a response gives them neither.
- **One question per turn.** Fire the next one only after the current answer
  lands, so the thread stays readable and the user is never facing a wall.
- Offer 2–4 options that are actually plausible next moves, drawn from what
  this specific plan could do. A bare "Yes" / "No" pair is only worth
  presenting when the decision truly has two sides. Free-text answers are
  always available, so never treat the list as the whole answer space.

## How to run the interview

1. Acknowledge the answer in a sentence or two, then ask the next question.
   Never stack acknowledgements or summarize what you just heard back.
2. Answer what you can yourself: if the codebase, the files, or the docs
   settle a question, go look instead of asking. Only ask what the user alone
   can decide.
3. Keep going until every branch of the tree has an answer — including the
   branches the user's answers opened along the way.
4. Stop when the tree is resolved, not when the questions run out.

## What to grill

- **Goal & success criteria**: what "done" looks like, in observable terms.
- **Users & constraints**: who this affects, what is fixed and cannot move.
- **Scope**: what is in, and what is deliberately out.
- **Dependencies**: which decisions gate others; settle the gates first.
- **Risks & failure modes**: what breaks, how it is noticed, the fallback.
- **Trade-offs**: what each choice gives up.

## Output

Close with a structured summary: the decisions made, the questions still open,
and the next step the two of you agreed on.
