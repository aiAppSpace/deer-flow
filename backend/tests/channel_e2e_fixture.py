"""Controlled external-channel boundary for the Vue real-Gateway channel e2e.

The production FastAPI app, auth/CSRF middleware, SQLAlchemy repository and
channel routes remain real. Only the external Slack/Telegram worker is replaced
with an in-process readiness fixture, and this router models the callback that
would consume a binding code and persist an external account. The runner mounts
it only when ``DEERFLOW_ENABLE_CHANNEL_TEST_SEED=1``.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from deerflow.persistence.channel_connections import ChannelConnectionRepository
from deerflow.persistence.engine import get_session_factory

router = APIRouter(prefix="/api/test-only/channels", tags=["test-only"])


class _ExternalChannelServiceFixture:
    def __init__(self) -> None:
        self.config: dict[str, dict[str, Any]] = {}
        self.running = True

    async def start(self, app_config: Any) -> None:
        extra = app_config.model_extra or {}
        raw = extra.get("channels")
        self.config = dict(raw) if isinstance(raw, dict) else {}

    async def stop(self) -> None:
        self.running = False

    async def ensure_channel_ready(self, provider: str, runtime_config: dict[str, Any]) -> bool:
        self.config[provider] = dict(runtime_config)
        return True

    async def configure_channel(self, provider: str, runtime_config: dict[str, Any]) -> bool:
        self.config[provider] = dict(runtime_config)
        return True

    async def remove_channel(self, provider: str) -> bool:
        self.config.pop(provider, None)
        return True

    def get_channel(self, name: str) -> None:
        """No external adapter exists in this readiness/callback fixture.

        Production notification delivery still starts and parks durable rows
        while the adapter is absent; claiming readiness is not proof of send.
        """
        return None

    def get_status(self) -> dict[str, Any]:
        return {
            "service_running": self.running,
            "channels": {
                provider: {
                    "enabled": bool(config.get("enabled", False)),
                    "running": bool(config.get("enabled", False)),
                }
                for provider, config in self.config.items()
            },
        }


_service = _ExternalChannelServiceFixture()


def install_channel_service_fixture() -> None:
    """Replace only the external worker singleton before Gateway lifespan."""
    import app.channels.service as service_module

    async def start_channel_service(app_config=None, **_kwargs):
        await _service.start(app_config)
        return _service

    async def stop_channel_service() -> None:
        await _service.stop()

    service_module.start_channel_service = start_channel_service
    service_module.stop_channel_service = stop_channel_service
    service_module.get_channel_service = lambda: _service


def _repository() -> ChannelConnectionRepository:
    session_factory = get_session_factory()
    if session_factory is None:
        raise HTTPException(status_code=503, detail="Channel connection persistence is not available")
    return ChannelConnectionRepository(session_factory)


def _current_user_id(request: Request) -> str:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(user.id)


class SeedConnectionBody(BaseModel):
    provider: str
    external_account_id: str
    external_account_name: str
    workspace_id: str = "e2e-workspace"
    workspace_name: str = "DeerFlow E2E"
    status: str = "connected"
    owner_user_id: str | None = None
    scopes: list[str] = Field(default_factory=list)


@router.post("/seed-connection")
async def seed_connection(body: SeedConnectionBody, request: Request) -> dict[str, Any]:
    row = await _repository().upsert_connection(
        owner_user_id=body.owner_user_id or _current_user_id(request),
        provider=body.provider,
        external_account_id=body.external_account_id,
        external_account_name=body.external_account_name,
        workspace_id=body.workspace_id,
        workspace_name=body.workspace_name,
        status=body.status,
        scopes=body.scopes,
        metadata={"fixture": "wp08-controlled-external-callback"},
    )
    return row


class CompleteConnectionBody(BaseModel):
    provider: str
    code: str
    external_account_id: str
    external_account_name: str
    workspace_id: str = "e2e-workspace"
    workspace_name: str = "DeerFlow E2E"


@router.post("/complete")
async def complete_connection(body: CompleteConnectionBody, request: Request) -> dict[str, Any]:
    # Require a real authenticated request even though ownership is recovered
    # from the one-time state, matching an external callback's trust boundary.
    _current_user_id(request)
    state = await _repository().consume_oauth_state(provider=body.provider, state=body.code)
    if state is None:
        raise HTTPException(status_code=404, detail="Channel connection code not found or expired")
    row = await _repository().upsert_connection(
        owner_user_id=str(state["owner_user_id"]),
        provider=body.provider,
        external_account_id=body.external_account_id,
        external_account_name=body.external_account_name,
        workspace_id=body.workspace_id,
        workspace_name=body.workspace_name,
        status="connected",
        scopes=list(state.get("requested_scopes") or []),
        metadata={"fixture": "wp08-controlled-external-callback"},
    )
    return row
