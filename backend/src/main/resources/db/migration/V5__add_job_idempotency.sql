ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_submitted_by_idempotency_key
    ON jobs (submitted_by_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
