# Vivos com Cristo — Louvor Tons

Sistema web (sem login) para cadastrar músicas e registrar tons por membro da equipe de louvor.

## Estrutura

```txt
louvor-tons/
  index.html
  styles.css
  app.js
  script.js
  supabaseClient.js
  assets/
    logo.png
  README.md
  .env.example
```

## Observação de segurança

Este projeto **não possui autenticação**. Qualquer pessoa com o link poderá visualizar e editar músicas/tons.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Execute o SQL abaixo no SQL Editor.
3. Pegue `Project URL` e `anon public key`.
4. Configure na Vercel como variáveis de ambiente e exponha no HTML, por exemplo:

```html
<script>
  window.SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
  window.SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA";
</script>
```

> Em ambiente local simples (Live Server / `npx serve .`), adicione esse bloco no `index.html` antes de `supabaseClient.js`.

### SQL (tabelas + índices + trigger)

```sql
-- Extensão para UUID (se necessário)
create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_norm text not null,
  created_at timestamptz default now(),
  constraint songs_title_norm_unique unique (title_norm)
);

create index if not exists idx_songs_title_norm on public.songs (title_norm);

create table if not exists public.song_keys (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  member_name text not null,
  key text null,
  updated_at timestamptz default now(),
  constraint song_keys_song_member_unique unique (song_id, member_name)
);

create or replace function public.seed_song_keys_after_song_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.song_keys (song_id, member_name, key)
  values
    (new.id, 'Pastor Aluísio', null),
    (new.id, 'Rafaela', null),
    (new.id, 'Lucas', null),
    (new.id, 'Gustavo', null),
    (new.id, 'Luísa', null),
    (new.id, 'Dayane', null)
  on conflict (song_id, member_name) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_song_keys_after_song_insert on public.songs;
create trigger trg_seed_song_keys_after_song_insert
after insert on public.songs
for each row
execute function public.seed_song_keys_after_song_insert();
```

## Uso local

```bash
# opção 1: VS Code Live Server
# opção 2:
npx serve .
```

Acesse a pasta `louvor-tons` e abra no navegador.

## Deploy na Vercel

1. Suba o repositório no GitHub.
2. Importe o projeto na Vercel.
3. Configure as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
4. No `index.html`, injete os valores via `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY`.

## Logo

Coloque a logo em:

```txt
louvor-tons/assets/logo.png
```

Se o arquivo não existir, o sistema mostra fallback com `VC` automaticamente.

## Funcionalidades implementadas

- Busca com debounce (~300ms) por título (parcial e case-insensitive).
- Cadastro manual de música.
- Importação em massa por colagem de texto (1 linha por título).
- Opção para remover prefixo numérico (`1.`, `1-`, `1)`).
- Remoção de vazios e duplicados no texto colado.
- Prevenção de duplicados já existentes no banco por `title_norm`.
- Inserção em lotes de 50 itens.
- Detalhes da música com 6 membros fixos e salvamento de tons no blur/botão.
- Exclusão opcional de música (cascade em `song_keys`).
