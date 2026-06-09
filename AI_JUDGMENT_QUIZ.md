# AI Judgment Quiz

Required deliverable. Answer all six questions in plain English in a file called `AI_JUDGMENT_QUIZ.md` in your repo root. We expect roughly 100-300 words per answer — long enough to show reasoning, short enough that you can't hide behind volume.

These questions are about *your specific build*. The candidates who try to AI-generate these answers produce hollow, generic responses that don't match their own code. We can tell.




---

## Question 1 — The data audit

When you first opened `data/campaigns.csv`, what did you do before writing any code that touched it? What did you find? What did you decide to handle versus punt on, and why?

I use google colab to perform an EDA on the dataset. But first i took a de tour and try to understand what PPC was, because i didn't know anything about it. I found several campaings with zero activity, also found that some acos values were like altered and they meant like 73% but other were represented by decimals, I found that there were two spends regime. Like suggesting these were two differents datasets.


## Question 2 — The AI mistakes

Describe three specific moments during this build where the AI gave you output that was wrong, misleading, or would have caused problems. For each:
I wouldn't say it's misleading I would say confusing
- What did you ask? . I ask for help during the EDA. It provide some insights but with zero explanation
- What did the AI produce? It produces guidance but it was weell oriented to my needs
- How did you catch the problem? When trying to see the same pattern on my EDA
- What did you do next? I ask for clarification, then at some points i wasn't giving enough context so i tried to be as specific as possible

"The AI got it right the whole time" is not a valid answer. If you believe that's true, you weren't paying attention. We'd rather hear about three small catches than read a defense of why there were none.

## Question 3 — The architectural fork

There was at least one moment in this build where you faced a real architectural decision — a place where the AI's first suggestion would have worked, but you chose differently. Describe one.

What was the fork? What did the AI suggest? What did you do instead? Why? When calling the antropic api for gen insight, I decided to set small batches rather that big ones. The AI suggest to lower the max tokens, which was usefull but also I suggest to detect anomalies and group them by level. There were time that i took the ai suggestion for granted but after testing was not really solving my problem, So i just iterate over solutions. 

If you took every first suggestion the AI gave, that's also a valid answer — but tell us honestly and tell us why.

## Question 4 — The production gap

What are the top three reasons this prototype would fail or cause real damage if we deployed it to a Profasee customer tomorrow with 500+ campaigns?
- I does not have any queues.
- Anomaly detection is not as refined as it could be. 
- I didn't take the time to refine the prompt_system, improving the context can led to better recomendaton from the AI.
- We should put the audits from LLM response to a nosql db. We can use both approach since audits can be used for analitycs and nosql db are exceptionally good for that

We're not looking for "it doesn't have auth." We're looking for AI-system-specific failure modes — the kind that don't show up in unit tests and don't crash the server but quietly produce bad recommendations.

## Question 5 — The teammate question

If you had a senior Profasee engineer available for 15 minutes during this build, what's the one question you would have asked them? 

- How often a user use this? Is this something that can he program to do? 

If you say "nothing, I had it covered" — be careful. The strongest candidates always have something they would have asked.

## Question 6 — The data contract

I'm assuming an autonomous bidding agent can act at my db. I decided to remove the MCP, i thougt it wasn't adding any value because it was a detection machine. In any case, my LLM insight return metadata on each response. I'm assuming this would not fail unless the agent ask for different data outside my metadata. 

---

## Submission notes

- Write these answers yourself. Don't paste them into Claude and ask it to "make them sound better." We can detect generated prose, and we'd rather read your real voice with grammar errors than polished output that doesn't match your code.
- The answers must be consistent with your `LIMITATIONS.md` and your raw prompt exports. If your quiz says "I caught a data-quality issue" but your code doesn't show that and your exports don't show that, that contradiction counts against you — and it's exactly the kind of gap we probe in your recording.
- Honesty is a green flag. "I missed this until hour 3" is a stronger answer than "I caught everything immediately."
