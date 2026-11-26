-- Roles are bundles of permissions. Code checks permissions, never role names.
INSERT INTO permissions (name, description) VALUES
    ('trip:own',            'Create and manage own trips'),
    ('admin:access',        'Open the admin portal'),
    ('destination:write',   'Create and edit destinations and attractions'),
    ('destination:publish', 'Publish and unpublish destinations'),
    ('user:read',           'View user accounts'),
    ('user:manage',         'Suspend and reactivate user accounts'),
    ('audit:read',          'Read audit logs'),
    ('role:manage',         'Manage roles and permissions'),
    ('provider:self',       'Manage own provider business (Phase 3)');

INSERT INTO roles (name, description) VALUES
    ('TRAVELER',    'Plans and takes trips'),
    ('PROVIDER',    'Offers services on the marketplace (Phase 3)'),
    ('ADMIN',       'Operates the platform'),
    ('SUPER_ADMIN', 'Full platform-level access');

INSERT INTO role_permissions (role_name, permission_name) VALUES
    ('TRAVELER', 'trip:own'),
    ('PROVIDER', 'trip:own'),
    ('PROVIDER', 'provider:self'),
    ('ADMIN', 'trip:own'),
    ('ADMIN', 'admin:access'),
    ('ADMIN', 'destination:write'),
    ('ADMIN', 'destination:publish'),
    ('ADMIN', 'user:read'),
    ('ADMIN', 'user:manage'),
    ('ADMIN', 'audit:read'),
    ('SUPER_ADMIN', 'trip:own'),
    ('SUPER_ADMIN', 'admin:access'),
    ('SUPER_ADMIN', 'destination:write'),
    ('SUPER_ADMIN', 'destination:publish'),
    ('SUPER_ADMIN', 'user:read'),
    ('SUPER_ADMIN', 'user:manage'),
    ('SUPER_ADMIN', 'audit:read'),
    ('SUPER_ADMIN', 'role:manage');
