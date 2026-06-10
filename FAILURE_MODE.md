

# Failure cases

- This is a heavy calculation script, and since being in typescript only enviroment restrict us to use pandas/numpy. Heavy calculations script are known for using lots of CPU power to perform its calculation, so on a busy day, the API may response slowly. For this i'd make sure that the pipeline is optimize enough and, monitor the system for specifics time of the day when the feature is used the most, so we can either scale vertically or horizontally. Audit everyquery and stage of the pipeline to ensure its performance.

- LLM ROUTER. Since we are not building a router, we can be sure that this is a point of failure if the LLM fail to answer or its api goes down. We could build an LLM router to redirect the request to another provider. Test the
 results to to fine tune the prompts.

- Statistical model requires enrichment and data that we can trust and i recognize my statistics kwnolegde limitations. I can only go so far as the LLM suggested to. I'm able to push back at some points but I need to brush up my statistics skills. Saying that, data flaggin will fall short on differents dataset with different distributions.

- Insights needs to be audit before providing the info to the user. We could set another agent that review the response, this is actually expensier than only one LLM providing insights but it's a trade off for better response. Also it needs consistency, all insights needs to be the same with the same datasets.

- For larger user based this is going to fail. We need to add queues to decouple the calculation and detection logic. That way we could deload the endpoint. 

- There no rate limiting, any malicious attacket can ddos this endpoint

- After testing features, a major red flag would be effort of the model. I set the effort model to low, so in production we would want to use a more powerfull model with a moderate effort. It make take a little longer, but if we include a queue, we can decouple the heeavy pipeline.

- response takes around 20 seconds. Depending on customer SLA, this can affect UX.

- After consideration, I'm not pre saving or caching the user response or anomaly detection, if db is down or fail. There's no retry mechanism for that.

- another major red flag could be i'm not checking if the types are the correct one on the repositories endpoint. We can use zod for this.

