from __future__ import annotations

import asyncio

from app.core.rate_limit import AsyncSlidingWindowRateLimiter


def test_rate_limiter_is_per_identity_and_recovers_after_window():
    now = [0.0]
    limiter = AsyncSlidingWindowRateLimiter(
        limit=2,
        window_seconds=60,
        clock=lambda: now[0],
    )

    async def exercise():
        assert await limiter.allow("staff-a") is True
        assert await limiter.allow("staff-a") is True
        assert await limiter.allow("staff-a") is False
        assert await limiter.allow("staff-b") is True

        now[0] = 61.0
        assert await limiter.allow("staff-a") is True

    asyncio.run(exercise())
