DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'outbox_events'
          AND column_name = 'message_payload'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE outbox_events
            ALTER COLUMN message_payload TYPE TEXT
            USING convert_from(lo_get(message_payload), 'UTF8');
    END IF;
END $$;