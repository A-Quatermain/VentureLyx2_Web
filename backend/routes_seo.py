import ipaddress
import socket
import time
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from deps import db, new_id, now_iso, CurrentBusiness
from ai_service import generate, stream_generate, extract_json

router = APIRouter(prefix="/api/seo", tags=["seo"])


def _is_private_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return True  # cannot resolve -> block
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            return True
    return False


def _normalize(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


class ScanReq(BaseModel):
    url: str


@router.post("/scan")
async def scan(req: ScanReq, business: CurrentBusiness):
    url = _normalize(req.url.strip())
    parsed = urlparse(url)
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL")
    if _is_private_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Scanning private or internal addresses is not allowed")

    issues = []
    checks = {}
    start = time.time()
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15,
                                     headers={"User-Agent": "VenturelyxBot/1.0"}) as ac:
            resp = await ac.get(url)
        elapsed = round((time.time() - start) * 1000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not reach site: {e}")

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # HTTPS
    checks["https"] = url.startswith("https://")
    if not checks["https"]:
        issues.append({"key": "https", "severity": "high", "title": "Your site isn't secure (no HTTPS)",
                       "detail": "Visitors and Google may flag your site as unsafe."})

    # Response time
    checks["response_time_ms"] = elapsed
    if elapsed > 2000:
        issues.append({"key": "speed", "severity": "high", "title": "Your site loads slowly",
                       "detail": f"It took {elapsed}ms to respond. Slow sites lose customers."})
    elif elapsed > 1000:
        issues.append({"key": "speed", "severity": "medium", "title": "Your site could load faster",
                       "detail": f"It took {elapsed}ms to respond."})

    # Title
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    checks["title"] = title
    if not title:
        issues.append({"key": "title", "severity": "high", "title": "Missing page title",
                       "detail": "Google shows your title in search results. Yours is empty."})
    elif len(title) > 65:
        issues.append({"key": "title", "severity": "low", "title": "Your page title is too long",
                       "detail": "Titles over 65 characters get cut off in Google."})

    # Meta description
    meta = soup.find("meta", attrs={"name": "description"})
    meta_desc = meta.get("content", "").strip() if meta else ""
    checks["meta_description"] = meta_desc
    if not meta_desc:
        issues.append({"key": "meta", "severity": "medium", "title": "Missing meta description",
                       "detail": "This is the summary customers see in Google. Yours is empty."})

    # H1
    h1s = soup.find_all("h1")
    checks["h1_count"] = len(h1s)
    if len(h1s) == 0:
        issues.append({"key": "h1", "severity": "medium", "title": "No main heading (H1) found",
                       "detail": "Search engines use your H1 to understand your page."})
    elif len(h1s) > 1:
        issues.append({"key": "h1", "severity": "low", "title": "Multiple H1 headings found",
                       "detail": f"You have {len(h1s)} H1 tags. One is best."})

    # Image alt
    imgs = soup.find_all("img")
    missing_alt = [i for i in imgs if not i.get("alt")]
    checks["images"] = len(imgs)
    checks["images_missing_alt"] = len(missing_alt)
    if missing_alt:
        issues.append({"key": "alt", "severity": "low",
                       "title": f"{len(missing_alt)} images missing descriptions",
                       "detail": "Alt text helps Google and screen readers understand images."})

    # Canonical
    canonical = soup.find("link", attrs={"rel": "canonical"})
    checks["canonical"] = bool(canonical)
    if not canonical:
        issues.append({"key": "canonical", "severity": "low", "title": "No canonical tag",
                       "detail": "This helps avoid duplicate-content confusion in Google."})

    # Broken links (sample internal + same-host)
    links = []
    base_host = parsed.netloc
    for a in soup.find_all("a", href=True)[:15]:
        href = urljoin(url, a["href"])
        p = urlparse(href)
        if p.scheme in ("http", "https") and p.netloc == base_host:
            links.append(href)
    broken = []
    async with httpx.AsyncClient(follow_redirects=True, timeout=8,
                                 headers={"User-Agent": "VenturelyxBot/1.0"}) as ac:
        for link in list(dict.fromkeys(links))[:8]:
            try:
                r = await ac.head(link)
                if r.status_code >= 400:
                    broken.append(link)
            except Exception:
                broken.append(link)
    checks["broken_links"] = len(broken)
    if broken:
        issues.append({"key": "broken", "severity": "medium",
                       "title": f"{len(broken)} broken link(s) found",
                       "detail": "Broken links frustrate customers and hurt rankings."})

    # Score
    score = 100
    weights = {"high": 20, "medium": 10, "low": 4}
    for iss in issues:
        score -= weights.get(iss["severity"], 5)
    score = max(0, score)

    audit = {
        "audit_id": new_id("audit"),
        "business_id": business["business_id"],
        "url": url,
        "score": score,
        "checks": checks,
        "issues": issues,
        "created_at": now_iso(),
    }
    await db.seo_audits.insert_one(audit)
    audit.pop("_id", None)
    return audit


@router.get("/audits")
async def audit_history(business: CurrentBusiness):
    audits = await db.seo_audits.find({"business_id": business["business_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"audits": audits}


@router.get("/audits/{audit_id}/recommendations")
async def recommendations(audit_id: str, business: CurrentBusiness):
    audit = await db.seo_audits.find_one({"audit_id": audit_id, "business_id": business["business_id"]}, {"_id": 0})
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    system = (
        "You are an expert SEO consultant who explains fixes to non-technical small business owners "
        "in plain, friendly English. For each issue, give a concrete recommendation. "
        "Return ONLY valid JSON: an array of objects with keys: title, recommendation (2-3 plain sentences), "
        "effort (Easy/Medium/Hard)."
    )
    prompt = (
        f"Business: {business['name']} ({business.get('industry','')}) in {business.get('service_area','')}.\n"
        f"Website: {audit['url']} | SEO score: {audit['score']}\n"
        f"Issues found: {audit['issues']}\n"
        "Give a prioritized recommendation to fix each issue."
    )
    text, provider, model = await generate(
        db, business["business_id"], "seo_recommendations", system, prompt,
        tier="generation", preference=business.get("ai_provider_preference", "auto"),
    )
    recs = extract_json(text)
    if not isinstance(recs, list):
        recs = [{"title": "Review your SEO issues", "recommendation": text[:500], "effort": "Medium"}]
    return {"recommendations": recs, "provider": provider, "model": model}


class GenPageReq(BaseModel):
    page_type: str = "service"  # service | local
    topic: str
    keywords: str = ""


@router.post("/generate-page")
async def generate_page(req: GenPageReq, business: CurrentBusiness):
    system = (
        "You are an expert SEO copywriter for local small businesses. Generate a complete, ready-to-publish "
        "web page in clean Markdown. Include: an SEO title, meta description, one H1, structured sections with H2s, "
        "persuasive owner-friendly copy, a short FAQ (3 Q&As), and a suggested JSON-LD schema block at the end. "
        "Write naturally, no fluff, optimized for the given keywords and service area."
    )
    prompt = (
        f"Business: {business['name']} | Industry: {business.get('industry','')} | "
        f"Service area: {business.get('service_area','')}\n"
        f"Page type: {req.page_type}\nTopic: {req.topic}\nTarget keywords: {req.keywords}\n"
        "Write the full page now."
    )
    pref = business.get("ai_provider_preference", "auto")
    bid = business["business_id"]

    async def event_stream():
        async for chunk in stream_generate(db, bid, "seo_page_generation", system, prompt,
                                            tier="generation", preference=pref):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Keywords & Competitors ----------
class KeywordReq(BaseModel):
    keyword: str
    rank: int = 0
    volume: int = 0


@router.get("/keywords")
async def list_keywords(business: CurrentBusiness):
    kws = await db.seo_keywords.find({"business_id": business["business_id"]}, {"_id": 0}).to_list(500)
    return {"keywords": kws}


@router.post("/keywords")
async def add_keyword(req: KeywordReq, business: CurrentBusiness):
    doc = req.model_dump()
    doc.update({"keyword_id": new_id("kw"), "business_id": business["business_id"], "created_at": now_iso()})
    await db.seo_keywords.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/keywords/{keyword_id}")
async def del_keyword(keyword_id: str, business: CurrentBusiness):
    await db.seo_keywords.delete_one({"keyword_id": keyword_id, "business_id": business["business_id"]})
    return {"ok": True}


class CompetitorReq(BaseModel):
    name: str
    website: str = ""


@router.get("/competitors")
async def list_competitors(business: CurrentBusiness):
    comps = await db.seo_competitors.find({"business_id": business["business_id"]}, {"_id": 0}).to_list(500)
    return {"competitors": comps}


@router.post("/competitors")
async def add_competitor(req: CompetitorReq, business: CurrentBusiness):
    doc = req.model_dump()
    doc.update({"competitor_id": new_id("comp"), "business_id": business["business_id"], "created_at": now_iso()})
    await db.seo_competitors.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/competitors/{competitor_id}")
async def del_competitor(competitor_id: str, business: CurrentBusiness):
    await db.seo_competitors.delete_one({"competitor_id": competitor_id, "business_id": business["business_id"]})
    return {"ok": True}
