-- ============================================================================
-- 13_useful_queries.sql — read-only queries for the demo, analysis and judges
-- Run any block on its own in the Supabase SQL editor. Nothing here writes.
-- ============================================================================

-- 1. Price board: current market price per category (last 14 days of market
--    observations, recycler quotes excluded) with the 60-day change.
with market as (
  select category, observed_at, buying_price, market_range_low, market_range_high
  from kc_prices
  where recycler_id is null
),
latest as (
  select category, max(observed_at) as last_at from market group by category
)
select m.category,
       round(avg(m.buying_price) filter (where m.observed_at >= l.last_at - interval '14 days'), 2) as price_per_kg,
       max(m.market_range_low)  as market_low,
       max(m.market_range_high) as market_high,
       round(100 * ((array_agg(m.buying_price order by m.observed_at desc))[1]
                  / nullif((array_agg(m.buying_price order by m.observed_at))[1], 0) - 1), 1) as change_pct
from market m join latest l using (category)
group by m.category
order by m.category;

-- 2. Weekly price trend per category (feeds charts / price prediction).
select category, date_trunc('week', observed_at) as week, round(avg(buying_price), 2) as avg_price_per_kg
from kc_prices
where recycler_id is null
group by 1, 2
order by 1, 2;

-- 3. What each recycler actually paid vs the market (completed sales + quotes).
select r.name, p.category, count(*) as observations,
       round(avg(p.buying_price), 2) as avg_paid_per_kg,
       max(p.market_range_low) as market_low, max(p.market_range_high) as market_high
from kc_prices p
join kc_recyclers r using (recycler_id)
group by r.name, p.category
order by r.name, p.category;

-- 4. Recycler directory: authorized facilities and what they accept.
select name, authorization_status, authorization_id, address, pickup_available, service_area,
       data->'materialsAccepted' as materials_accepted,
       data->'offeredRates'      as offered_rates_per_kg
from kc_recyclers
order by authorization_status, name;

-- 5. Full traceability chain: collection -> handover -> recycler confirmation.
select tr.handover_reference, l.category, l.weight_kg, l.condition, l.source_type,
       l.created_at   as collected_at,
       tr.recorded_at as handed_over_at, tr.lat, tr.lng, tr.location_approximate,
       r.name         as recycler, r.authorization_id,
       tr.status      as record_status, tr.confirmed_by, tr.confirmed_at,
       t.quoted_price, t.final_price, t.payment_status, t.transaction_status,
       tr.handover_hash
from kc_traceability tr
left join kc_lots l          on l.lot_id = tr.lot_id
left join kc_transactions t  on t.transaction_id = tr.transaction_id
left join kc_recyclers r     on r.recycler_id = tr.recycler_id
order by tr.recorded_at desc;

-- 6. Look up one handover code (replace the code).
select * from kc_traceability where handover_reference = 'KC-000000';

-- 7. Abnormal transactions flagged by the anomaly check.
select f.flagged_at, f.reason, f.deviation_pct, t.transaction_id, l.category, l.weight_kg,
       t.quoted_price, t.final_price, r.name as recycler
from kc_flags f
join kc_transactions t using (transaction_id)
left join kc_lots l      on l.lot_id = t.lot_id
left join kc_recyclers r on r.recycler_id = t.recycler_id
order by f.flagged_at desc;

-- 8. Collector dataset: lots, sales, earnings and dues per (pseudonymous) collector.
select * from kc_collectors order by earnings_settled desc;

-- 9. Funnel: how far lots get (valued -> matched -> handed over -> confirmed -> paid).
select status, count(*) as lots, round(sum(weight_kg), 1) as kg, round(sum(estimated_value)) as est_value
from kc_lots
group by status
order by array_position(array['draft','valued','matched','handed_over','confirmed','paid'], status);

-- 10. Material volume diverted to authorized recyclers, by category.
select l.category, count(*) as confirmed_lots, round(sum(l.weight_kg), 1) as kg,
       round(sum(coalesce(t.final_price, t.quoted_price))) as paid_to_collectors
from kc_transactions t
join kc_lots l on l.lot_id = t.lot_id
where t.transaction_status = 'confirmed'
group by l.category
order by kg desc;

-- 11. Unit economics scaffold: platform price vs an informal-buyer price.
--     Replace the informal_rate values with numbers from your field research
--     (the two collector interviews) — these placeholders are NOT data.
with informal(category, informal_rate) as (
  values ('CRT', 0), ('LCD_PANEL', 0), ('PCB', 0), ('CABLE', 0),
         ('BATTERY', 0), ('MOTOR_MAGNET', 0), ('MIXED_PLASTIC', 0)
),
platform as (
  select l.category,
         sum(l.weight_kg) as kg,
         sum(coalesce(t.final_price, t.quoted_price)) as earned
  from kc_transactions t join kc_lots l on l.lot_id = t.lot_id
  where t.transaction_status = 'confirmed'
  group by l.category
)
select p.category, round(p.kg, 1) as kg,
       round(p.earned / nullif(p.kg, 0), 2) as platform_rate_per_kg,
       i.informal_rate,
       round(p.earned - p.kg * i.informal_rate) as extra_earned_via_platform
from platform p join informal i using (category)
order by p.category;

-- 11b. Pickup requests: open ones per recycler, and how fast recyclers respond.
select r.name as recycler, t.pickup_status, count(*) as requests,
       round(avg(extract(epoch from (t.pickup_updated_at - t.pickup_requested_at)) / 60)::numeric, 1) as avg_minutes_to_latest_step
from kc_transactions t
join kc_recyclers r using (recycler_id)
where t.pickup_status is not null
group by r.name, t.pickup_status
order by r.name, t.pickup_status;

-- 12. Audit trail: every accepted write, newest first.
select at, kind, ref from kc_audit order by seq desc limit 100;

-- 13. Signed-in users by role (needs 01_users.sql).
select role, recycler_verified, count(*) from kc_profiles group by 1, 2 order by 1, 2;
