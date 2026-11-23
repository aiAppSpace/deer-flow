#!/usr/bin/env python3
"""Export the current core Gateway schema without operator config or plugins."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path


def export_schema(*, extension_fixture: bool = False) -> str:
    backend = Path(__file__).resolve().parents[2] / "backend"
    sys.path.insert(0, str(backend))
    plugins = "plugins: []\n"
    if extension_fixture:
        sys.path.insert(0, str(backend.parent / "examples" / "deerflow-extension-example"))
        plugins = "plugins:\n  - name: example\n    use: deerflow_extension_example:install\n    enabled: true\n    required: true\n"
    with tempfile.TemporaryDirectory(prefix="deerflow-openapi-") as directory:
        home = Path(directory)
        env_file = home / ".env"
        env_file.write_text("", encoding="utf-8")
        config = home / "config.yaml"
        config.write_text(
            "models: []\n" + plugins + "sandbox:\n  use: deerflow.sandbox.local:LocalSandboxProvider\nmemory:\n  enabled: false\n"
            "database:\n  backend: sqlite\n  sqlite_dir: " + str(home / "db") + "\n",
            encoding="utf-8",
        )
        extensions = home / "extensions_config.json"
        extensions.write_text('{"mcpServers": {}, "skills": {}}\n', encoding="utf-8")
        # No ambient credentials, conditional routers or operator plugin settings.
        retained = {key: value for key, value in os.environ.items() if key in {"PATH", "SYSTEMROOT", "LANG", "LC_ALL"}}
        os.environ.clear()
        os.environ.update(retained)
        os.environ.update(
            DEER_FLOW_ENV_FILE=str(env_file),
            DEER_FLOW_CONFIG_PATH=str(config),
            DEER_FLOW_EXTENSIONS_CONFIG_PATH=str(extensions),
            DEER_FLOW_PROJECT_ROOT=str(home),
            DEER_FLOW_HOME=str(home / "runtime"),
            DEER_FLOW_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS="1",
            GATEWAY_ENABLE_DOCS="true",
        )
        from app.gateway.app import app

        return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--check-extension-fixture", action="store_true", help="Verify the repository example router separately; never write it into the core snapshot.")
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1] / "baseline" / "openapi.snapshot.json"
    generated = export_schema(extension_fixture=args.check_extension_fixture)
    if args.check_extension_fixture:
        operation = json.loads(generated)["paths"].get("/api/extension-example/stats", {}).get("get")
        if not operation or "200" not in operation.get("responses", {}):
            print("The controlled example extension router is absent from OpenAPI.", file=sys.stderr)
            return 1
        print("Controlled example extension contribution appears in its isolated schema; core snapshot was not modified.")
        return 0
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != generated:
            print("OpenAPI snapshot differs from the current isolated core Gateway. Run make export-openapi, then make gen-api-types.", file=sys.stderr)
            return 1
        print("OpenAPI snapshot matches the current isolated core Gateway.")
    else:
        target.write_text(generated, encoding="utf-8")
        print(f"Updated {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
