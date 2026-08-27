CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID NOT NULL PRIMARY KEY,
    job_id UUID NOT NULL,
    message_payload OID NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_outbox_events_job FOREIGN KEY (job_id) REFERENCES jobs (id)
);

-- Create index on published status for efficient polling
CREATE INDEX IF NOT EXISTS idx_outbox_events_published ON outbox_events(published, created_at);
