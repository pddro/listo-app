-- Real-time Sync Stored Procedures
-- These functions ensure atomic operations for multi-item updates
-- Run this in Supabase SQL Editor

-- 1. Add single item at position 0, shift existing siblings atomically
CREATE OR REPLACE FUNCTION add_item_atomic(
  p_list_id TEXT,
  p_content TEXT,
  p_parent_id UUID DEFAULT NULL
)
RETURNS items AS $$
DECLARE
  v_new_item items;
BEGIN
  -- Shift all incomplete siblings at this level up by 1
  UPDATE items
  SET position = position + 1,
      updated_at = NOW()
  WHERE list_id = p_list_id
    AND parent_id IS NOT DISTINCT FROM p_parent_id
    AND completed = false;

  -- Insert the new item at position 0
  INSERT INTO items (list_id, content, parent_id, position, completed, created_at, updated_at)
  VALUES (p_list_id, p_content, p_parent_id, 0, false, NOW(), NOW())
  RETURNING * INTO v_new_item;

  RETURN v_new_item;
END;
$$ LANGUAGE plpgsql;

-- 2. Add multiple items at once, shift existing siblings atomically
CREATE OR REPLACE FUNCTION add_items_batch_atomic(
  p_list_id TEXT,
  p_contents TEXT[],
  p_parent_id UUID DEFAULT NULL
)
RETURNS SETOF items AS $$
DECLARE
  v_shift_amount INT;
  v_content TEXT;
  v_position INT := 0;
BEGIN
  v_shift_amount := array_length(p_contents, 1);

  IF v_shift_amount IS NULL OR v_shift_amount = 0 THEN
    RETURN;
  END IF;

  -- Shift all incomplete siblings at this level up by the number of new items
  UPDATE items
  SET position = position + v_shift_amount,
      updated_at = NOW()
  WHERE list_id = p_list_id
    AND parent_id IS NOT DISTINCT FROM p_parent_id
    AND completed = false;

  -- Insert all new items with sequential positions starting at 0
  FOREACH v_content IN ARRAY p_contents
  LOOP
    RETURN QUERY
    INSERT INTO items (list_id, content, parent_id, position, completed, created_at, updated_at)
    VALUES (p_list_id, v_content, p_parent_id, v_position, false, NOW(), NOW())
    RETURNING *;

    v_position := v_position + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Reorder item within same parent level atomically
CREATE OR REPLACE FUNCTION reorder_item_atomic(
  p_item_id UUID,
  p_new_position INT
)
RETURNS void AS $$
DECLARE
  v_item items;
  v_old_position INT;
BEGIN
  -- Get the item and its current position
  SELECT * INTO v_item FROM items WHERE id = p_item_id;

  IF v_item IS NULL THEN
    RETURN;
  END IF;

  v_old_position := v_item.position;

  IF v_old_position = p_new_position THEN
    RETURN;
  END IF;

  -- Moving down (old_position < new_position): shift items between old+1 and new UP by 1
  IF v_old_position < p_new_position THEN
    UPDATE items
    SET position = position - 1,
        updated_at = NOW()
    WHERE list_id = v_item.list_id
      AND parent_id IS NOT DISTINCT FROM v_item.parent_id
      AND position > v_old_position
      AND position <= p_new_position;
  -- Moving up (old_position > new_position): shift items between new and old-1 DOWN by 1
  ELSE
    UPDATE items
    SET position = position + 1,
        updated_at = NOW()
    WHERE list_id = v_item.list_id
      AND parent_id IS NOT DISTINCT FROM v_item.parent_id
      AND position >= p_new_position
      AND position < v_old_position;
  END IF;

  -- Update the item's position
  UPDATE items
  SET position = p_new_position,
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Move item to a new parent atomically
CREATE OR REPLACE FUNCTION move_item_to_parent_atomic(
  p_item_id UUID,
  p_new_parent_id UUID,
  p_new_position INT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_item items;
  v_final_position INT;
BEGIN
  -- Get the item
  SELECT * INTO v_item FROM items WHERE id = p_item_id;

  IF v_item IS NULL THEN
    RETURN;
  END IF;

  -- Close the gap at the old position
  UPDATE items
  SET position = position - 1,
      updated_at = NOW()
  WHERE list_id = v_item.list_id
    AND parent_id IS NOT DISTINCT FROM v_item.parent_id
    AND position > v_item.position;

  -- Determine new position (at end of new parent's children if not specified)
  IF p_new_position IS NULL THEN
    SELECT COALESCE(MAX(position) + 1, 0) INTO v_final_position
    FROM items
    WHERE list_id = v_item.list_id
      AND parent_id IS NOT DISTINCT FROM p_new_parent_id;
  ELSE
    v_final_position := p_new_position;

    -- Make room at the new position
    UPDATE items
    SET position = position + 1,
        updated_at = NOW()
    WHERE list_id = v_item.list_id
      AND parent_id IS NOT DISTINCT FROM p_new_parent_id
      AND position >= p_new_position;
  END IF;

  -- Move the item
  UPDATE items
  SET parent_id = p_new_parent_id,
      position = v_final_position,
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Bulk update positions (for sort operations)
-- Accepts array of {id, position} pairs as JSONB
CREATE OR REPLACE FUNCTION bulk_update_positions(
  p_updates JSONB
)
RETURNS void AS $$
DECLARE
  v_update JSONB;
BEGIN
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE items
    SET position = (v_update->>'position')::INT,
        updated_at = NOW()
    WHERE id = (v_update->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Ungroup all items atomically (remove categories, flatten to root)
CREATE OR REPLACE FUNCTION ungroup_all_atomic(
  p_list_id TEXT
)
RETURNS void AS $$
DECLARE
  v_position INT := 0;
  v_item RECORD;
BEGIN
  -- Delete all category items (items starting with #)
  DELETE FROM items
  WHERE list_id = p_list_id
    AND content LIKE '#%';

  -- Update all remaining items: set parent_id to null and reassign positions
  -- Incomplete items first, then completed
  FOR v_item IN
    SELECT id FROM items
    WHERE list_id = p_list_id
    ORDER BY completed ASC, position ASC
  LOOP
    UPDATE items
    SET parent_id = NULL,
        position = v_position,
        updated_at = NOW()
    WHERE id = v_item.id;

    v_position := v_position + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Delete item and close gap atomically
CREATE OR REPLACE FUNCTION delete_item_atomic(
  p_item_id UUID
)
RETURNS void AS $$
DECLARE
  v_item items;
BEGIN
  -- Get the item first
  SELECT * INTO v_item FROM items WHERE id = p_item_id;

  IF v_item IS NULL THEN
    RETURN;
  END IF;

  -- Delete the item
  DELETE FROM items WHERE id = p_item_id;

  -- Close the gap
  UPDATE items
  SET position = position - 1,
      updated_at = NOW()
  WHERE list_id = v_item.list_id
    AND parent_id IS NOT DISTINCT FROM v_item.parent_id
    AND position > v_item.position;
END;
$$ LANGUAGE plpgsql;
