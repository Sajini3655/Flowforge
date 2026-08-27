DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs'
          AND column_name = 'request_payload' AND udt_name = 'oid'
    ) THEN
        ALTER TABLE jobs ALTER COLUMN request_payload TYPE TEXT
            USING convert_from(lo_get(request_payload), 'UTF8');
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs'
          AND column_name = 'result' AND udt_name = 'oid'
    ) THEN
        ALTER TABLE jobs ALTER COLUMN result TYPE TEXT
            USING CASE WHEN result IS NULL THEN NULL
                       ELSE convert_from(lo_get(result), 'UTF8') END;
    END IF;
END $$;