"""
Venturelyx backend integration tests.
Covers: auth, business onboarding, dashboard/AI, operate (leads/jobs/invoices),
scaleseo (scan/audits/recs/generate-page/keywords/competitors), reviews, payments,
and multi-tenant isolation.
"""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

# --- helpers ---------------------------------------------------------------
def _rand_email(prefix="TEST_"):
    return f"{prefix}{uuid.uuid4().hex[:10]}@vlxtest.com"


@pytest.fixture(scope="session")
def primary_creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text() if p.exists() else ""
    email = re.search(r"Email:\s*(\S+)", content).group(1)
    password = re.search(r"Password:\s*(\S+)", content).group(1)
    return {"email": email, "password": password, "name": "Venturelyx Owner"}


@pytest.fixture(scope="session")
def primary_token(primary_creds):
    # try login; else register
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": primary_creds["email"], "password": primary_creds["password"]})
    if r.status_code != 200:
        rr = requests.post(f"{BASE_URL}/api/auth/register", json=primary_creds)
        if rr.status_code != 200:
            pytest.fail(f"Primary register failed: {rr.status_code} {rr.text}")
        return rr.json()["token"]
    return r.json()["token"]


@pytest.fixture(scope="session")
def primary_headers(primary_token):
    return {"Authorization": f"Bearer {primary_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def primary_business(primary_headers):
    # ensure onboarded
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=primary_headers)
    assert r.status_code == 200
    body = r.json()
    if not body.get("has_business"):
        rr = requests.post(f"{BASE_URL}/api/business/onboard", headers=primary_headers,
                           json={"name": "Venturelyx Test Co", "website": "https://example.com",
                                 "industry": "Consulting", "service_area": "Global"})
        assert rr.status_code == 200, rr.text
        return rr.json()
    return body["business"]


# --- Auth ------------------------------------------------------------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_register_login_me_logout(self):
        creds = {"email": _rand_email(), "password": "P@ssw0rd!", "name": "Fresh User"}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=creds)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == creds["email"]

        # duplicate register
        rd = requests.post(f"{BASE_URL}/api/auth/register", json=creds)
        assert rd.status_code == 400

        # login
        rl = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": creds["email"], "password": creds["password"]})
        assert rl.status_code == 200
        token = rl.json()["token"]

        h = {"Authorization": f"Bearer {token}"}
        rme = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert rme.status_code == 200
        me = rme.json()
        assert me["user"]["email"] == creds["email"]
        assert me["has_business"] is False  # fresh user

        # bad login
        rb = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": creds["email"], "password": "wrong"})
        assert rb.status_code == 401

        # unauthenticated
        ru = requests.get(f"{BASE_URL}/api/auth/me")
        assert ru.status_code == 401

        # logout
        rlo = requests.post(f"{BASE_URL}/api/auth/logout", headers=h)
        assert rlo.status_code == 200


# --- Business Onboarding & Dashboard --------------------------------------
class TestBusinessAndDashboard:
    def test_onboard_persists_and_metrics(self, primary_headers, primary_business):
        assert primary_business.get("business_id")
        # metrics
        r = requests.get(f"{BASE_URL}/api/dashboard/metrics", headers=primary_headers)
        assert r.status_code == 200
        m = r.json()
        for key in ["growth_score", "revenue", "leads", "customers",
                    "seo_score", "review_count", "jobs", "pipeline_value"]:
            assert key in m

    def test_ai_models_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/ai/models")
        assert r.status_code == 200
        j = r.json()
        assert "labels" in j and set(j["preferences"]) == {"auto", "claude", "gpt"}

    def test_next_best_action(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/next-best-action",
                         headers=primary_headers, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j["actions"], list) and len(j["actions"]) >= 1
        first = j["actions"][0]
        assert set(["title", "why", "impact", "module"]).issubset(first.keys())

    def test_settings_ai_pref(self, primary_headers):
        for pref in ["claude", "gpt", "auto"]:
            r = requests.put(f"{BASE_URL}/api/business/settings", headers=primary_headers,
                             json={"ai_provider_preference": pref})
            assert r.status_code == 200
            assert r.json()["ai_provider_preference"] == pref
        # invalid
        rb = requests.put(f"{BASE_URL}/api/business/settings", headers=primary_headers,
                          json={"ai_provider_preference": "bogus"})
        assert rb.status_code == 400


