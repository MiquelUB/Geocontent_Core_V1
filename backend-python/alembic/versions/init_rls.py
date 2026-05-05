"""initial rls

Revision ID: init_rls
Revises: 
Create Date: 2026-05-05 21:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'init_rls'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Habilitar RLS a totes les taules
    tables = [
        "users", "municipalities", "routes", "pois", "route_pois", 
        "user_unlocks", "user_route_progress", "poi_visits", 
        "user_telemetry", "reports", "outbox_events"
    ]
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # 2. Polítiques Bàsiques de Seguretat (Sovereign V2)
    
    # POLÍTICA: Els usuaris només poden veure i editar el seu propi perfil
    op.execute("""
        CREATE POLICY user_self_manage ON users
        FOR ALL USING (id::text = current_setting('app.current_user_id', true));
    """)

    # POLÍTICA: Municipis, Rutes i POIs són llegibles per tothom (públic)
    op.execute("CREATE POLICY public_read_municipalities ON municipalities FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_routes ON routes FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_pois ON pois FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_route_pois ON route_pois FOR SELECT USING (true);")

    # POLÍTICA: Unlocks i Progrés (Propietari)
    op.execute("""
        CREATE POLICY user_manage_unlocks ON user_unlocks
        FOR ALL USING (user_id::text = current_setting('app.current_user_id', true));
    """)
    op.execute("""
        CREATE POLICY user_manage_progress ON user_route_progress
        FOR ALL USING (user_id::text = current_setting('app.current_user_id', true));
    """)

    # POLÍTICA: Outbox (Només Worker / System)
    op.execute("CREATE POLICY system_manage_outbox ON outbox_events FOR ALL USING (false);")

def downgrade() -> None:
    # Drop polítiques per nom
    policies = {
        "users": "user_self_manage",
        "municipalities": "public_read_municipalities",
        "routes": "public_read_routes",
        "pois": "public_read_pois",
        "route_pois": "public_read_route_pois",
        "user_unlocks": "user_manage_unlocks",
        "user_route_progress": "user_manage_progress",
        "outbox_events": "system_manage_outbox",
    }

    for table, policy in policies.items():
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table};")

    # Desactivar RLS
    tables = [
        "users", "municipalities", "routes", "pois", "route_pois", 
        "user_unlocks", "user_route_progress", "poi_visits", 
        "user_telemetry", "reports", "outbox_events"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
