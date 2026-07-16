from __future__ import annotations

import asyncio
import time
from collections.abc import Callable


class AsyncSlidingWindowRateLimiter:
    """Small per-process limiter for the authenticated on-demand HF endpoint."""

    def __init__(
        self,
        *,
        limit: int,
        window_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if limit < 1 or window_seconds <= 0:
            raise ValueError("Rate-limit configuration must be positive.")
        self._limit = int(limit)
        self._window_seconds = float(window_seconds)
        self._clock = clock
        self._events: dict[str, tuple[float, ...]] = {}
        self._lock = asyncio.Lock()

    async def allow(self, key: str) -> bool:
        now = self._clock()
        cutoff = now - self._window_seconds
        async with self._lock:
            current = {
                event_key: tuple(value for value in values if value > cutoff)
                for event_key, values in self._events.items()
                if any(value > cutoff for value in values)
            }
            recent = current.get(key, ())
            if len(recent) >= self._limit:
                self._events = current
                return False
            self._events = {**current, key: (*recent, now)}
            return True
