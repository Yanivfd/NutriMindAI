-- Cooking style had no rule for what counts as a richer dish, so the planner no longer uses it.
-- Diet stays. The longer recipes stay in the catalog as normal dishes.
alter table public.profiles drop column if exists cooking_style;
alter table public.recipes drop column if exists effort;
