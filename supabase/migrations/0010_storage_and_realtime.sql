-- =====================================================================
-- 0010: storage buckets + policies, realtime publication
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payment-proofs',     'payment-proofs',     false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('ticket-attachments', 'ticket-attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('method-qr',          'method-qr',          false, 1048576, array['image/png', 'image/jpeg', 'image/webp']),
  ('site-assets',        'site-assets',        true,  2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- payment proofs: path = {user_id}/{order_id}/{file}; immutable evidence
create policy "proofs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "proofs: owner or staff read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));
-- (deliberately no update / delete policy for customers)

-- ---- ticket attachments: path = {ticket_id}/{file}; visibility follows ticket RLS
create policy "ticket files: participant upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-attachments'
              and exists (select 1 from public.tickets t where t.id::text = (storage.foldername(name))[1]));
create policy "ticket files: participant read" on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments'
         and exists (select 1 from public.tickets t where t.id::text = (storage.foldername(name))[1]));

-- ---- payment-method QR codes: readable by signed-in users, written by admins
create policy "method qr: read" on storage.objects for select to authenticated
  using (bucket_id = 'method-qr');
create policy "method qr: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'method-qr' and (select private.is_admin()))
  with check (bucket_id = 'method-qr' and (select private.is_admin()));

-- ---- public site assets: admin write (public read comes from the bucket flag)
create policy "site assets: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and (select private.is_admin()))
  with check (bucket_id = 'site-assets' and (select private.is_admin()));

-- ---- realtime: RLS still decides what each subscriber receives ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders', 'payments', 'services', 'notifications', 'tickets', 'ticket_messages', 'contact_messages']
    loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then
        null;  -- already published
      end;
    end loop;
  end if;
end;
$$;
