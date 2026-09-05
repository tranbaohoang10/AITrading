"""Run isolated integration tests or one owned browser-test API on loopback.

The --serve mode is deliberately a small lifecycle manager: it never reuses an
arbitrary service or database, and it never terminates an unverified process.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DEV_DIR = ROOT / "tmp" / "dev"
BACKEND_STATE = DEV_DIR / "backend.json"
API_PORT = 8080
API_URL = f"http://127.0.0.1:{API_PORT}"


def postgres_bin() -> Path:
    configured = os.environ.get("AITRADING_TEST_PG_BIN")
    if configured:
        candidate = Path(configured).resolve()
    elif os.name == "nt":
        candidate = Path("C:/Program Files/PostgreSQL/17/bin")
    else:
        executable = shutil.which("pg_config")
        if not executable:
            raise RuntimeError("Install PostgreSQL binaries or set AITRADING_TEST_PG_BIN")
        candidate = Path(subprocess.check_output([executable, "--bindir"], text=True).strip())
    if not (candidate / ("initdb.exe" if os.name == "nt" else "initdb")).is_file():
        raise RuntimeError("PostgreSQL initdb was not found at configured path")
    return candidate


def process_alive(pid: int) -> bool:
    if not isinstance(pid, int) or pid < 1:
        return False
    if os.name == "nt":
        result = subprocess.run(["tasklist.exe", "/FI", f"PID eq {pid}", "/NH"], capture_output=True,
                                text=True, timeout=5)
        return result.returncode == 0 and str(pid) in result.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def process_command(pid: int) -> str:
    try:
        if os.name == "nt":
            command = ("Get-CimInstance Win32_Process -Filter \"ProcessId=" + str(pid)
                       + "\" | Select-Object -ExpandProperty CommandLine")
            return subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                                  capture_output=True, text=True, timeout=5).stdout.strip()
        return subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True,
                              timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def command_belongs_to_repo(command: str) -> bool:
    root = str(ROOT).replace("\\", "/").lower()
    return root in command.replace("\\", "/").lower() and "api-0.0.1-snapshot.jar" in command.lower()


def listening_pid(port: int) -> int | None:
    """Return a listener PID when the platform exposes it; None may be unknown."""
    try:
        if os.name == "nt":
            output = subprocess.run(["netstat.exe", "-ano", "-p", "tcp"], capture_output=True, text=True,
                                    timeout=5).stdout
            pattern = re.compile(rf"^\s*TCP\s+\S+:{port}\s+\S+\s+LISTENING\s+(\d+)\s*$", re.I)
            for line in output.splitlines():
                matched = pattern.match(line)
                if matched:
                    return int(matched.group(1))
        else:
            output = subprocess.run(["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"], capture_output=True,
                                    text=True, timeout=5).stdout.strip()
            if output:
                return int(output.splitlines()[0])
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    return None


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def read_backend_state() -> dict[str, object] | None:
    try:
        state = json.loads(BACKEND_STATE.read_text(encoding="utf-8"))
        if not isinstance(state, dict) or not isinstance(state.get("pid"), int) or state.get("port") != API_PORT:
            return None
        if not isinstance(state.get("repoRoot"), str) or not isinstance(state.get("ownedClusterPath"), str):
            return None
        return state
    except (OSError, json.JSONDecodeError):
        return None


def write_backend_state(pid: int, owned: Path) -> None:
    DEV_DIR.mkdir(parents=True, exist_ok=True)
    state = {
        "pid": pid,
        "port": API_PORT,
        "repoRoot": str(ROOT),
        "ownedClusterPath": str(owned),
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    temporary = BACKEND_STATE.with_suffix(f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps(state) + "\n", encoding="utf-8")
    temporary.replace(BACKEND_STATE)


def remove_backend_state(expected_pid: int | None = None) -> None:
    state = read_backend_state()
    if state is None or expected_pid is None or state["pid"] == expected_pid:
        BACKEND_STATE.unlink(missing_ok=True)


def state_is_for_this_repo(state: dict[str, object]) -> bool:
    try:
        return Path(str(state["repoRoot"])).resolve() == ROOT.resolve()
    except OSError:
        return False


def owned_api(pid: int) -> tuple[bool, str]:
    if not process_alive(pid):
        return False, ""
    command = process_command(pid)
    return command_belongs_to_repo(command), command


def api_health(timeout: float = 1.0) -> bool:
    try:
        with urlopen(f"{API_URL}/api/health", timeout=timeout) as response:
            return 200 <= response.status < 300
    except (OSError, URLError):
        return False


def existing_serve() -> tuple[str, int | None, str]:
    """Classify port/state without creating a database or touching a process."""
    state = read_backend_state()
    if state is not None and not state_is_for_this_repo(state):
        return "unsafe-state", int(state["pid"]), "state belongs to another repository"
    listener = listening_pid(API_PORT)
    occupied = listener is not None or not port_is_free(API_PORT)
    if listener is not None:
        owned, command = owned_api(listener)
        if owned:
            return "owned", listener, command
        return "unrelated", listener, command
    if occupied:
        return "unrelated", None, "listener command unavailable"
    if state is not None:
        pid = int(state["pid"])
        if not process_alive(pid):
            remove_backend_state(pid)
        else:
            owned, command = owned_api(pid)
            if owned:
                return "starting", pid, command
            return "unsafe-state", pid, command
    return "free", None, ""


def report_existing_serve() -> int:
    kind, pid, command = existing_serve()
    if kind == "free":
        return 1
    if kind in {"owned", "starting"}:
        health = "READY" if api_health() else "STARTING"
        print("AITrading browser-test API is already running", flush=True)
        print(API_URL, flush=True)
        print(f"PID: {pid}", flush=True)
        print(f"Health: {health}", flush=True)
        return 0
    if kind == "unrelated":
        label = command or "unknown process command"
        raise RuntimeError(f"Port {API_PORT} is occupied by PID {pid if pid is not None else 'unknown'}\n"
                           f"Process: {label}\nStop that process or choose an explicit developer action.")
    raise RuntimeError("Backend state belongs to another repository; refusing to overwrite or terminate it.")


def status() -> int:
    kind, pid, _ = existing_serve()
    if kind == "free":
        print(f"Backend: STOPPED\n{API_URL}", flush=True)
        return 0
    if kind in {"owned", "starting"}:
        print(f"Backend: RUNNING\n{API_URL}\nPID: {pid}\nOwned by AITrading: yes\n"
              f"Health: {'READY' if api_health() else 'NOT READY'}", flush=True)
        return 0
    print(f"Backend: RUNNING\n{API_URL}\nPID: {pid if pid is not None else 'unknown'}\n"
          "Owned by AITrading: no", flush=True)
    return 2


def wait_for_ready(app: subprocess.Popen[bytes], log_path: Path, timeout_seconds: float = 45) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if app.poll() is not None:
            print(f"Browser-test API exited with code {app.returncode}; inspect {log_path}", flush=True)
            return False
        if api_health():
            return True
        time.sleep(0.25)
    print(f"Browser-test API did not become healthy within {timeout_seconds} seconds; inspect {log_path}", flush=True)
    return False


def terminate_api(app: subprocess.Popen[bytes]) -> None:
    if app.poll() is None:
        app.terminate()
        try:
            app.wait(timeout=15)
        except subprocess.TimeoutExpired:
            app.kill()
            app.wait(timeout=10)


def serve_owned_api(env: dict[str, str], owned: Path) -> int:
    """Serve one child, record non-secret ownership metadata, and wait for health."""
    env.update(AITRADING_BIND_ADDRESS="127.0.0.1", AITRADING_PORT=str(API_PORT))
    java = str(Path(env["JAVA_HOME"]) / "bin" / ("java.exe" if os.name == "nt" else "java"))
    stop = owned / "stop-api"
    restart = owned / "restart-api"
    log_path = owned / "api.log"
    with log_path.open("w", encoding="utf-8") as log:
        def launch() -> subprocess.Popen[bytes]:
            child = subprocess.Popen([java, "-jar", str(ROOT / "backend/build/libs/api-0.0.1-SNAPSHOT.jar")],
                                     env=env, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                     creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            write_backend_state(child.pid, owned)
            return child

        app = launch()
        try:
            if not wait_for_ready(app, log_path):
                return app.returncode if app.returncode is not None else 1
            print("AITrading browser-test API READY", flush=True)
            print(API_URL, flush=True)
            print("Database: disposable browser-test database", flush=True)
            print(f"PID: {app.pid}; log: {log_path}", flush=True)
            while app.poll() is None:
                if stop.exists():
                    print("Stopping AITrading browser-test API...", flush=True)
                    return 0
                if restart.exists():
                    restart.unlink(missing_ok=True)
                    terminate_api(app)
                    app = launch()
                    if not wait_for_ready(app, log_path):
                        return app.returncode if app.returncode is not None else 1
                    print(f"AITrading browser-test API READY after restart (PID: {app.pid})", flush=True)
                time.sleep(0.25)
            print(f"Browser-test API exited with code {app.returncode}; inspect {log_path}", flush=True)
            return app.returncode
        except KeyboardInterrupt:
            print("Stopping AITrading browser-test API...", flush=True)
            return 130
        finally:
            terminate_api(app)
            remove_backend_state(app.pid)


def stop_owned_cluster(pg_ctl: str, data: Path) -> None:
    """Stop only the PostgreSQL cluster created under this repository's tmp directory."""
    tmp_root = (ROOT / "tmp").resolve()
    if not data.resolve().is_relative_to(tmp_root):
        raise RuntimeError("Refusing to stop a database outside project tmp")
    status_command = [pg_ctl, "-D", str(data), "status"]
    status = subprocess.run(status_command, capture_output=True, timeout=15).returncode
    if status == 3:
        return
    if status != 0:
        raise RuntimeError("Cannot establish owned test cluster status; inspect ignored test logs")
    subprocess.run([pg_ctl, "-D", str(data), "-m", "fast", "-t", "30", "-w", "stop"],
                   check=True, timeout=45)
    if subprocess.run(status_command, capture_output=True, timeout=15).returncode != 3:
        raise RuntimeError("Owned test database shutdown was not verified")


def cleanup_cluster(pg_ctl: str, data: Path, password_file: Path, started: bool) -> None:
    """Ignore a second Ctrl+C during bounded owned cleanup."""
    previous = signal.signal(signal.SIGINT, signal.SIG_IGN)
    try:
        if started:
            print("Stopping owned PostgreSQL...", flush=True)
            stop_owned_cluster(pg_ctl, data)
        password_file.unlink(missing_ok=True)
        print("Cleanup complete.", flush=True)
    finally:
        signal.signal(signal.SIGINT, previous)


def run(args: argparse.Namespace) -> int:
    if args.status:
        return status()
    if args.serve and report_existing_serve() == 0:
        return 0
    binaries = postgres_bin()
    task_tmp = ROOT / "tmp"
    task_tmp.mkdir(exist_ok=True)
    owned = Path(tempfile.mkdtemp(prefix="pg-test-", dir=task_tmp)).resolve()
    if not owned.is_relative_to(task_tmp.resolve()):
        raise RuntimeError("Test cluster is outside project tmp")
    data = owned / "data"
    password_file = owned / "password"
    secret = secrets.token_urlsafe(36)
    password_file.write_text(secret, encoding="utf-8")
    if os.name != "nt":
        password_file.chmod(0o600)
    suffix = ".exe" if os.name == "nt" else ""
    initdb, pg_ctl = str(binaries / ("initdb" + suffix)), str(binaries / ("pg_ctl" + suffix))
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    env = os.environ.copy()
    if not args.serve:
        env.update(AITRADING_AI_ENABLED="false", AITRADING_AI_PROVIDER="gemini", AITRADING_AI_MODEL="")
        env.pop("GEMINI_API_KEY", None)
        env.pop("OPENAI_API_KEY", None)
    env.update(AITRADING_DB_URL=f"jdbc:postgresql://127.0.0.1:{port}/postgres",
               AITRADING_DB_USER="prototype_test", AITRADING_DB_PASSWORD=secret,
               AITRADING_TEST_CLUSTER=str(data), AITRADING_TEST_PG_CTL=pg_ctl,
               AITRADING_TEST_DB_PORT=str(port), AITRADING_PYTHON_EXECUTABLE=sys.executable,
               AITRADING_PROJECT_ROOT=str(ROOT))
    started = False
    try:
        subprocess.run([initdb, "-D", str(data), "-U", "prototype_test", "--auth=scram-sha-256",
                        "--pwfile", str(password_file), "--encoding=UTF8", "--locale=C"], check=True)
        if os.name != "nt":
            socket_directory = str(owned).replace("'", "''")
            with (data / "postgresql.conf").open("a", encoding="utf-8") as config:
                config.write(f"\nunix_socket_directories = '{socket_directory}'\n")
        started = True
        subprocess.run([pg_ctl, "-D", str(data), "-l", str(owned / "postgres.log"),
                        "-o", f"-h 127.0.0.1 -p {port}", "-t", "30", "-w", "start"], check=True)
        if args.serve:
            print("Disposable browser-test database created. Accounts from previous disposable serve sessions do not persist.",
                  flush=True)
        wrapper = str(ROOT / "backend" / ("gradlew.bat" if os.name == "nt" else "gradlew"))
        if args.serve:
            command = [wrapper, "--no-daemon", "bootJar"]
        elif args.tests:
            command = [wrapper, "--no-daemon", "test", "--tests", args.tests]
        else:
            command = [wrapper, "--no-daemon", "clean", "test", "bootJar", "dependencyInventory"]
        if args.write_locks:
            command.append("--write-locks")
        result = subprocess.run(command, cwd=ROOT / "backend", env=env, check=False).returncode
        if result != 0 or not args.serve:
            return result
        return serve_owned_api(env, owned)
    finally:
        cleanup_cluster(pg_ctl, data, password_file, started)
        print(f"Owned test data retained at {owned}; credentials file removed", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-locks", action="store_true")
    parser.add_argument("--serve", action="store_true", help="Build and serve the API on loopback 8080 with a disposable DB")
    parser.add_argument("--status", action="store_true", help="Show safe local browser-test API status without starting it")
    parser.add_argument("--tests", help="Run one Gradle test selector against an isolated disposable database")
    args = parser.parse_args()
    if sum(bool(value) for value in (args.serve, args.status, args.tests)) > 1:
        parser.error("--serve, --status and --tests cannot be combined")
    try:
        return run(args)
    except KeyboardInterrupt:
        print("Stopping AITrading browser-test API...", flush=True)
        return 130
    except RuntimeError as error:
        print(error, flush=True)
        return 2


if __name__ == "__main__":
    sys.exit(main())
