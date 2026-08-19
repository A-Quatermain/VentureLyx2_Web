"""Idempotent Stripe catalog setup for Venturelyx SaaS plans (digital, US, SMP)."""
import os
import stripe
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {"emergent_product_id": "growth_plan", "name": "Venturelyx Growth", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "growth_monthly", "amount": 4900, "currency": "usd", "interval": "month"}]},
    {"emergent_product_id": "managed_plan", "name": "Venturelyx Managed", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "managed_monthly", "amount": 14900, "currency": "usd", "interval": "month"}]},
    {"emergent_product_id": "dominate_plan", "name": "Venturelyx Dominate", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "dominate_monthly", "amount": 39900, "currency": "usd", "interval": "month"}]},
]


def ensure_tax_settings():
    s = stripe.tax.Settings.retrieve()
    if s.head_office and getattr(s.head_office, "address", None):
        return
    stripe.tax.Settings.modify(
        head_office={"address": {"country": "US", "line1": "123 Market St",
                                 "city": "San Francisco", "state": "CA", "postal_code": "94103"}},
        defaults={"tax_behavior": "exclusive"})


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(
        name=entry["name"], tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def main():
    try:
        ensure_tax_settings()
    except Exception as e:
        print("tax settings skip:", e)
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                kwargs = dict(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                              lookup_key=p["lookup_key"], transfer_lookup_key=True)
                if p.get("interval"):
                    kwargs["recurring"] = {"interval": p["interval"]}
                stripe.Price.create(**kwargs)
                print("created price", p["lookup_key"])
            else:
                print("price exists", p["lookup_key"])
    print("Stripe catalog ready.")


if __name__ == "__main__":
    main()
