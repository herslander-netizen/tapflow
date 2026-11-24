-- TapFlow — 0700 Storage (mídia por tenant) e Realtime (fila de pedidos).
-- As duas partes só rodam se os esquemas do Supabase existirem, para a migração poder ser
-- ensaiada num Postgres comum.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage não encontrado: políticas de mídia não criadas';
    return;
  end if;

  -- Bucket privado: o app entrega pôster/vídeo por URL assinada gerada na API.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tenant-media', 'tenant-media', false, 52428800,
          array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
  on conflict (id) do nothing;

  -- Caminho obrigatório: "<tenant_id>/<arquivo>". Leitura pela equipe; escrita por proprietário/gerente.
  execute $p$create policy tenant_media_select on storage.objects for select to authenticated
    using (bucket_id = 'tenant-media'
           and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           and private.is_member(((storage.foldername(name))[1])::uuid))$p$;
  execute $p$create policy tenant_media_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'tenant-media'
                and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                and private.has_role(((storage.foldername(name))[1])::uuid, null, array['owner', 'manager']))$p$;
  execute $p$create policy tenant_media_update on storage.objects for update to authenticated
    using (bucket_id = 'tenant-media'
           and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           and private.has_role(((storage.foldername(name))[1])::uuid, null, array['owner', 'manager']))$p$;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publicação supabase_realtime não encontrada: realtime não configurado';
    return;
  end if;
  -- postgres_changes respeita a RLS de cada assinante. O cliente anônimo não assina tabelas:
  -- acompanha o pedido por public.track_order (com consulta periódica de reserva, F1-09).
  alter publication supabase_realtime add table public.orders, public.kitchen_tickets, public.service_requests;
end $$;
