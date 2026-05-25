-- Set earned_xp to 100 for all unlocks
UPDATE user_unlocks SET earned_xp = 100 WHERE earned_xp = 0;
-- Add 50 more for those where quiz is solved
UPDATE user_unlocks SET earned_xp = 150 WHERE quiz_solved = true AND earned_xp = 100;
-- Synchronize profiles XP based on the sum of unlocks
UPDATE profiles p 
SET xp = (SELECT COALESCE(SUM(earned_xp), 0) FROM user_unlocks WHERE user_id = p.id);
