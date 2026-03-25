-- OPTIONAL IMPROVEMENTS FOR LATER
-- Run these only if you want role + block support stored in the database.

alter table public.photographers
add column if not exists role text not null default 'photographer';

alter table public.photographers
add column if not exists is_blocked boolean not null default false;

-- Example internal accounts:
-- update public.photographers set role = 'admin' where email = 'admin@alvezandmango.com';
-- update public.photographers set role = 'staff' where email = 'someone@yourcompany.com';