# --- Operate: Leads / Jobs / Invoices -------------------------------------
class TestOperate:
    def test_leads_crud(self, primary_headers, primary_business):
        # create
        r = requests.post(f"{BASE_URL}/api/operate/leads", headers=primary_headers,
                          json={"name": "TEST_Lead", "company": "Acme", "value": 500})
        assert r.status_code == 200
        lead_id = r.json()["lead_id"]
        assert r.json()["stage"] == "new"

        # list contains lead
        rl = requests.get(f"{BASE_URL}/api/operate/leads", headers=primary_headers)
        assert rl.status_code == 200
        assert any(l["lead_id"] == lead_id for l in rl.json()["leads"])
        assert rl.json()["stages"][0] == "new"

        # move stage
        rm = requests.put(f"{BASE_URL}/api/operate/leads/{lead_id}/stage",
                          headers=primary_headers, json={"stage": "qualified"})
        assert rm.status_code == 200

        # verify
        rl2 = requests.get(f"{BASE_URL}/api/operate/leads", headers=primary_headers)
        found = next(l for l in rl2.json()["leads"] if l["lead_id"] == lead_id)
        assert found["stage"] == "qualified"

        # invalid stage
        ri = requests.put(f"{BASE_URL}/api/operate/leads/{lead_id}/stage",
                          headers=primary_headers, json={"stage": "nope"})
        assert ri.status_code == 400

        # delete
        rd = requests.delete(f"{BASE_URL}/api/operate/leads/{lead_id}", headers=primary_headers)
        assert rd.status_code == 200
        rl3 = requests.get(f"{BASE_URL}/api/operate/leads", headers=primary_headers)
        assert not any(l["lead_id"] == lead_id for l in rl3.json()["leads"])

    def test_jobs_status_toggle(self, primary_headers):
        r = requests.post(f"{BASE_URL}/api/operate/jobs", headers=primary_headers,
                          json={"title": "TEST_Job", "customer": "Bob"})
        assert r.status_code == 200
        jid = r.json()["job_id"]
        ru = requests.put(f"{BASE_URL}/api/operate/jobs/{jid}/status", headers=primary_headers,
                          json={"title": "TEST_Job", "status": "completed"})
        assert ru.status_code == 200
        rl = requests.get(f"{BASE_URL}/api/operate/jobs", headers=primary_headers)
        job = next(j for j in rl.json()["jobs"] if j["job_id"] == jid)
        assert job["status"] == "completed"
        requests.delete(f"{BASE_URL}/api/operate/jobs/{jid}", headers=primary_headers)

    def test_invoice_and_revenue(self, primary_headers):
        # baseline revenue
        m0 = requests.get(f"{BASE_URL}/api/dashboard/metrics", headers=primary_headers).json()
        base_rev = m0["revenue"]

        r = requests.post(f"{BASE_URL}/api/operate/invoices", headers=primary_headers,
                          json={"customer": "TEST_Cust", "amount": 250, "status": "unpaid"})
        assert r.status_code == 200
        iid = r.json()["invoice_id"]

        # expense record
        re_ = requests.post(f"{BASE_URL}/api/operate/invoices", headers=primary_headers,
                            json={"customer": "TEST_Expense", "amount": 40, "type": "expense"})
        assert re_.status_code == 200
        eid = re_.json()["invoice_id"]

        # mark paid
        rp = requests.put(f"{BASE_URL}/api/operate/invoices/{iid}/status",
                          headers=primary_headers, json={"status": "paid"})
        assert rp.status_code == 200

        m1 = requests.get(f"{BASE_URL}/api/dashboard/metrics", headers=primary_headers).json()
        assert m1["revenue"] >= base_rev + 250 - 0.01

        # invalid status
        rb = requests.put(f"{BASE_URL}/api/operate/invoices/{iid}/status",
                          headers=primary_headers, json={"status": "weird"})
        assert rb.status_code == 400

        requests.delete(f"{BASE_URL}/api/operate/invoices/{iid}", headers=primary_headers)
        requests.delete(f"{BASE_URL}/api/operate/invoices/{eid}", headers=primary_headers)


