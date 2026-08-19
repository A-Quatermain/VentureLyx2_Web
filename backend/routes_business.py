from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deps import db, new_id, now_iso, CurrentUser, CurrentBusiness
from ai_service import generate, extract_json, MODEL_LABELS

router = APIRouter(prefix="/api", tags=["business"])


class OnboardReq(BaseModel):
    name: str
    website: str = ""
    industry: str = ""
    service_area: str = ""


class SettingsReq(BaseModel):
    ai_provider_preference: str = "auto"  # auto | claude | gpt


@router.post("/business/onboard")
async def onboard(req: OnboardReq, user: CurrentUser):
    existing = await db.businesses.find_one({"owner_id": user["user_id"]}, {"_id": 0})
    if existing:
        await db.businesses.update_one(
            {"owner_id": user["user_id"]},
            {"$set": {"name": req.name, "website": req.website,
                      "industry": req.industry, "service_area": req.service_area,
                      "updated_at": now_iso()}},
        )
        return await db.businesses.find_one({"owner_id": user["user_id"]}, {"_id": 0})

    business_id = new_id("biz")
    org_id = new_id("org")
    doc = {
        "business_id": business_id,
        "org_id": org_id,
        "owner_id": user["user_id"],
        "name": req.name,
        "website": req.website,
        "industry": req.industry,
        "service_area": req.service_area,
        "ai_provider_preference": "auto",
        "plan": "free",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.businesses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/business")
async def get_business(business: CurrentBusiness):
    return business


@router.put("/business/settings")
async def update_settings(req: SettingsReq, business: CurrentBusiness):
    if req.ai_provider_preference not in ("auto", "claude", "gpt"):
        raise HTTPException(status_code=400, detail="Invalid preference")
    await db.businesses.update_one(
        {"business_id": business["business_id"]},
        {"$set": {"ai_provider_preference": req.ai_provider_preference, "updated_at": now_iso()}},
    )
    return {"ok": True, "ai_provider_preference": req.ai_provider_preference}


@router.get("/ai/models")
async def ai_models():
    return {"labels": MODEL_LABELS, "preferences": ["auto", "claude", "gpt"]}


async def _sum(coll, business_id, field=None, match=None):
    q = {"business_id": business_id}
    if match:
        q.update(match)
    docs = await coll.find(q, {"_id": 0}).to_list(2000)
    if field:
        return sum(float(d.get(field, 0) or 0) for d in docs), docs
    return len(docs), docs


@router.get("/dashboard/metrics")
async def dashboard_metrics(business: CurrentBusiness):
    bid = business["business_id"]

    invoices = await db.invoices.find({"business_id": bid}, {"_id": 0}).to_list(2000)
    revenue = sum(float(i.get("amount", 0)) for i in invoices if i.get("status") == "paid")
    outstanding = sum(float(i.get("amount", 0)) for i in invoices if i.get("status") != "paid")

    leads = await db.leads.find({"business_id": bid}, {"_id": 0}).to_list(2000)
    open_leads = [l for l in leads if l.get("stage") not in ("won", "lost")]
    customers = [l for l in leads if l.get("stage") == "won"]
    pipeline_value = sum(float(l.get("value", 0)) for l in open_leads)

    jobs = await db.jobs.find({"business_id": bid}, {"_id": 0}).to_list(2000)
    open_jobs = [j for j in jobs if j.get("status") != "completed"]

    expenses = sum(float(i.get("amount", 0)) for i in invoices if i.get("type") == "expense")

    audits = await db.seo_audits.find({"business_id": bid}, {"_id": 0}).sort("created_at", -1).to_list(1)
    seo_score = audits[0]["score"] if audits else 0

    reviews_doc = await db.reviews_meta.find_one({"business_id": bid}, {"_id": 0})
    rating = reviews_doc.get("rating", 0) if reviews_doc else 0
    review_count = reviews_doc.get("count", 0) if reviews_doc else 0

    # Growth Score: weighted composite (0-100)
    lead_score = min(len(leads) * 5, 100)
    revenue_score = min(revenue / 100, 100) if revenue else 0
    review_score = (rating / 5) * 100 if rating else 0
    growth_score = round((seo_score * 0.3) + (lead_score * 0.2) + (revenue_score * 0.2) +
                         (review_score * 0.2) + (min(len(customers) * 10, 100) * 0.1))

    return {
        "growth_score": int(growth_score),
        "revenue": round(revenue, 2),
        "outstanding": round(outstanding, 2),
        "expenses": round(expenses, 2),
        "leads": len(open_leads),
        "customers": len(customers),
        "pipeline_value": round(pipeline_value, 2),
        "jobs": len(open_jobs),
        "seo_score": int(seo_score),
        "rating": rating,
        "review_count": review_count,
    }


@router.get("/dashboard/next-best-action")
async def next_best_action(business: CurrentBusiness):
    bid = business["business_id"]
    metrics = await dashboard_metrics(business)

    system = (
        "You are Venturelyx, a business growth co-pilot for small business owners. "
        "You speak in plain, encouraging English with zero jargon. "
        "Given a business snapshot, produce the top prioritized growth actions. "
        "Return ONLY valid JSON: an array of 4 objects with keys: "
        "title (short, owner-friendly), why (one sentence in plain English), "
        "impact (one of: High, Medium, Low), module (one of: ScaleSEO, Operate, Reviews, Grow)."
    )
    prompt = (
        f"Business: {business['name']} | Industry: {business.get('industry','n/a')} | "
        f"Service area: {business.get('service_area','n/a')}\n"
        f"Metrics snapshot: {metrics}\n"
        "Suggest the 4 highest-impact next actions this owner should take."
    )
    text, provider, model = await generate(
        db, bid, "next_best_action", system, prompt, tier="generation",
        preference=business.get("ai_provider_preference", "auto"),
    )
    actions = extract_json(text)
    if not isinstance(actions, list):
        actions = [{
            "title": "Run your first website SEO scan",
            "why": "See exactly what's stopping customers from finding you online.",
            "impact": "High", "module": "ScaleSEO",
        }]
    return {"actions": actions[:4], "generated_by": model, "provider": provider}
