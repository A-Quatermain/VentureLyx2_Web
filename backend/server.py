import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from deps import db
import routes_auth
import routes_business
import routes_operate
import routes_seo
import routes_reviews
import routes_payments

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("venturelyx")

app = FastAPI(title="Venturelyx API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "venturelyx"}


app.include_router(routes_auth.router)
app.include_router(routes_business.router)
app.include_router(routes_operate.router)
app.include_router(routes_seo.router)
app.include_router(routes_reviews.router)
app.include_router(routes_payments.router)


@app.on_event("shutdown")
async def shutdown():
    db.client.close() if hasattr(db, "client") else None
