-- Align match_menu_items default threshold with API (0.6).
CREATE OR REPLACE FUNCTION match_menu_items(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5,
    p_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    pos_name text,
    title text,
    description text,
    price decimal,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mi.id,
        mi.pos_name::text,
        mi.title::text,
        mi.description,
        mi.price,
        1 - (mi.embedding <=> query_embedding) AS similarity
    FROM menu_items mi
    WHERE mi.is_active = true
        AND mi.restaurant_id = p_restaurant_id
        AND 1 - (mi.embedding <=> query_embedding) > match_threshold
    ORDER BY mi.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
