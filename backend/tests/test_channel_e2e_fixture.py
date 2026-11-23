"""The external-channel fixture must preserve real notification-worker admission."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from channel_e2e_fixture import _ExternalChannelServiceFixture
from fastapi import FastAPI


@pytest.mark.asyncio
async def test_controlled_channel_fixture_starts_real_outbox_worker_and_parks_without_an_adapter(tmp_path, monkeypatch):
    from app.gateway.app import _start_scheduled_task_notification_delivery
    from app.scheduler.notification_delivery import NotificationDeliveryWorker
    from app.scheduler.service import ScheduledTaskService
    from deerflow.persistence.channel_connections import ChannelConnectionRepository
    from deerflow.persistence.engine import close_engine, get_session_factory, init_engine
    from deerflow.persistence.notification_deliveries import NotificationDeliveryRepository, NotificationDeliveryRow
    from deerflow.persistence.scheduled_task_runs import ScheduledTaskRunRepository
    from deerflow.persistence.scheduled_tasks import ScheduledTaskRepository

    await init_engine("sqlite", url=f"sqlite+aiosqlite:///{tmp_path / 'channel-fixture.db'}", sqlite_dir=str(tmp_path))
    worker = None
    try:
        factory = get_session_factory()
        connections = ChannelConnectionRepository(factory)
        deliveries = NotificationDeliveryRepository(factory)
        service = _ExternalChannelServiceFixture()
        await service.start(SimpleNamespace(model_extra={"channels": {"slack": {"enabled": True}}}))
        monkeypatch.setattr("app.channels.service.get_channel_service", lambda: service)
        app = FastAPI()
        app.state.scheduled_task_service = ScheduledTaskService(
            task_repo=ScheduledTaskRepository(factory),
            task_run_repo=ScheduledTaskRunRepository(factory),
            launch_run=None,
            poll_interval_seconds=60,
            lease_seconds=30,
            max_concurrent_runs=1,
            connection_repo=connections,
            notification_repo=deliveries,
        )
        config = SimpleNamespace(scheduler=SimpleNamespace(poll_interval_seconds=60), channel_connections=SimpleNamespace(notification_locale="en-US"))

        # Exercise production startup with the actual worker and SQL repos.
        # The old fixture raised AttributeError here and detached the outbox.
        await _start_scheduled_task_notification_delivery(app, config, deliveries, connections)
        worker = app.state.notification_delivery_worker
        assert isinstance(worker, NotificationDeliveryWorker)
        assert worker._task is not None and not worker._task.done()
        assert service.get_channel("slack") is None
        assert service.get_channel(name="unknown-provider") is None
        await worker.stop()
        assert worker._task is None

        # Only WeCom currently supports proactive notification delivery. The
        # fixture's Slack/Telegram binding UI does not imply this capability.
        await connections.upsert_connection(owner_user_id="alice", provider="wecom", external_account_id="wecom-alice", external_account_name="Alice", status="connected")
        queued = await deliveries.enqueue(task_id="task-1", task_run_id="occurrence-1", event="run_completed", provider="wecom", target="wecom-alice", owner_user_id="alice")
        await worker.run_once(now=datetime.now(UTC))
        async with factory() as session:
            parked = await session.get(NotificationDeliveryRow, queued["id"])
            assert parked is not None
            assert parked.status == "pending"
            assert parked.attempts == 0
            assert parked.parked_attempts == 1
            assert parked.sent_at is None
            assert parked.last_error == "channel 'wecom' is not running"
        # A real future claim can recover the same row; no adapter was invented
        # and the controlled binding callback is not proof of an external send.
        reclaimed = await deliveries.claim_due_deliveries(now=datetime.now(UTC) + timedelta(minutes=16), limit=10)
        assert [row["id"] for row in reclaimed] == [queued["id"]]
        await worker.start()
        assert worker._task is not None and not worker._task.done()
        await worker.stop()
        assert worker._task is None
    finally:
        if worker is not None:
            await worker.stop()
        await close_engine()
