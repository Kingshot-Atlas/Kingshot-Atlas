-- Add Kingdom 9 Bye for KvK #1
-- Kingdom 9 had a Bye in KvK #1 that wasn't registered

INSERT INTO kvk_history (
    kingdom_number,
    kvk_number,
    opponent_kingdom,
    prep_result,
    battle_result,
    overall_result,
    order_index,
    created_at
) VALUES (
    9,      -- kingdom_number
    1,      -- kvk_number
    0,      -- opponent_kingdom (0 = Bye)
    'B',    -- prep_result (Bye)
    'B',    -- battle_result (Bye)
    'Bye',  -- overall_result
    1,      -- order_index (same as kvk_number)
    NOW()   -- created_at
)
ON CONFLICT (kingdom_number, kvk_number) 
DO UPDATE SET 
    opponent_kingdom = EXCLUDED.opponent_kingdom,
    prep_result = EXCLUDED.prep_result,
    battle_result = EXCLUDED.battle_result,
    overall_result = EXCLUDED.overall_result,
    order_index = EXCLUDED.order_index;

-- Verify the insert
SELECT * FROM kvk_history WHERE kingdom_number = 9 AND kvk_number = 1;
