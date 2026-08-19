"""Unified multi-model AI service layer (Claude + GPT) with routing + fallback."""
import os
import json
import logging
import re
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# tier -> provider -> (provider_id, model_id)
MODEL_MAP = {
    "claude": {
        "heavy": ("anthropic", "claude-sonnet-5"),
        "generation": ("anthropic", "claude-sonnet-4-6"),
        "light": ("anthropic", "claude-haiku-4-5-20251001"),
    },
    "gpt": {
        "heavy": ("openai", "gpt-5.6-terra"),
        "generation": ("openai", "gpt-5.6-luna"),
        "light": ("openai", "gpt-5.4-mini"),
    },
}

# Human-readable labels for the Settings model selector
MODEL_LABELS = {
    "claude": {
        "heavy": "Claude Sonnet 5",
        "generation": "Claude Sonnet 4.6",
        "light": "Claude Haiku 4.5",
    },
    "gpt": {
        "heavy": "GPT 5.6 Terra",
        "generation": "GPT 5.6 Luna",
        "light": "GPT 5.4 Mini",
    },
}


def _resolve_order(preference: str):
    """Return [primary, fallback] provider keys based on business preference."""
    pref = (preference or "auto").lower()
    if pref == "gpt":
        return ["gpt", "claude"]
    # 'claude' and 'auto' both default to claude-first
    return ["claude", "gpt"]


def _build_chat(provider_key: str, tier: str, session_id: str, system_message: str):
    provider_id, model_id = MODEL_MAP[provider_key][tier]
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider_id, model_id)
    return chat, provider_id, model_id


async def _log_usage(db, business_id, provider_id, model_id, tier, feature, chars):
    try:
        await db.ai_usage.insert_one({
            "business_id": business_id,
            "provider": provider_id,
            "model": model_id,
            "tier": tier,
            "feature": feature,
            "approx_tokens": int(chars / 4),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:  # never let logging break a request
        logger.warning(f"ai_usage log failed: {e}")


async def generate(db, business_id, feature, system_message, prompt, tier="generation",
                   preference="auto", session_id=None):
    """Non-streaming generation with cross-provider fallback. Returns (text, provider, model)."""
    session_id = session_id or f"{feature}_{business_id}"
    order = _resolve_order(preference)
    last_err = None
    for provider_key in order:
        try:
            chat, provider_id, model_id = _build_chat(provider_key, tier, session_id, system_message)
            resp = await chat.send_message(UserMessage(text=prompt))
            text = resp if isinstance(resp, str) else str(resp)
            await _log_usage(db, business_id, provider_id, model_id, tier, feature, len(text) + len(prompt))
            return text, provider_id, model_id
        except Exception as e:
            logger.warning(f"AI provider {provider_key} failed for {feature}: {e}")
            last_err = e
            continue
    raise RuntimeError(f"All AI providers failed: {last_err}")


async def stream_generate(db, business_id, feature, system_message, prompt, tier="generation",
                          preference="auto", session_id=None):
    """Async generator yielding text chunks, with fallback if primary errors before any output."""
    session_id = session_id or f"{feature}_{business_id}"
    order = _resolve_order(preference)
    last_err = None
    for idx, provider_key in enumerate(order):
        emitted = False
        collected = []
        try:
            chat, provider_id, model_id = _build_chat(provider_key, tier, session_id, system_message)
            async for event in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(event, TextDelta):
                    emitted = True
                    collected.append(event.content)
                    yield event.content
                elif isinstance(event, StreamDone):
                    break
            await _log_usage(db, business_id, provider_id, model_id, tier, feature,
                             len("".join(collected)) + len(prompt))
            return
        except Exception as e:
            logger.warning(f"AI stream provider {provider_key} failed for {feature}: {e}")
            last_err = e
            if emitted:
                # already streamed partial output; cannot cleanly fall back
                return
            continue
    yield f"\n[AI temporarily unavailable: {last_err}]"


def extract_json(text: str):
    """Best-effort JSON extraction from an LLM response."""
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None
