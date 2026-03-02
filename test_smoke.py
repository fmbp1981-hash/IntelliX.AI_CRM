#!/usr/bin/env python3
"""Smoke Tests — Verificação básica das rotas recém-refatoradas (NossoAgent / AI Governance)."""

import requests
import sys

# Assume app instance will be running locally at 3000
BASE_URL = "http://localhost:3000"
TIMEOUT = 10
results = {"passed": 0, "failed": 0, "errors": []}

def test(name, condition, detail=""):
    if condition:
        results["passed"] += 1
        print(f"  [ OK ] {name}")
    else:
        results["failed"] += 1
        results["errors"].append({"test": name, "detail": detail})
        print(f"  [FAIL] {name} - {detail}")

def smoke_test_routes(routes):
    print("\n[SMOKE TESTS] - NossoAgent APIs")
    print("=" * 60)

    for method, route, expect_auth_failure in routes:
        url = f"{BASE_URL}{route}"
        try:
            if method == 'GET':
                r = requests.get(url, timeout=TIMEOUT, allow_redirects=True)
            else:
                r = requests.post(url, timeout=TIMEOUT, allow_redirects=True)
            
            # Since these are protected APIs, getting 401 Unauthorized is EXPECTED and means the endpoint exists and works
            # 500 would be a crash (bad)
            # 404 would be missing endpoint (bad)
            
            is_success = r.status_code == 401 if expect_auth_failure else r.status_code < 500
            
            test(
                f"{method} {route} -> {r.status_code}",
                is_success,
                f"Retornou {r.status_code} em vez do esperado"
            )
        except requests.exceptions.RequestException as e:
            test(f"{method} {route}", False, str(e))

    print(f"\n[ RESULT ] {results['passed']} passed, {results['failed']} failed")
    
    if results['failed'] > 0:
        sys.exit(1)
        
if __name__ == "__main__":
    routes = [
        ('GET', '/api/ai/agent-metrics', True),
        ('GET', '/api/settings/knowledge', True),
        ('POST', '/api/ai/generate', True),
        ('GET', '/api/conversations', True),
        ('POST', '/api/conversations/123/actions', True),
        ('GET', '/api/conversations/123/messages', True),
        ('POST', '/api/conversations/123/messages', True),
        ('GET', '/', False),  # Landing should 200
        ('GET', '/login', False) # Login should 200
    ]
    smoke_test_routes(routes)