# --- ScaleSEO ---------------------------------------------------------------
class TestScaleSEO:
    audit_id = None

    def test_scan_public_and_private(self, primary_headers):
        # private-IP safeguard
        for bad in ["http://localhost", "http://127.0.0.1", "http://10.0.0.1"]:
            r = requests.post(f"{BASE_URL}/api/seo/scan", headers=primary_headers,
                              json={"url": bad}, timeout=30)
            assert r.status_code == 400, f"Private URL {bad} should be rejected, got {r.status_code}"

        # public url
        r = requests.post(f"{BASE_URL}/api/seo/scan", headers=primary_headers,
                          json={"url": "https://example.com"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 0 <= data["score"] <= 100
        assert isinstance(data["issues"], list)
        assert isinstance(data["checks"], dict)
        TestScaleSEO.audit_id = data["audit_id"]

    def test_audit_history(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/seo/audits", headers=primary_headers)
        assert r.status_code == 200
        assert any(a["audit_id"] == TestScaleSEO.audit_id for a in r.json()["audits"])

    def test_recommendations(self, primary_headers):
        assert TestScaleSEO.audit_id
        r = requests.get(
            f"{BASE_URL}/api/seo/audits/{TestScaleSEO.audit_id}/recommendations",
            headers=primary_headers, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j["recommendations"], list) and len(j["recommendations"]) >= 1

    def test_generate_page_stream(self, primary_headers):
        r = requests.post(f"{BASE_URL}/api/seo/generate-page", headers=primary_headers,
                          json={"page_type": "service", "topic": "Emergency plumbing",
                                "keywords": "plumber"}, stream=True, timeout=120)
        assert r.status_code == 200
        collected = b""
        start = time.time()
        for chunk in r.iter_content(1024):
            if chunk:
                collected += chunk
            if len(collected) > 200 or time.time() - start > 60:
                break
        r.close()
        assert len(collected) > 20, "Stream produced no content"

    def test_keywords_and_competitors(self, primary_headers):
        rk = requests.post(f"{BASE_URL}/api/seo/keywords", headers=primary_headers,
                           json={"keyword": "TEST_kw", "rank": 5, "volume": 100})
        assert rk.status_code == 200
        kid = rk.json()["keyword_id"]
        rlk = requests.get(f"{BASE_URL}/api/seo/keywords", headers=primary_headers)
        assert any(k["keyword_id"] == kid for k in rlk.json()["keywords"])
        assert requests.delete(f"{BASE_URL}/api/seo/keywords/{kid}",
                               headers=primary_headers).status_code == 200

        rc = requests.post(f"{BASE_URL}/api/seo/competitors", headers=primary_headers,
                           json={"name": "TEST_Comp", "website": "https://example.org"})
        assert rc.status_code == 200
        cid = rc.json()["competitor_id"]
        rlc = requests.get(f"{BASE_URL}/api/seo/competitors", headers=primary_headers)
        assert any(c["competitor_id"] == cid for c in rlc.json()["competitors"])
        assert requests.delete(f"{BASE_URL}/api/seo/competitors/{cid}",
                               headers=primary_headers).status_code == 200


# --- Reviews ---------------------------------------------------------------
class TestReviews:
    def test_review_flow(self, primary_headers):
        # add review
        r = requests.post(f"{BASE_URL}/api/reviews", headers=primary_headers,
                          json={"author": "TEST_Client", "rating": 5, "text": "Amazing service"})
        assert r.status_code == 200
        rid = r.json()["review_id"]

        # invalid rating
        rb = requests.post(f"{BASE_URL}/api/reviews", headers=primary_headers,
                           json={"author": "x", "rating": 7})
        assert rb.status_code == 400

        # list + meta
        rl = requests.get(f"{BASE_URL}/api/reviews", headers=primary_headers)
        assert rl.status_code == 200
        j = rl.json()
        assert j["meta"]["count"] >= 1
        assert isinstance(j["trend"], list)

        # AI streaming reply
        rs = requests.post(f"{BASE_URL}/api/reviews/respond", headers=primary_headers,
                           json={"review_id": rid}, stream=True, timeout=90)
        assert rs.status_code == 200
        collected = b""
        start = time.time()
        for c in rs.iter_content(512):
            if c:
                collected += c
            if len(collected) > 40 or time.time() - start > 60:
                break
        rs.close()
        assert len(collected) > 5

        # approve
        ra = requests.post(f"{BASE_URL}/api/reviews/approve", headers=primary_headers,
                           json={"review_id": rid, "response": "Thank you!"})
        assert ra.status_code == 200
        rl2 = requests.get(f"{BASE_URL}/api/reviews", headers=primary_headers).json()
        rev = next(x for x in rl2["reviews"] if x["review_id"] == rid)
        assert rev["ai_response"] == "Thank you!"

        # request review record-only
        rr = requests.post(f"{BASE_URL}/api/reviews/request", headers=primary_headers,
                           json={"customer_name": "TEST_Cust", "customer_contact": "a@b.com"})
        assert rr.status_code == 200 and rr.json()["status"] == "sent"


# --- Payments --------------------------------------------------------------
class TestPayments:
    def test_plans(self):
        r = requests.get(f"{BASE_URL}/api/payments/plans")
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert len(plans) == 3
        for p in plans:
            assert {"lookup_key", "name", "price", "features"}.issubset(p.keys())

    def test_checkout_returns_url(self, primary_headers):
        r = requests.post(f"{BASE_URL}/api/payments/checkout", headers=primary_headers,
                          json={"lookup_key": "growth_monthly",
                                "origin_url": "https://example.com"}, timeout=60)
        # If Stripe keys/prices are configured, expect a checkout url; else server returns 500 with details.
        if r.status_code == 200:
            data = r.json()
            assert data.get("checkout_url", "").startswith("http")
            assert data.get("session_id")
        else:
            pytest.fail(f"/checkout failed: {r.status_code} {r.text}")


# --- Multi-tenant isolation ------------------------------------------------
class TestIsolation:
    def test_second_user_cannot_see_first(self, primary_headers):
        # ensure primary has a lead
        rc = requests.post(f"{BASE_URL}/api/operate/leads", headers=primary_headers,
                           json={"name": "TEST_Iso_Lead", "value": 999})
        assert rc.status_code == 200
        primary_lead_id = rc.json()["lead_id"]

        # create fresh user + business
        creds = {"email": _rand_email("TEST_iso_"), "password": "P@ss123!", "name": "Iso"}
        rr = requests.post(f"{BASE_URL}/api/auth/register", json=creds)
        assert rr.status_code == 200
        tok = rr.json()["token"]
        h2 = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        ro = requests.post(f"{BASE_URL}/api/business/onboard", headers=h2,
                           json={"name": "IsoBiz", "industry": "Retail"})
        assert ro.status_code == 200

        rl = requests.get(f"{BASE_URL}/api/operate/leads", headers=h2)
        assert rl.status_code == 200
        assert not any(l["lead_id"] == primary_lead_id for l in rl.json()["leads"])

        # cleanup primary's iso lead
        requests.delete(f"{BASE_URL}/api/operate/leads/{primary_lead_id}", headers=primary_headers)
