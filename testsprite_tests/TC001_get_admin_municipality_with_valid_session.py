import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
ADMIN_GATEWAY_URL = f"{BASE_URL}/admin"
LOGIN_URL = f"{BASE_URL}/api/auth/login"  # Hypothetical endpoint for obtaining session cookie or token
MUNICIPALITY_URL = f"{BASE_URL}/api/admin/municipality"

def test_get_admin_municipality_with_valid_session():
    session = requests.Session()

    try:
        # Step 1: Access /admin page to unlock legacy password gate with 'mistic_master_audit'
        # Since this is an UI operation, simulate the legacy password gate unlock by sending the password with a POST or GET.
        # PRD doesn't specify exact endpoint, so assume a POST to /admin/legacy-gate that sets a cookie or session flag
        # If no endpoint exists, try to authenticate via a login endpoint.
        # Use the legacy password 'mistic_master_audit' as first line of defense.

        legacy_gate_url = f"{ADMIN_GATEWAY_URL}/legacy-gate"
        legacy_payload = {'password': 'mistic_master_audit'}
        legacy_resp = session.post(legacy_gate_url, json=legacy_payload, timeout=TIMEOUT)
        assert legacy_resp.status_code == 200, f"Legacy gate unlock failed with status {legacy_resp.status_code}"

        # Step 2: Authenticate to create a valid authenticated admin session.
        # The PRD references Auth.js v5 with sessions but does not specify API login details.
        # Hypothetically, post to /api/auth/login with credentials.
        # Since only legacy password is provided and no username, assume a POST with the password to get session cookie.

        login_payload = {'password': 'mistic_master_audit'}
        login_resp = session.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"

        # Expect session cookie or auth headers to be set automatically in session

        # Step 3: Perform GET /api/admin/municipality with the authenticated session
        headers = {'Accept': 'application/json'}
        municipality_resp = session.get(MUNICIPALITY_URL, headers=headers, timeout=TIMEOUT)
        assert municipality_resp.status_code == 200, f"Expected 200 OK but got {municipality_resp.status_code}"

        data = municipality_resp.json()
        assert isinstance(data, dict), "Municipality data should be a JSON object"

        # Check for expected keys in municipality data (schema is unspecified, check at least presence of some keys)
        expected_keys = ['id', 'name', 'region']
        found_keys = data.keys()
        for key in expected_keys:
            assert key in found_keys, f"Expected key '{key}' missing in municipality data"

    finally:
        # Logout or invalidate session if an endpoint exists, else just close session
        session.close()

test_get_admin_municipality_with_valid_session()