"""Run the worker as a subprocess with a hard timeout (kills the whole process group)."""
from __future__ import annotations

import asyncio
import json
import os
import signal
from dataclasses import dataclass
from typing import Awaitable, Callable

MAX_LINE = 1024 * 1024


@dataclass
class WorkerOutcome:
    ok: bool
    result: dict | None = None
    code: str = "server_error"
    backend: str = "worker"
    detail: str = ""


def _child_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    keep = ("PATH", "LANG", "LC_ALL", "HOME", "TMPDIR", "PYTHONPATH", "APP_ENV", "YTX_ALLOW_TEST_BACKEND", "VIRTUAL_ENV")
    env = {k: v for k, v in os.environ.items() if k in keep or k.startswith("YTX_")}
    env.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    if extra:
        env.update(extra)
    return env


async def run_worker(command: list[str], request: dict, timeout: float, cwd: str | None = None,
                     on_progress: Callable[[dict], Awaitable[None] | None] | None = None) -> WorkerOutcome:
    proc = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
        env=_child_env(),
        start_new_session=True,  # own process group → killpg reaches FFmpeg too
        limit=MAX_LINE,
    )
    assert proc.stdin and proc.stdout and proc.stderr
    proc.stdin.write(json.dumps(request).encode())
    await proc.stdin.drain()
    proc.stdin.close()

    final: dict | None = None

    async def read_stdout() -> None:
        nonlocal final
        assert proc.stdout
        while True:
            line = await proc.stdout.readline()
            if not line:
                return
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "progress" and on_progress:
                r = on_progress(msg)
                if asyncio.iscoroutine(r):
                    await r
            elif msg.get("type") in ("result", "error"):
                final = msg

    async def drain_stderr() -> bytes:
        assert proc.stderr
        data = await proc.stderr.read(64 * 1024)
        while await proc.stderr.read(64 * 1024):
            pass
        return data

    err_task = asyncio.create_task(drain_stderr())
    try:
        await asyncio.wait_for(asyncio.gather(read_stdout(), proc.wait()), timeout=timeout)
    except asyncio.TimeoutError:
        _kill(proc)
        await proc.wait()
        err_task.cancel()
        return WorkerOutcome(False, code="timeout", detail="worker timed out")
    except asyncio.CancelledError:
        _kill(proc)
        raise
    stderr = await err_task
    if final and final.get("type") == "result":
        return WorkerOutcome(True, result=final)
    if final and final.get("type") == "error":
        return WorkerOutcome(False, code=str(final.get("code") or "server_error"), backend=str(final.get("backend") or "worker"), detail=str(final.get("detail") or "")[:800])
    if proc.returncode and proc.returncode < 0 and -proc.returncode == signal.SIGXFSZ:
        return WorkerOutcome(False, code="too_large", detail="file size limit")
    return WorkerOutcome(False, code="server_error", detail=f"worker exited {proc.returncode}: {stderr[-400:].decode('utf-8', 'replace')}")


def _kill(proc: asyncio.subprocess.Process) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        try:
            proc.kill()
        except ProcessLookupError:
            pass
