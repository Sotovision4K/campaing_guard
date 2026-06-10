

## Pricing Calculations
assuming 1000 thousand campaing (double the amount stated in readme)
1,000 tasks × 4 vCPUs × 2 hours × $0.04048 per hour = $323.84
1,000 tasks × 8.00 GB × 2 hours × $0.004445 per GB per hour = $71.12
20 GB – 20 GB (no additional charge) = $0.00 billable per task  


Fargate cost (monthly) for 1,000 tasks: $394.96


## postgres 

Assuming multi region

Assuming on peak Hours the 1000 users perform at least 20% of the operations on our db, so that would be 200 operations  


let's say for each campaing we find at least 30 anomalies, my build perform write operations for each anomalies, on the worst case we can assume there is a factor multiplicator of 5, so 150 anomalies per campaing

if there are 200 campaings upload at one go:

- best scenario is :

30 anomalies * 200 campaings = 600 anomalies writes on the db. 

they sit reading the LLM insights on one go, but that would be around 1 write operations per user because they need to take time to read the anomalies so another 200 writes operation on audit_table

- worst case would be :

(600 writes + 200 writes) * 5 = 4000 writes operation 

Assuming they will perform 30 % of the writes operations 

best case : 90 reads operations

worst case : 450 reads operations

those calculations are per day. 

Assuming this db is going to be use mostly on office hours

12 h/ day * 5days /week * 4 weeks/month = 240 h a day

price of our architecture on aws rds postgres db.t4g.large	0,129 USD

total = 240 H * 0,129 USD = 30,96 USD /monthly

for storage

- Fixed columns only: ~120 B
- With typical feature_snapshot (200–500 B JSONB): ~400–700 B per anomaly
- With large snapshot (>2 KB): TOAST kicks in → ~2.2 KB+ per row

assuming values above :

worst case writes operations are 4000

if each operations consumes 0.7 KB * 4000 = 2.8 MB / day * 30 days = 84 MB this is too low. There's no rds instance that cover this low amount. So for the assummed scenario we can go for a t3 medium instances instance


## LLM

My build limit 5 anomalies per anhtropic call

. profasee-api | [LLMValidationStage] Anthropic response received. Usage: inputTokens=3842, outPutTokens = 1034

Assuming there is 600 anomalies. they are batch in 5 anomalies per call. Each call is around 3900 tokens

so 600/ 5 * 3900 =  0.468M tokens / day * 30 days = 14 USD per month for haiku inputs tokens (haiku rate is 1 dollar per million token)

for output 600 / 5 * 1200 tokens = 0.144 M/ day * 30 days * 5 USD / Mtokens = 21 USD montlhy

for sonnet we can do like this :

input 600/ 5 * 3900 =  0.468M tokens / day * 30 days * 3 USD / Mtokens = 42 USD monthly
output 600 / 5 * 1200 tokens = 0.144 M/ day * 30 days * 15 USD / Mtokens = 64 USD montlhy


- building

see `cost.png` for confirmation

around 20 USD worth of tokens or a little more. Today's generation was for different purposes. So i'm not counting today's tokens