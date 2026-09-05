# Demo squad — 20 athletes (2026-09)

Seeded so the leaderboards have a field to rank. Applied as migration
`seed_demo_squad_2026_09`.

## Removing it — one statement

```sql
delete from auth.users where email like '%@bnchmrkd.invalid';
```

Every seeded table cascades from `auth.users`, so that one delete takes the
profiles, sharing rows, squad memberships, performances and metrics with it.
Nothing existing was modified, so there is nothing to restore.

## How it is tagged

Twice, deliberately:

- email domain `@bnchmrkd.invalid` — `.invalid` is reserved by RFC 2606 and can
  never resolve, so none of these can receive mail or collide with a real signup
- `raw_user_meta_data->>'seed' = 'demo-2026-09'`

`encrypted_password` is an empty string, so none of them can be signed into.

## What it contains

| | |
|---|---|
| auth users / profiles | 20 |
| 100m performances | 60 (three each, converging on a PB) |
| 60m performances | 9 |
| CMJ tests | 40 (two each, eight weeks apart) |
| squad memberships | 14, all in **Sprints** |

12 senior men, 6 senior women, 2 U20 men. All Dubai / United Arab Emirates,
club "Dubai Track Club". Every performance and metric carries
`approval = 'accepted'`, which is what `board_position` requires.

Marks are club-to-national and deliberately spread around the real athlete
account's 10.33 so it lands **mid-table rather than first** — that is the case
that exercises the ladder's collapse (podium, you and your neighbours, last
place) instead of the trivial top-of-board rendering.

## Verified

Called as the real athlete account, Senior + Men:

| board | position |
|---|---|
| Squad 100m | 6th of 12 · upper half |
| City 100m | 6th of 15 · upper half |
| World 100m | 6th of 15 · upper half |
| Squad CMJ height | 7th of 12 · lower half |

## Known gap: Region shows 0

Not a seed problem. `bm_population` requires `u.region is not null` AND a match
against your own, and the real athlete profile has `region = null` — so the
Region board can never populate for that account. Setting it fixes the board:

```sql
update public.user_profiles set region = 'Dubai'
where id = 'b5cf911f-f5b0-41e9-9b01-0a8a344759cc';
```

Left undone on purpose: that is a real account's data, not seed data.
