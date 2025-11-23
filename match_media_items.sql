-- Run this in your Supabase SQL Editor to enable vector search with category filtering

create or replace function match_media_items (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_category text
)
returns setof media_items
language plpgsql
as $$
begin
  return query
  select *
  from media_items
  where 1 - (media_items.embedding <=> query_embedding) > match_threshold
  and media_items.type = filter_category
  order by media_items.embedding <=> query_embedding
  limit match_count;
end;
$$;
