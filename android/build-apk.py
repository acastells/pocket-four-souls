#!/usr/bin/env python3
"""Build and verify a sideload APK using JDK 17+ and Android SDK 35."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse
import zipfile


def run(*command):
    subprocess.run([str(part) for part in command], check=True)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tools", required=True, help="Android SDK Build Tools directory")
    parser.add_argument("--platform", required=True, help="Platform 35 android.jar")
    parser.add_argument("--java", default="java")
    parser.add_argument("--keystore", default="android/pocket-test.keystore")
    parser.add_argument("--output", default="mobile-output/four-souls-pocket.apk")
    parser.add_argument("--origin", default="https://pocket.invalid", help="HTTPS backend origin; default is offline solo only")
    return parser.parse_args()


def main():
    args = arguments()
    origin = urlparse(args.origin)
    if (origin.scheme != "https" or not origin.hostname
            or origin.path not in ("", "/") or origin.query
            or origin.fragment or origin.username or origin.password):
        raise ValueError("--origin must be an HTTPS origin without path or credentials")
    root = Path(__file__).resolve().parent.parent
    os.chdir(root)
    tools = Path(args.tools).resolve()
    platform = Path(args.platform).resolve()
    output = Path(args.output).resolve()
    key = Path(args.keystore).resolve()
    build = root / "android/build"
    build.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    os.environ["LD_LIBRARY_PATH"] = str(tools / "lib64") + os.pathsep + os.environ.get("LD_LIBRARY_PATH", "")

    run("node", "node_modules/vite/bin/vite.js", "build", "--config", "mobile/vite.native.config.ts")
    assets = build / "assets/web"
    shutil.rmtree(build / "assets", ignore_errors=True)
    shutil.copytree(root / "android/web", assets)
    shutil.copytree(root / "public/cards", assets / "cards")
    classes = build / "classes"
    shutil.rmtree(classes, ignore_errors=True)
    classes.mkdir()
    config = build / "ServerConfig.java"
    config.write_text("package com.foursouls.pocket; final class ServerConfig { static final String ORIGIN = "
                      + json.dumps(args.origin.rstrip("/")) + "; }", encoding="utf-8")
    run(args.java, "-m", "jdk.compiler/com.sun.tools.javac.Main", "-source", "8", "-target", "8",
        "-classpath", platform, "-d", classes, *sorted((root / "android/src").rglob("*.java")), config)
    jar = build / "classes.jar"
    with zipfile.ZipFile(jar, "w") as archive:
        for file in classes.rglob("*.class"):
            archive.write(file, file.relative_to(classes))
    run(args.java, "-cp", tools / "lib/d8.jar", "com.android.tools.r8.D8", "--min-api", "26",
        "--lib", platform, "--output", build, jar)
    unsigned = build / "unsigned.apk"
    aligned = build / "aligned.apk"
    run(tools / "aapt2", "link", "-o", unsigned, "--manifest", root / "android/AndroidManifest.xml",
        "-I", platform, "-A", build / "assets", "--auto-add-overlay")
    with zipfile.ZipFile(unsigned, "a", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build / "classes.dex", "classes.dex")
    run(tools / "zipalign", "-f", "4", unsigned, aligned)
    if not key.exists():
        key.parent.mkdir(parents=True, exist_ok=True)
        run(args.java, "sun.security.tools.keytool.Main", "-genkeypair", "-keystore", key,
            "-storepass", "android", "-keypass", "android", "-alias", "androiddebugkey",
            "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
            "-dname", "CN=Four Souls Pocket Test,O=Fan App,C=ES")
    run(args.java, "-jar", tools / "lib/apksigner.jar", "sign", "--ks", key,
        "--ks-pass", "pass:android", "--key-pass", "pass:android", "--v4-signing-enabled", "false",
        "--out", output, aligned)
    run(args.java, "-jar", tools / "lib/apksigner.jar", "verify", "--verbose", output)
    run(tools / "zipalign", "-c", "4", output)
    print("APK:", output)


if __name__ == "__main__":
    main()
