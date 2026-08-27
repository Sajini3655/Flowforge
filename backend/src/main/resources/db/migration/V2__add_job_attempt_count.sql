ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER;

UPDATE jobs
SET attempt_count = 0
WHERE attempt_count IS NULL;

ALTER TABLE jobs
    ALTER COLUMN attempt_count SET DEFAULT 0,
    ALTER COLUMN attempt_count SET NOT NULL;
