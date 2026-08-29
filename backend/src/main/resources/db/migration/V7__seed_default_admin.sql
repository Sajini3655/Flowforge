-- Seed default admin user for local development and demonstration if not already present
INSERT INTO users (id, email, password_hash, role, created_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@flowforge.local',
    '$2a$10$KLlNtk6krlRC9JO5Aaks7eQEtUuxNgOARlLGWTe22HvQAjc.3qFwW',
    'ADMIN',
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE
SET role = 'ADMIN',
    password_hash = EXCLUDED.password_hash;

