"""Run Gradle integration tests against an owned temporary PostgreSQL cluster.

Never use an existing DB URL, service or production data. No third-party Python
dependency required. Generated credentials stay in child environment/ignored tmp.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-locks", action="store_true")
    parser.add_argument("--serve", action="store_true", help="Build and serve the API on loopback8080 with a disposable DB; not a test run")
    args = parser.parse_args()
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
    # Override, never reuse caller-supplied database credentials or URLs.
    env.update(AITRADING_DB_URL=f"jdbc:postgresql://127.0.0.1:{port}/postgres",
               AITRADING_DB_USER="prototype_test", AITRADING_DB_PASSWORD=secret,
               AITRADING_TEST_CLUSTER=str(data), AITRADING_TEST_PG_CTL=pg_ctl,
               AITRADING_TEST_DB_PORT=str(port))
    env.update(AITRADING_PYTHON_EXECUTABLE=sys.executable, AITRADING_PROJECT_ROOT=str(ROOT))
    start_attempted = False
    try:
        subprocess.run([initdb, "-D", str(data), "-U", "prototype_test", "--auth=scram-sha-256",
                        "--pwfile", str(password_file), "--encoding=UTF8", "--locale=C"], check=True)
        if os.name != "nt":
            # Debian packages default to /var/run/postgresql, which the CI runner
            # does not own. Keep sockets in this cluster's private directory too.
            socket_directory = str(owned).replace("'", "''")
            with (data / "postgresql.conf").open("a", encoding="utf-8") as config:
                config.write(f"\nunix_socket_directories = '{socket_directory}'\n")
        start_attempted = True
        try:
            subprocess.run([pg_ctl, "-D", str(data), "-l", str(owned / "postgres.log"),
                            "-o", f"-h 127.0.0.1 -p {port}", "-t", "30", "-w", "start"], check=True)
        except subprocess.CalledProcessError:
            # Fresh initdb startup only: no application SQL or credentials logged.
            startup_log = owned / "postgres.log"
            if startup_log.is_file():
                print(startup_log.read_text(encoding="utf-8", errors="replace")[-8000:], flush=True)
            raise
        wrapper = str(ROOT / "backend" / ("gradlew.bat" if os.name == "nt" else "gradlew"))
        command = [wrapper, "--no-daemon", "bootJar"] if args.serve else [wrapper, "--no-daemon", "clean", "test", "bootJar", "dependencyInventory"]
        if args.write_locks:
            command.append("--write-locks")
        result = subprocess.run(command, cwd=ROOT / "backend", env=env, check=False).returncode
        if result != 0 or not args.serve:
            return result
        return serve_owned_api(env, owned)
    finally:
        try:
            if start_attempted:
                stop_owned_cluster(pg_ctl, data)
        finally:
            password_file.unlink(missing_ok=True)
            # Retain ignored cluster/logs for diagnosis; never recursively delete user data.
            print(f"Owned test data retained at {owned}; credentials file removed", flush=True)


def stop_owned_cluster(pg_ctl: str, data: Path) -> None:
    """A failed start can leave a server alive. Never report PASS on failed cleanup."""
    status_command = [pg_ctl, "-D", str(data), "status"]
    status = subprocess.run(status_command, capture_output=True, timeout=15).returncode
    if status == 3:  # pg_ctl: cluster exists, server is not running
        return
    if status != 0:
        raise RuntimeError("Cannot establish owned test cluster status; inspect ignored test logs")
    subprocess.run([pg_ctl, "-D", str(data), "-m", "fast", "-t", "30", "-w", "stop"],
                   check=True, timeout=45)
    if subprocess.run(status_command, capture_output=True, timeout=15).returncode != 3:
        raise RuntimeError("Owned test database shutdown was not verified")


def serve_owned_api(env: dict[str, str], owned: Path) -> int:
    """Local browser-test mode; terminate only the child process created here."""
    env.update(AITRADING_BIND_ADDRESS="127.0.0.1", AITRADING_PORT="8080")
    java = str(Path(env["JAVA_HOME"]) / "bin" / ("java.exe" if os.name == "nt" else "java"))
    stop = owned / "stop-api"
    restart = owned / "restart-api"
    log_path = owned / "api.log"
    with log_path.open("w", encoding="utf-8") as log:
        def launch():
            return subprocess.Popen([java, "-jar", str(ROOT / "backend/build/libs/api-0.0.1-SNAPSHOT.jar")],
                                    env=env, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)

        def terminate(child):
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=10)

        app = launch()
        print(f"Browser-test API process {app.pid}; log {log_path}; create {stop} to stop or {restart} to restart API", flush=True)
        try:
            while app.poll() is None:
                if stop.exists():
                    return 0
                if restart.exists():
                    restart.unlink()
                    terminate(app)
                    app = launch()
                    print(f"Browser-test API restarted as process {app.pid}; same owned database", flush=True)
                time.sleep(0.25)
            return app.returncode
        finally:
            terminate(app)


if __name__ == "__main__":
    sys.exit(main())
