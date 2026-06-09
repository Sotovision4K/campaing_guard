

# Failure cases

- This is a heavy calculation script, and since being in typescript only enviroment restrict us to use pandas/numpy. Heavy calculations script are known for using lots of CPU power to perform its calculation, so on a busy day, the API may response slowly. For this i'd make sure that the pipeline is optimize enough and, monitor the system for specifics time of the day when the feature is used the most, so we can either scale vertically or horizontally. Audit everyquery and stage of the pipeline to ensure its performance.

- LLM ROUTER. Since we are not building a router, we can be sure that this is a point of failure if the LLM fail to answer or its api goes down. We could build an LLM router to redirect the request to another provider. Test the
 results to to fine tune the prompts.

- Statistical model requires enrichment and data that we can trust and i recognize my statistics kwnolegde limitations. I can only go so far as the LLM suggested to. I'm able to push back at some points but I need to brush up my statistics skills. Saying that, data flaggin will fall short on differents dataset with different distributions.

- Insights needs to be audit before providing the info to the user. We could set another agent that review the response, this is actually expensier than only one LLM providing insights but it's a trade off for better response. Also it needs consistency, all insights needs to be the same with the same datasets.

- For larger user based this is going to fail. We need to add queues to decouple the calculation and detection logic. That way we could deload the endpoint. 

- There no rate limiting, any malicious attacket can ddos this endpoint