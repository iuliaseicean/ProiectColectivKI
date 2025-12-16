import os
import time
import logging
from typing import Dict, Any

try:
    import openai
except ImportError:
    openai = None


class AIServiceError(Exception):
    pass


class AIServiceTimeoutError(AIServiceError):
    pass


class AIServiceInvalidResponseError(AIServiceError):
    pass


class AIService:
    """
    Provider-agnostic AI service.
    Feature flags are handled outside this class.
    """

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.provider = os.getenv("AI_PROVIDER", "placeholder").lower()
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.logger = logging.getLogger("backend.ai")

    def generate_description(self, payload: Dict[str, Any]) -> str:
        task_title = payload.get("title")
        project_name = payload.get("project_name")

        self.logger.info(
            "ai_request_started",
            extra={
                "provider": self.provider,
                "task_present": bool(task_title),
                "project_present": bool(project_name),
            },
        )

        start = time.time()

        if self.provider == "openai" and self.openai_key and openai:
            return self._generate_openai(payload, start)

        return self._generate_placeholder(payload, start)

    # -------------------------
    # Providers
    # -------------------------

    def _generate_openai(self, payload: Dict[str, Any], start: float) -> str:
        try:
            openai.api_key = self.openai_key

            system_prompt = (
                "Generate a clear task description with acceptance criteria "
                "and implementation notes based on the provided context."
            )

            user_prompt = "\n".join(
                f"{k.replace('_', ' ').title()}: {v}"
                for k, v in payload.items()
                if v
            )

            response = openai.ChatCompletion.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=800,
                request_timeout=self.timeout,
            )

            # safe extraction
            choices = response.get("choices") if isinstance(response, dict) else None
            if not choices:
                raise AIServiceInvalidResponseError("Empty OpenAI response")

            message = choices[0].get("message") if isinstance(choices[0], dict) else None
            content = message.get("content").strip() if message and message.get("content") else ""
            if not content:
                raise AIServiceInvalidResponseError("Empty response from OpenAI")

            self._log_success(start, "openai")
            return content

        except Exception as exc:
            # map common errors
            if openai and hasattr(openai, "error") and isinstance(exc, getattr(openai.error, "Timeout", Exception)):
                raise AIServiceTimeoutError("OpenAI timeout") from exc
            raise AIServiceError("AI provider failure") from exc

    def _generate_placeholder(self, payload: Dict[str, Any], start: float) -> str:
        time.sleep(min(0.2, self.timeout))

        parts = [
            f"Detailed task: {payload.get('title')}",
            f"Summary: {payload.get('description')}",
            f"Project context: {payload.get('project_name')}",
            f"Tech stack: {payload.get('tech_stack')}",
            "Acceptance criteria:\n- Clear and testable conditions",
            "Implementation notes:\n- Break down into small tasks",
        ]

        content = "\n\n".join(p for p in parts if p and "None" not in p)

        if not content.strip():
            raise AIServiceInvalidResponseError("Placeholder returned empty text")

        self._log_success(start, "placeholder")
        return content

    # -------------------------
    # Logging helpers
    # -------------------------

    def _log_success(self, start: float, provider: str) -> None:
        elapsed = round(time.time() - start, 3)
        self.logger.info(
            "ai_request_succeeded",
            extra={"provider": provider, "elapsed_seconds": elapsed},
        )
