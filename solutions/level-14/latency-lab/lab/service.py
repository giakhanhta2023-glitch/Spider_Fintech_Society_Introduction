"""A service with a fixed capacity, a slow tail, and switches for the things
level 14 teaches: a cache, a token bucket, and load shedding.

Capacity is modelled the way a real service has it: a fixed number of worker
slots. Everything past that queues, which is where p99 comes from.
"""
from __future__ import annotations

import asyncio
import ctypes
import random
import time
from dataclasses import dataclass, field

from fastapi import FastAPI, Response

try:                                    # Windows sleeps are 15.6 ms granular
    ctypes.windll.winmm.timeBeginPeriod(1)
except Exception:
    pass

app = FastAPI()


@dataclass
class Config:
    workers: int = 8
    fast_ms: float = 50.0
    slow_ms: float = 250.0
    slow_share: float = 0.10        # mean service time = 70 ms
    cache_hit_ratio: float = 0.0
    cache_ms: float = 1.0
    limit_rps: float | None = None   # token bucket
    burst: float = 50.0
    shed_queue: int | None = None    # refuse when this many are already waiting


@dataclass
class State:
    sem: asyncio.Semaphore = None
    waiting: int = 0
    tokens: float = 0.0
    last_refill: float = field(default_factory=time.perf_counter)
    ok: int = 0
    shed: int = 0
    limited: int = 0
    hits: int = 0


cfg = Config()
st = State()
rng = random.Random(14)


def reset() -> None:
    """A fresh State object, so work left running from a previous run keeps
    mutating the old one instead of corrupting this one's queue depth."""
    global st
    st = State()
    st.sem = asyncio.Semaphore(cfg.workers)
    st.tokens = cfg.burst
    st.last_refill = time.perf_counter()


@app.on_event("startup")
async def _startup() -> None:
    reset()


reset()          # also usable in process, with no startup event


@app.post("/config")
async def configure(body: dict) -> dict:
    for k, v in body.items():
        setattr(cfg, k, v)
    reset()
    return cfg.__dict__


@app.get("/stats")
async def stats() -> dict:
    return {"ok": st.ok, "shed": st.shed, "limited": st.limited,
            "hits": st.hits, "waiting": st.waiting}


def take_token() -> bool:
    now = time.perf_counter()
    st.tokens = min(cfg.burst, st.tokens + (now - st.last_refill) * cfg.limit_rps)
    st.last_refill = now
    if st.tokens >= 1.0:
        st.tokens -= 1.0
        return True
    return False


@app.get("/pay/{pid}")
async def pay(pid: int, response: Response):
    if cfg.limit_rps is not None and not take_token():
        st.limited += 1
        return Response(status_code=429)

    if cfg.shed_queue is not None and st.waiting >= cfg.shed_queue:
        st.shed += 1
        return Response(status_code=503)

    if cfg.cache_hit_ratio and rng.random() < cfg.cache_hit_ratio:
        st.hits += 1
        await asyncio.sleep(cfg.cache_ms / 1000)
        st.ok += 1
        return {"id": pid, "cached": True}

    # Counted here, synchronously: create_task does not run the coroutine
    # until the next loop turn, so a counter incremented inside it lags and
    # the shed check would read a stale queue depth.
    st.waiting += 1
    # A client giving up does NOT stop the server working, so the work is
    # shielded from the cancellation that a client side timeout causes.
    await asyncio.shield(asyncio.create_task(_work(st, st.sem)))
    return {"id": pid, "cached": False}


async def _work(state: State, sem: asyncio.Semaphore) -> None:
    left_queue = False
    try:
        async with sem:
            state.waiting -= 1
            left_queue = True
            ms = cfg.slow_ms if rng.random() < cfg.slow_share else cfg.fast_ms
            await asyncio.sleep(ms / 1000)
    finally:
        if not left_queue:
            state.waiting -= 1
    state.ok += 1
