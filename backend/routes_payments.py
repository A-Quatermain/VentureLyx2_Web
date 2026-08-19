import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from deps import db, CurrentBusiness

router = APIRouter(tags=["payments"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Venturelyx plans (digital SaaS) surfaced to the UI
PLANS = [
    {"lookup_key": "growth_monthly", "name": "Growth", "price": 49,
     "tagline": "For owners getting found & winning leads",
     "features": ["Command Center", "Full ScaleSEO scanner", "AI recommendations", "Reviews + AI replies"]},
    {"lookup_key": "managed_monthly", "name": "Managed", "price": 149,
     "tagline": "We run growth for you",
     "features": ["Everything in Growth", "AI page generation", "Priority AI models", "Competitor tracking"]},
    {"lookup_key": "dominate_monthly", "name": "Dominate", "price": 399,
     "tagline": "Own your market",
     "features": ["Everything in Managed", "Heaviest reasoning models", "Unlimited AI generations", "Early access AI Team"]},
]


class CheckoutRequest(BaseModel):
    lookup_key: str
    origin_url: str


@router.get("/api/payments/plans")
async def plans():
    return {"plans": PLANS}


@router.post("/api/payments/checkout")
async def create_checkout(req: CheckoutRequest, business: CurrentBusiness):
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=500, detail=f"Price not found: {req.lookup_key}")
    price = prices[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata={"business_id": business["business_id"], "lookup_key": req.lookup_key},
    )
    # US + digital SaaS -> Stripe managed payments (full tax handling)
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")
        else:
            raise
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "business_id": business["business_id"],
        "lookup_key": req.lookup_key,
        "amount": (price.unit_amount or 0) / 100,
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/api/payments/status/{session_id}")
async def get_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "updated_at": datetime.now(timezone.utc).isoformat()}})
                # upgrade the business plan
                if record.get("business_id"):
                    plan_name = record.get("lookup_key", "").replace("_monthly", "")
                    await db.businesses.update_one(
                        {"business_id": record["business_id"]},
                        {"$set": {"plan": plan_name}})
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"]}


@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "updated_at": datetime.now(timezone.utc).isoformat()}})
        rec = await db.payment_transactions.find_one({"session_id": obj["id"]}, {"_id": 0})
        if rec and rec.get("business_id"):
            plan_name = rec.get("lookup_key", "").replace("_monthly", "")
            await db.businesses.update_one({"business_id": rec["business_id"]}, {"$set": {"plan": plan_name}})
    return {"status": "ok"}
