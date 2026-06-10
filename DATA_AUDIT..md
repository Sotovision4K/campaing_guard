# `campaing.csv` EDA

## 1. Data integrity check.

- The csv comprise of 2702 rows.
- COLUMNS were the specified at the `ASSIGMENT.md`
- Did a time check integrity. Trying to find if there is any missing gap on dates. Table below suggest there my be two duplicates rows.

---

| campaign_id | min                 | max                 | count |
| ----------- | ------------------- | ------------------- | ----- |
| CMP-0001    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 91    |
| CMP-0003    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 91    |
| CMP-0008    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0009    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0010    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0018    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0021    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0022    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0026    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0028    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| CMP-0029    | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0000     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0004     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0005     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0006     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0007     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0011     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0012     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0013     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0014     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SB-0025     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0002     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0015     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0016     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0017     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0019     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0020     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0023     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0024     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |
| SP-0027     | 2025-02-26 00:00:00 | 2025-05-26 00:00:00 | 90    |

---

- duplicates values found, these may be taken for an anomaly.

---

| index | campaign_id | date                | count |
| ----- | ----------- | ------------------- | ----- |
| 48    | CMP-0001    | 2025-04-15 00:00:00 | 2     |
| 138   | CMP-0003    | 2025-04-15 00:00:00 | 2     |

---

- No missing dates found.
- Data is complete, no NULL nor NaN values
- After `df.describe()` found max value of aCoS was 73. Which is misleading and can be a false positive since acos should be either a percentage or a decimal, not both. So standarization of this metric is require. Decided to use decimal instead of percentage for future calculations. THIS IS CRITICAL to either train a model or perform calculations.
- spend spikes after 04-26-25. This can trigger false positive. We need to split the data set in two and make a BREAK_LIMIT_DATE variable.
- CPC appers to have rounding issues. When re calculate its results is e.g 220 but store is 2.21. Taking the store cpc as a source of truth

## 2. Metric Logic

- Metric logic validation. This is where we explore the data and inspect the data if it actually make sense.

### 2.1 clicks higher than impressions

-This is IMPOSSIBLE. An ad only had the chance to be clicked if the ad was displayed.

### 2.2 order higher than clicks

- order higher than clicks. This is partialy impossible. If a shopper clicks on the ad, based on amazon Ads documentation, the order can be made later (7 days for a seller, 14 days for authors and vendors) and it can buy more than one unit, then the attribute order is assigned to the last click.
- did a quick check finding the rows where this is true and the total amount of rows and found this happen 0.44% of the time. events_where_order_higher_click = total_amount_of_the_event / total_rows
- by creating a ratio of order and clicks, we could found that the ratio is not an anomaly, but this force us to make a business check, since that being on amazon ecosystem this is highly possible.

### 2.3 spend > 0 and clicks = 0

- This is a potential issue, althought not impossible. Maybe the ETL process failed while parsing the numbers. This could be a stopper for our current flow, so that an LLM can reason on this.

## 3. Performance Logic

- This will show if your advertising campaing is making progress or you are losing money.
- To detect anomalies, we must make sure we trust our data, based on our EDA we confirmed that we are better off making some recalculations and check if the result actually match the listed metric.

### 3.1 ACOS check

- Acos is the ratio between the investment and the sales acos = investment_made / sales_achieved. Meaning that if the investment exceeds more than your sales, you are losing money. We are going to validate this calculation by re calculating this ratio using the mentioned formula. We want to know if this is valid or not.
- Also a change in the acos, meaning that a sudden increase in this metric is considere an anomaly

### 3.2 sales go down and spend go up

- Money leakage. This is a performance metric and it's determine as an anomaly.

### 3.3 ROAS drps

- This is the ratio of your TOTAL income by ads and your TOTAL spends by ads. So basically if this drops, then you are not making that much money, so it's considered a mild anomally, but if it drops below one then you are spending more in campaings than what you are making. For this metric we must considered customer's equilibrium point.

### 3.4 CVR (Conversion Rate):

- This metric will tell if the clicks and being converted into sales. It's an important metric because it measures how effective it's the campaing. So it's going to be considere an anomaly if it's suddenly drops or spikes.

### 3.5 CTR drops

- This is going to be considered an anomaly, it basically measure how clicks are we getting for each impressions. a drop may indicate ad fatigue or quality issues.
- EDA showed this is possible based on our campaing.csv file

### Zero values campaing.

- These are the campaing with 0 on their metrics for a long period of time. This will be flag.

see `https://colab.research.google.com/drive/1njKMe9YzynjVI3xGX-DYTOwWYKpRj6Hn?usp=sharing` to check EDA
