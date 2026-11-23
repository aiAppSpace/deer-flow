"""Interleave real callbacks at each read boundary, retaining account ownership."""

import asyncio

import pytest
from fastapi import HTTPException

from app.gateway.auth.local_provider import LocalAuthProvider
from app.gateway.auth.oidc import OIDCIdentity
from app.gateway.auth.repositories.sqlite import SQLiteUserRepository
from app.gateway.auth.user_provisioning import get_or_provision_oidc_user
from deerflow.config.auth_config import OIDCProviderConfig
from deerflow.persistence.engine import close_engine, get_session_factory, init_engine


@pytest.mark.asyncio
@pytest.mark.parametrize("boundary", ["get_user_by_oauth", "get_user_by_email"])
@pytest.mark.parametrize("winner_kind", ["same_identity", "other_subject", "other_provider", "local_password"])
async def test_oidc_callback_resolves_concurrent_owner_without_linking(tmp_path, monkeypatch, boundary, winner_kind):
    await init_engine("sqlite", url=f"sqlite+aiosqlite:///{tmp_path}/users.db", sqlite_dir=str(tmp_path))
    release = asyncio.Event()
    missed = asyncio.Event()
    pending = None
    try:
        repository = SQLiteUserRepository(get_session_factory())
        loser = LocalAuthProvider(repository)
        winner = LocalAuthProvider(repository)
        config = OIDCProviderConfig(display_name="Test SSO", issuer="https://issuer.example.com", client_id="deer-flow")
        identity = OIDCIdentity(provider="keycloak", subject="subject", email="User@Example.COM", email_verified=True, name="Test User", claims={})
        real_read = getattr(loser, boundary)
        snapshots = []

        async def pause_after_missing_read(*args):
            value = await real_read(*args)
            snapshots.append(value)
            if len(snapshots) == 1:
                assert value is None
                missed.set()
                await release.wait()
            return value

        monkeypatch.setattr(loser, boundary, pause_after_missing_read)
        pending = asyncio.create_task(get_or_provision_oidc_user("keycloak", config, identity, loser))
        await asyncio.wait_for(missed.wait(), timeout=5)
        if winner_kind == "local_password":
            owner = await winner.create_user(email=identity.email, password="fixture-password-123!", system_role="admin")
        else:
            provider_id = "other-provider" if winner_kind == "other_provider" else "keycloak"
            subject = "other-subject" if winner_kind == "other_subject" else "subject"
            winning_identity = OIDCIdentity(provider=provider_id, subject=subject, email=identity.email, email_verified=True, name="Test User", claims={})
            first = await get_or_provision_oidc_user(provider_id, config, winning_identity, winner)
            assert first["created"] is True
            owner = first["user"]
        persisted_before = (await winner.get_user(str(owner.id))).model_dump()
        release.set()
        if winner_kind == "same_identity":
            result = await pending
            assert result["created"] is False
            assert result["user"].id == owner.id
        else:
            with pytest.raises(HTTPException) as exc_info:
                await pending
            assert exc_info.value.status_code == 409
            assert await winner.get_user_by_oauth("keycloak", "subject") is None
        assert snapshots[0] is None
        assert await winner.count_users() == 1
        assert (await winner.get_user(str(owner.id))).model_dump() == persisted_before
    finally:
        release.set()
        if pending is not None:
            await asyncio.gather(pending, return_exceptions=True)
        await close_engine()
