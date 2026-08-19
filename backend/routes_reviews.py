from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from deps import db, new_id, now_iso, CurrentBusiness
from ai_service import stream_generate

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewReq(BaseModel):
    author: str
    rating: int
    text: str = ""
    source: str = "Google"


class RespondReq(BaseModel):
    review_id: str


class RequestReviewReq(BaseModel):
    customer_name: str
    customer_contact: str  # email or phone (record only in V1)


def _recompute_meta(reviews):
    if not reviews:
        return {"rating": 0, "count": 0}
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1)
    return {"rating": avg, "count": count}


@router.get("")
async def get_reviews(business: CurrentBusiness):
    bid = business["business_id"]
    reviews = await db.reviews.find({"business_id": bid}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    meta = _recompute_meta(reviews)

    # monthly trend (last 6 months buckets)
    trend = {}
    for r in reviews:
        month = (r.get("created_at") or "")[:7]
        trend.setdefault(month, []).append(r["rating"])
    trend_list = [{"month": m, "avg": round(sum(v) / len(v), 1), "count": len(v)}
                  for m, v in sorted(trend.items())][-6:]

    requests = await db.review_requests.find({"business_id": bid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"reviews": reviews, "meta": meta, "trend": trend_list, "requests": requests}


@router.post("")
async def add_review(req: ReviewReq, business: CurrentBusiness):
    if not 1 <= req.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    bid = business["business_id"]
    doc = req.model_dump()
    doc.update({"review_id": new_id("rev"), "business_id": bid,
                "ai_response": "", "created_at": now_iso()})
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)

    reviews = await db.reviews.find({"business_id": bid}, {"_id": 0}).to_list(1000)
    meta = _recompute_meta(reviews)
    await db.reviews_meta.update_one({"business_id": bid}, {"$set": {**meta, "business_id": bid}}, upsert=True)
    return doc


@router.post("/respond")
async def respond(req: RespondReq, business: CurrentBusiness):
    review = await db.reviews.find_one({"review_id": req.review_id, "business_id": business["business_id"]}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    tone = "warm and grateful" if review["rating"] >= 4 else "empathetic, apologetic and solution-oriented"
    system = (
        f"You are the owner of {business['name']}, a {business.get('industry','')} business. "
        f"Write a short, {tone}, professional public reply to a customer review. "
        "Sound human and personal, 2-4 sentences, never robotic. Do not use hashtags. "
        "Output only the reply text."
    )
    prompt = f"Customer {review['author']} left a {review['rating']}-star review: \"{review['text']}\"\nWrite the owner's reply."
    pref = business.get("ai_provider_preference", "auto")
    bid = business["business_id"]

    async def event_stream():
        collected = []
        async for chunk in stream_generate(db, bid, "review_response", system, prompt,
                                            tier="generation", preference=pref):
            collected.append(chunk)
            yield chunk
        # persist draft (owner approves before publish)
        await db.reviews.update_one(
            {"review_id": req.review_id, "business_id": bid},
            {"$set": {"ai_response_draft": "".join(collected)}},
        )

    return StreamingResponse(event_stream(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class ApproveReq(BaseModel):
    review_id: str
    response: str


@router.post("/approve")
async def approve(req: ApproveReq, business: CurrentBusiness):
    res = await db.reviews.update_one(
        {"review_id": req.review_id, "business_id": business["business_id"]},
        {"$set": {"ai_response": req.response, "responded_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"ok": True}


@router.post("/request")
async def request_review(req: RequestReviewReq, business: CurrentBusiness):
    doc = {
        "request_id": new_id("rr"),
        "business_id": business["business_id"],
        "customer_name": req.customer_name,
        "customer_contact": req.customer_contact,
        "status": "sent",
        "created_at": now_iso(),
    }
    await db.review_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc
