from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class HttpMcpConfig:
    name: str
    module: str
    env_port: str
    default_port: int


SERVERS: tuple[HttpMcpConfig, ...] = (
    HttpMcpConfig(name="Power MCP", module="app_power:app", env_port="POWER_MCP_PORT", default_port=8001),
    HttpMcpConfig(name="Hydro MCP", module="app_hydro:app", env_port="HYDRO_MCP_PORT", default_port=8002),
    HttpMcpConfig(name="Sewage MCP", module="app_sewage:app", env_port="SEWAGE_MCP_PORT", default_port=8003),
)


def _resolve_port(config: HttpMcpConfig) -> int:
    raw = os.getenv(config.env_port, str(config.default_port)).strip()
    try:
        port = int(raw)
    except ValueError as exc:
        raise ValueError(f"Invalid port in {config.env_port}: {raw}") from exc

    if port < 1 or port > 65535:
        raise ValueError(f"Port out of range in {config.env_port}: {port}")

    return port


def _start_server(config: HttpMcpConfig, port: int) -> subprocess.Popen[str]:
    command = [
        sys.executable,
        "-m",
        "uvicorn",
        config.module,
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
    ]

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    return subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=None,
        stderr=None,
        text=True,
        creationflags=creationflags,
    )


def _terminate(process: subprocess.Popen[str], label: str) -> None:
    if process.poll() is not None:
        return

    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            process.send_signal(signal.SIGTERM)
    except Exception:
        process.terminate()

    print(f"[shutdown] terminating {label} (pid={process.pid})")


def _kill(process: subprocess.Popen[str], label: str) -> None:
    if process.poll() is None:
        process.kill()
        print(f"[shutdown] force-killed {label} (pid={process.pid})")


def main() -> int:
    print("Starting HTTP MCP servers for Archestra registration...")
    processes: dict[str, subprocess.Popen[str]] = {}

    for config in SERVERS:
        port = _resolve_port(config)
        process = _start_server(config, port)
        label = f"{config.name} on http://localhost:{port}/mcp"
        processes[label] = process
        print(f"[started] {label} (pid={process.pid})")

    print("All HTTP MCP servers are up. Press Ctrl+C to stop all.")

    try:
        while True:
            dead: list[tuple[str, int]] = []
            for label, process in processes.items():
                return_code = process.poll()
                if return_code is not None:
                    dead.append((label, return_code))

            for label, return_code in dead:
                print(f"[exit] {label} exited with code {return_code}")
                processes.pop(label, None)

            if not processes:
                print("No HTTP MCP processes are running. Exiting launcher.")
                return 1

            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nCtrl+C received. Shutting down HTTP MCP servers...")

    for label, process in processes.items():
        _terminate(process, label)

    deadline = time.time() + 8.0
    while time.time() < deadline and any(proc.poll() is None for proc in processes.values()):
        time.sleep(0.2)

    for label, process in processes.items():
        _kill(process, label)

    print("Shutdown complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
