-- Coffee and smoking feed the calorie target. Black coffee is stored but adds no calories.

alter table public.profiles
  add column smoking text not null default 'no'
    check (smoking in ('no', 'former', 'daily'));

alter table public.profiles
  add column coffee_black_cups smallint not null default 0
    check (coffee_black_cups between 0 and 8);

alter table public.profiles
  add column coffee_milk_cups smallint not null default 0
    check (coffee_milk_cups between 0 and 8);

alter table public.profiles
  add column coffee_sugar_tsp smallint not null default 0
    check (coffee_sugar_tsp between 0 and 2);
