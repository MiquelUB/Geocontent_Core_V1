"""init rls policies

Revision ID: init_rls_policies
Revises: init_rls
Create Date: 2026-06-15 10:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'init_rls_policies'
down_revision = 'init_rls'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Eliminar polítiques anteriors o temporals que puguin col·lidir
    op.execute("DROP POLICY IF EXISTS user_self_manage ON users;")
    op.execute("DROP POLICY IF EXISTS public_read_municipalities ON municipalities;")
    op.execute("DROP POLICY IF EXISTS public_read_routes ON routes;")
    op.execute("DROP POLICY IF EXISTS public_read_pois ON pois;")
    op.execute("DROP POLICY IF EXISTS public_read_route_pois ON route_pois;")
    op.execute("DROP POLICY IF EXISTS user_manage_unlocks ON user_unlocks;")
    op.execute("DROP POLICY IF EXISTS user_manage_progress ON user_route_progress;")
    op.execute("DROP POLICY IF EXISTS system_manage_outbox ON outbox_events;")

    # 2. Polítiques d'aïllament per municipi (SaaS Multi-tenant)
    
    # POLÍTICA: routes — aïllament per municipi + accés de sistema
    op.execute("""
        CREATE POLICY municipality_isolation ON routes FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: users — aïllament per municipi + propi perfil + accés de sistema
    op.execute("""
        CREATE POLICY user_municipality_isolation ON users FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: reports — aïllament per municipi + accés de sistema
    op.execute("""
        CREATE POLICY reports_municipality ON reports FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: user_unlocks — propietari de les dades + accés de sistema
    op.execute("""
        CREATE POLICY unlock_owner ON user_unlocks FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: user_route_progress — propietari de les dades + accés de sistema
    op.execute("""
        CREATE POLICY progress_owner ON user_route_progress FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: outbox_events — només accés per al sistema/worker
    op.execute("""
        CREATE POLICY system_only_outbox ON outbox_events FOR ALL
        USING (current_setting('app.role', true) = 'system');
    """)

    # POLÍTICA: lectura pública (select) de municipis i POIs
    op.execute("CREATE POLICY public_read_municipalities ON municipalities FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_pois ON pois FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_route_pois ON route_pois FOR SELECT USING (true);")


def downgrade() -> None:
    # Drop polítiques creades
    op.execute("DROP POLICY IF EXISTS municipality_isolation ON routes;")
    op.execute("DROP POLICY IF EXISTS user_municipality_isolation ON users;")
    op.execute("DROP POLICY IF EXISTS reports_municipality ON reports;")
    op.execute("DROP POLICY IF EXISTS unlock_owner ON user_unlocks;")
    op.execute("DROP POLICY IF EXISTS progress_owner ON user_route_progress;")
    op.execute("DROP POLICY IF EXISTS system_only_outbox ON outbox_events;")
    op.execute("DROP POLICY IF EXISTS public_read_municipalities ON municipalities;")
    op.execute("DROP POLICY IF EXISTS public_read_pois ON pois;")
    op.execute("DROP POLICY IF EXISTS public_read_route_pois ON route_pois;")

    # Re-crear polítiques bàsiques d'init_rls
    op.execute("""
        CREATE POLICY user_self_manage ON users
        FOR ALL USING (id::text = current_setting('app.current_user_id', true));
    """)
    op.execute("CREATE POLICY public_read_municipalities ON municipalities FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_routes ON routes FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_pois ON pois FOR SELECT USING (true);")
    op.execute("CREATE POLICY public_read_route_pois ON route_pois FOR SELECT USING (true);")
    op.execute("""
        CREATE POLICY user_manage_unlocks ON user_unlocks
        FOR ALL USING (user_id::text = current_setting('app.current_user_id', true));
    """)
    op.execute("""
        CREATE POLICY user_manage_progress ON user_route_progress
        FOR ALL USING (user_id::text = current_setting('app.current_user_id', true));
    """)
    op.execute("CREATE POLICY system_manage_outbox ON outbox_events FOR ALL USING (false);")
