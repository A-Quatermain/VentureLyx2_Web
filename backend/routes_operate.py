from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from deps import db, new_id, now_iso, CurrentBusiness

router = APIRouter(prefix="/api/operate", tags=["operate"])

STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"]


# ---------- Leads / Pipeline ----------
class LeadReq(BaseModel):
    name: str
    company: str = ""
    email: str = ""
    phone: str = ""
    value: float = 0
    stage: str = "new"
    notes: str = ""


class StageReq(BaseModel):
    stage: str


@router.get("/leads")
async def list_leads(business: CurrentBusiness):
    leads = await db.leads.find({"business_id": business["business_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"stages": STAGES, "leads": leads}


@router.post("/leads")
async def create_lead(req: LeadReq, business: CurrentBusiness):
    if req.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    doc = req.model_dump()
    doc.update({
        "lead_id": new_id("lead"),
        "business_id": business["business_id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.leads.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/leads/{lead_id}/stage")
async def move_lead(lead_id: str, req: StageReq, business: CurrentBusiness):
    if req.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    res = await db.leads.update_one(
        {"lead_id": lead_id, "business_id": business["business_id"]},
        {"$set": {"stage": req.stage, "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, business: CurrentBusiness):
    await db.leads.delete_one({"lead_id": lead_id, "business_id": business["business_id"]})
    return {"ok": True}


# ---------- Jobs ----------
class JobReq(BaseModel):
    title: str
    customer: str = ""
    scheduled_for: str = ""
    status: str = "scheduled"
    notes: str = ""


@router.get("/jobs")
async def list_jobs(business: CurrentBusiness):
    jobs = await db.jobs.find({"business_id": business["business_id"]}, {"_id": 0}).sort("scheduled_for", 1).to_list(2000)
    return {"jobs": jobs}


@router.post("/jobs")
async def create_job(req: JobReq, business: CurrentBusiness):
    doc = req.model_dump()
    doc.update({
        "job_id": new_id("job"),
        "business_id": business["business_id"],
        "created_at": now_iso(),
    })
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/jobs/{job_id}/status")
async def update_job(job_id: str, req: JobReq, business: CurrentBusiness):
    res = await db.jobs.update_one(
        {"job_id": job_id, "business_id": business["business_id"]},
        {"$set": {"status": req.status}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, business: CurrentBusiness):
    await db.jobs.delete_one({"job_id": job_id, "business_id": business["business_id"]})
    return {"ok": True}


# ---------- Invoices ----------
class InvoiceReq(BaseModel):
    customer: str
    description: str = ""
    amount: float
    status: str = "unpaid"  # unpaid | paid | overdue
    type: str = "invoice"  # invoice | expense
    due_date: str = ""


@router.get("/invoices")
async def list_invoices(business: CurrentBusiness):
    invoices = await db.invoices.find({"business_id": business["business_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"invoices": invoices}


@router.post("/invoices")
async def create_invoice(req: InvoiceReq, business: CurrentBusiness):
    doc = req.model_dump()
    doc.update({
        "invoice_id": new_id("inv"),
        "business_id": business["business_id"],
        "number": f"INV-{new_id('')[-6:].upper()}",
        "created_at": now_iso(),
    })
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/invoices/{invoice_id}/status")
async def update_invoice(invoice_id: str, req: dict, business: CurrentBusiness):
    status = req.get("status")
    if status not in ("unpaid", "paid", "overdue"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.invoices.update_one(
        {"invoice_id": invoice_id, "business_id": business["business_id"]},
        {"$set": {"status": status}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"ok": True}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, business: CurrentBusiness):
    await db.invoices.delete_one({"invoice_id": invoice_id, "business_id": business["business_id"]})
    return {"ok": True}
