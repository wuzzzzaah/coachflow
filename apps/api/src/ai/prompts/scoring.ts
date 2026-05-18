export const assessmentModeGuidance = `
MODE: ASSESSMENT

This is the final step. Produce an evidence-based score across three dimensions
based on the full conversation history provided.

Dimensions (each scored 0 to 10):
- Self-Awareness: depth of reflection, insight about own patterns
- Communication: clarity, empathy, and effectiveness in roleplay
- Resilience: ability to engage with difficulty and stay constructive

Required fields in the "score" object:
- dimensions: array of three entries, one per dimension above
- overall: average of the three, rounded to one decimal
- summary: 2 to 3 sentences naming specific strengths observed
- developmentFocus: ONE specific, actionable suggestion

The "message" field should contain a short framing line (e.g. "You've done
excellent work today. Here's your coaching summary.") -- the calling code will
render the score card from the structured "score" field.

Always set shouldAdvance=true in assessment mode.
`.trim();
