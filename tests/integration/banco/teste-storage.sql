-- F1-03: mídia por tenant no Storage (bucket privado "tenant-media", caminho "<tenant_id>/...").

select teste.ok((select not public from storage.buckets where id = 'tenant-media'), 'bucket de mídia é privado');

set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000002');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('tenant-media', 'a0000000-0000-4000-8000-000000000000/pratos/a1.webp') returning 1$$) = 1, 'gerente de A envia mídia na pasta de A');
select teste.erro($$insert into storage.objects (bucket_id, name) values ('tenant-media', 'b0000000-0000-4000-8000-000000000000/invasao.webp')$$, 'row-level security', 'gerente de A não envia na pasta de B');
select teste.erro($$insert into storage.objects (bucket_id, name) values ('tenant-media', 'solto.webp')$$, 'row-level security', 'arquivo fora de pasta de tenant é recusado');
select teste.ok(teste.linhas($$insert into public.item_media (tenant_id, item_id, kind, storage_path, mime_type) values ('a0000000-0000-4000-8000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'poster', 'a0000000-0000-4000-8000-000000000000/pratos/a1.webp', 'image/webp') returning 1$$) = 1, 'gerente registra a mídia como em processamento');
select teste.erro($$insert into public.item_media (tenant_id, item_id, kind, storage_path, mime_type) values ('a0000000-0000-4000-8000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'poster', 'b0000000-0000-4000-8000-000000000000/x.webp', 'image/webp')$$, '23514', 'mídia de A não aponta para a pasta de B');
select teste.erro($$insert into public.item_media (tenant_id, item_id, kind, storage_path, mime_type, status) values ('a0000000-0000-4000-8000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'video', 'a0000000-0000-4000-8000-000000000000/v.mp4', 'video/mp4', 'ready')$$, '42501', 'equipe não marca mídia como pronta sem validação da API');
select teste.erro($$update public.item_media set status = 'ready'$$, 'row-level security', 'equipe não promove mídia para pronta');
select teste.como('10000000-0000-4000-8000-000000000004');
select teste.ok(teste.linhas('select 1 from storage.objects') = 1, 'cozinha de A lê a mídia de A');
select teste.erro($$insert into storage.objects (bucket_id, name) values ('tenant-media', 'a0000000-0000-4000-8000-000000000000/cozinha.webp')$$, 'row-level security', 'cozinha não envia mídia');
select teste.como('10000000-0000-4000-8000-000000000006');
select teste.ok(teste.linhas('select 1 from storage.objects') = 0, 'dono de B não lê a mídia de A');
reset role;

-- Mídia só entra no cardápio público depois de pronta.
set role anon;
select teste.ok(not (public.public_menu('tenant-a', 'a1')::text like '%pratos/a1.webp%'), 'mídia em processamento não aparece no cardápio');
reset role;
update public.item_media set status = 'ready' where storage_path = 'a0000000-0000-4000-8000-000000000000/pratos/a1.webp';
set role anon;
select teste.ok(public.public_menu('tenant-a', 'a1')::text like '%pratos/a1.webp%', 'mídia pronta aparece no cardápio');
reset role;

rollback;
