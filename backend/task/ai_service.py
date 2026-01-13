# backend/task/ai_service.py

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional

# ------------------------------------------------------------
# OpenAI SDK compatibility
# - Supports BOTH:
#   1) old SDK:  openai.ChatCompletion.create(...)
#   2) new SDK:  from openai import OpenAI; client.chat.completions.create(...)
# ------------------------------------------------------------
try:
    from openai import OpenAI  # new SDK (openai>=1.x)
except Exception:
    OpenAI = None  # type: ignore

try:
    import openai  # old SDK (openai<1.x)
except Exception:
    openai = None  # type: ignore


class AIServiceError(Exception):
    pass


class AIServiceTimeoutError(AIServiceError):
    pass


class AIServiceInvalidResponseError(AIServiceError):
    pass


class AIService:
    """
    Provider-agnostic AI service.
    Feature flags (AI_ENABLED etc.) should be handled outside this class (router).
    """

    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.provider = os.getenv("AI_PROVIDER", "placeholder").strip().lower()

        # IMPORTANT: do NOT hardcode keys in code; read from env only
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

        self.logger = logging.getLogger("backend.ai")

        # new SDK client (if available)
        self._client = None
        if OpenAI and self.openai_key:
            try:
                self._client = OpenAI(api_key=self.openai_key)
            except Exception:
                self._client = None

    # ============================================================
    # Public API
    # ============================================================

    def generate_description(self, payload: Dict[str, Any]) -> str:
        """
        Generates a richer task description with acceptance criteria + implementation notes.
        """
        self._log_start("ai_description_started", payload)

        start = time.time()

        if self._should_use_openai():
            try:
                text = self._generate_openai(payload)
                self._log_success(start, "openai", "ai_description_succeeded")
                return text
            except AIServiceError:
                raise
            except Exception as exc:
                raise AIServiceError("AI provider failure") from exc

        text = self._generate_placeholder_description(payload)
        self._log_success(start, "placeholder", "ai_description_succeeded")
        return text

    def estimate_effort(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns dict:
          { story_points:int, confidence:float, rationale:str, method:str }
        """
        self._log_start("ai_estimate_started", payload)

        start = time.time()

        if self._should_use_openai():
            try:
                out = self._estimate_openai(payload)
                self._log_success(start, "openai", "ai_estimate_succeeded")
                return out
            except AIServiceError:
                raise
            except Exception as exc:
                raise AIServiceError("AI provider failure") from exc

        out = self._estimate_placeholder(payload)
        self._log_success(start, "placeholder", "ai_estimate_succeeded")
        return out

    def generate_project_summary(self, payload: Dict[str, Any]) -> str:
        """
        Generates a project summary from project fields + tasks list.
        Expected payload keys (recommended):
          - project_name, project_description, tech_stack, infrastructure
          - tasks: list[dict] or string
        """
        self._log_start("ai_project_summary_started", payload)

        start = time.time()

        if self._should_use_openai():
            try:
                text = self._project_summary_openai(payload)
                self._log_success(start, "openai", "ai_project_summary_succeeded")
                return text
            except AIServiceError:
                raise
            except Exception as exc:
                raise AIServiceError("AI provider failure") from exc

        text = self._project_summary_placeholder(payload)
        self._log_success(start, "placeholder", "ai_project_summary_succeeded")
        return text

    # ============================================================
    # Internal helpers
    # ============================================================

    def _should_use_openai(self) -> bool:
        # provider must be "openai" AND we must have a key AND at least one SDK available
        if self.provider != "openai":
            return False
        if not self.openai_key:
            return False
        return bool(self._client or openai)

    def _log_start(self, event: str, payload: Dict[str, Any]) -> None:
        self.logger.info(
            event,
            extra={
                "provider": self.provider,
                "has_title": bool(payload.get("title")),
                "has_project": bool(payload.get("project_name")),
            },
        )

    def _log_success(self, start: float, provider: str, event: str) -> None:
        elapsed = round(time.time() - start, 3)
        self.logger.info(event, extra={"provider": provider, "elapsed_seconds": elapsed})

    def _build_kv_prompt(self, payload: Dict[str, Any]) -> str:
        def _fmt(v: Any) -> str:
            if v is None:
                return ""
            if isinstance(v, (list, tuple)):
                return "\n".join([f"- {x}" for x in v])
            if isinstance(v, dict):
                return json.dumps(v, ensure_ascii=False)
            return str(v)

        lines = []
        for k, v in payload.items():
            if v is None:
                continue
            s = _fmt(v).strip()
            if not s:
                continue
            key = k.replace("_", " ").title()
            lines.append(f"{key}: {s}")
        return "\n".join(lines).strip()

    def _extract_text(self, response: Any) -> str:
        """
        Extract text from both SDK variants.
        """
        # new SDK object
        if hasattr(response, "choices"):
            try:
                content = response.choices[0].message.content
                return (content or "").strip()
            except Exception:
                pass

        # old SDK dict
        if isinstance(response, dict):
            try:
                content = response["choices"][0]["message"]["content"]
                return (content or "").strip()
            except Exception:
                pass

        return ""

    def _json_from_text(self, text: str) -> Dict[str, Any]:
        """
        Tries to parse JSON even if model wraps it in ```json ...```.
        """
        s = (text or "").strip()
        if not s:
            raise AIServiceInvalidResponseError("Empty AI response")

        # remove ```json fences if present
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)

        try:
            return json.loads(s)
        except Exception:
            # try to find first {...} block
            m = re.search(r"\{.*\}", s, flags=re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
            raise AIServiceInvalidResponseError("AI returned invalid JSON")

    # ============================================================
    # OpenAI implementations
    # ============================================================

    def _openai_chat(self, system_prompt: str, user_prompt: str, max_tokens: int) -> str:
        # Prefer new SDK if available
        if self._client:
            try:
                resp = self._client.chat.completions.create(
                    model=self.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    max_tokens=max_tokens,
                    timeout=self.timeout,  # new SDK supports timeout
                )
                text = self._extract_text(resp)
                if not text:
                    raise AIServiceInvalidResponseError("Empty response from OpenAI")
                return text
            except AIServiceInvalidResponseError:
                raise
            except Exception as exc:
                # timeout mapping (best-effort)
                if "timeout" in str(exc).lower():
                    raise AIServiceTimeoutError("OpenAI timeout") from exc
                raise AIServiceError("AI provider failure") from exc

        # Fallback to old SDK
        if openai:
            try:
                openai.api_key = self.openai_key
                resp = openai.ChatCompletion.create(
                    model=self.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    max_tokens=max_tokens,
                    request_timeout=self.timeout,
                )
                text = self._extract_text(resp)
                if not text:
                    raise AIServiceInvalidResponseError("Empty response from OpenAI")
                return text
            except AIServiceInvalidResponseError:
                raise
            except Exception as exc:
                # old SDK has openai.error.Timeout sometimes
                if openai and hasattr(openai, "error") and isinstance(
                    exc, getattr(openai.error, "Timeout", Exception)
                ):
                    raise AIServiceTimeoutError("OpenAI timeout") from exc
                if "timeout" in str(exc).lower():
                    raise AIServiceTimeoutError("OpenAI timeout") from exc
                raise AIServiceError("AI provider failure") from exc

        raise AIServiceError("OpenAI SDK is not installed")

    def _generate_openai(self, payload: Dict[str, Any]) -> str:
        system_prompt = (
            "You write helpful software task descriptions.\n"
            "Create a clear, structured task description that includes:\n"
            "1) Short summary\n"
            "2) Acceptance criteria (bullet list)\n"
            "3) Implementation notes (bullet list)\n"
            "Keep it concise but actionable."
        )
        user_prompt = self._build_kv_prompt(payload)
        return self._openai_chat(system_prompt, user_prompt, max_tokens=700)

    def _estimate_openai(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        system_prompt = (
            "You are an expert agile estimator.\n"
            "Estimate effort in Story Points using Fibonacci scale: 1,2,3,5,8,13,21.\n"
            "Return ONLY valid JSON with keys:\n"
            '  "story_points" (int), "confidence" (0..1), "rationale" (string)\n'
            "Rationale must be short (max 3 sentences)."
        )
        user_prompt = self._build_kv_prompt(payload)
        text = self._openai_chat(system_prompt, user_prompt, max_tokens=250)
        data = self._json_from_text(text)

        sp_raw = data.get("story_points")
        conf_raw = data.get("confidence", 0.6)
        rat_raw = data.get("rationale", "")

        try:
            sp = int(sp_raw)
        except Exception:
            sp = 3

        try:
            conf = float(conf_raw)
        except Exception:
            conf = 0.6

        rationale = str(rat_raw or "").strip() or "Estimated based on provided context."

        allowed = [1, 2, 3, 5, 8, 13, 21]
        if sp not in allowed:
            sp = min(allowed, key=lambda x: abs(x - sp))

        conf = max(0.0, min(1.0, conf))

        return {"story_points": sp, "confidence": conf, "rationale": rationale, "method": "openai"}

    def _project_summary_openai(self, payload: Dict[str, Any]) -> str:
        system_prompt = (
            "You are an assistant that summarizes software projects for a project dashboard.\n"
            "Write:\n"
            "- 2-4 sentence project overview\n"
            "- Key modules / components (bullets)\n"
            "- Current status / risks (bullets)\n"
            "- Next recommended steps (bullets)\n"
            "Use the provided project data and tasks."
        )
        user_prompt = self._build_kv_prompt(payload)
        return self._openai_chat(system_prompt, user_prompt, max_tokens=650)

    # ============================================================
    # Placeholder implementations
    # ============================================================

    def _generate_placeholder_description(self, payload: Dict[str, Any]) -> str:
        time.sleep(min(0.2, self.timeout))

        parts = [
            f"Detailed task: {payload.get('title')}",
            f"Summary: {payload.get('description')}",
            f"Project context: {payload.get('project_name')}",
            f"Tech stack: {payload.get('tech_stack')}",
        ]

        # add optional richer context if present
        for extra_key in ["priority", "complexity", "assignee", "tags", "infrastructure"]:
            if payload.get(extra_key):
                parts.append(f"{extra_key.replace('_', ' ').title()}: {payload.get(extra_key)}")

        parts += [
            "Acceptance criteria:\n- Clear and testable conditions",
            "Implementation notes:\n- Break down into small tasks\n- Add unit tests if applicable",
        ]

        content = "\n\n".join(p for p in parts if p and "None" not in str(p))
        if not content.strip():
            raise AIServiceInvalidResponseError("Placeholder returned empty text")
        return content

    def _estimate_placeholder(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Simple rule-based estimate
        title = (payload.get("title") or "").lower()
        desc = (payload.get("description") or "").lower()
        history = payload.get("history") or ""

        complexity_hits = 0
        for kw in [
            "auth",
            "login",
            "jwt",
            "database",
            "migration",
            "alembic",
            "api",
            "integration",
            "deployment",
            "docker",
        ]:
            if kw in title or kw in desc:
                complexity_hits += 1

        hist_len = len(str(history).splitlines())

        base = 2
        if complexity_hits == 1:
            base = 3
        elif complexity_hits == 2:
            base = 5
        elif complexity_hits >= 3:
            base = 8

        if hist_len > 80:
            base = min(13, base + 2)

        allowed = [1, 2, 3, 5, 8, 13, 21]
        sp = min(allowed, key=lambda x: abs(x - base))

        return {
            "story_points": sp,
            "confidence": 0.55,
            "rationale": "Rule-based estimate using keywords + project history size.",
            "method": "placeholder",
        }

    def _project_summary_placeholder(self, payload: Dict[str, Any]) -> str:
        time.sleep(min(0.2, self.timeout))

        project_name = payload.get("project_name") or "Project"
        desc = payload.get("project_description") or ""
        tech = payload.get("tech_stack") or ""
        infra = payload.get("infrastructure") or ""
        tasks = payload.get("tasks") or []

        if isinstance(tasks, str):
            tasks_text = tasks.strip()
        elif isinstance(tasks, list):
            # list of dicts or strings
            lines = []
            for t in tasks[:50]:
                if isinstance(t, dict):
                    lines.append(f"- {t.get('title', 'Task')} (status={t.get('status', '-')})")
                else:
                    lines.append(f"- {t}")
            tasks_text = "\n".join(lines)
        else:
            tasks_text = str(tasks)

        parts = [
            f"{project_name} — Summary",
            "",
            f"Overview: {desc or 'No description provided.'}",
            f"Tech stack: {tech or 'n/a'}",
            f"Infrastructure: {infra or 'n/a'}",
            "",
            "Tasks snapshot:",
            tasks_text or "- No tasks provided.",
            "",
            "Next steps:",
            "- Prioritize open tasks\n- Clarify acceptance criteria\n- Plan milestones",
        ]

        return "\n".join(parts).strip()