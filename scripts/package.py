"""Build a portable ZIP without changing shell policies or installing anything."""
from pathlib import Path
from shutil import copytree, rmtree
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
extension = root / "extension"
output = root / "dist"
output.mkdir(exist_ok=True)
portable = output / "cep" / "MotionGraphicsUserPresets"
if output.resolve() not in portable.resolve().parents:
    raise RuntimeError("Unsafe portable output path")
if portable.exists():
    rmtree(portable)
portable.parent.mkdir(exist_ok=True)
copytree(extension, portable)
archive = output / "MotionGraphics-AE2023-2026-v2.8.0-open-source.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for source in sorted(extension.rglob("*")):
        if source.is_file():
            bundle.write(source, Path("MotionGraphicsUserPresets") / source.relative_to(extension))
    for name in ("install.ps1", "README.md", "VERIFICATION.md", "ASSET_LIBRARY.md", "COMPOSITION_TOOLS.md", "COMPATIBILITY.md", "LICENSE", "OPEN_SOURCE.md"):
        bundle.write(root / name, name)
    for report_name in (
        "ae-ai-session-baseline.json", "ae-ai-session-regression.json", "ae-ai-smoke.json", "ai-app-server.json", "ae-layer-timing.json", "ae-marker-delete.json", "ae-inspector.json",
        "ae-jsx-engine.json", "ae-jsx-ui.json", "ae-marker-delete-undo.json",
        "ae-output-template-names.json", "ae-user-presets.json", "ae-expression-library.json", "ae-prerender-smoke.json", "ae-template-window.json", "ae-template-e2e.json", "ae-template-layered-psd.json", "ae-template-preview-fallback.json", "ae-template-display-time.json",
    ):
        report = root / "test-results" / report_name
        if report.exists():
            bundle.write(report, Path("verification") / report_name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None, "Corrupt ZIP entry"
    assert "MotionGraphicsUserPresets/CSXS/manifest.xml" in bundle.namelist()
print(f"Folder:  {portable}")
print(f"Package: {archive} ({archive.stat().st_size:,} bytes)")

source_archive = output / "MotionGraphics-v2.8.0-source.zip"
with ZipFile(source_archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for folder in ("extension", "scripts", "tests", "scriptui"):
        for source in sorted((root / folder).rglob("*")):
            if source.is_file() and not any(part in {"node_modules", ".git", "__pycache__", "secrets", ".wrangler"} for part in source.relative_to(root).parts):
                bundle.write(source, Path("MotionGraphics") / source.relative_to(root))
    for name in ("package.json", "package-lock.json", "install.ps1", "README.md", "VERIFICATION.md", "ASSET_LIBRARY.md", "COMPOSITION_TOOLS.md", "COMPATIBILITY.md", "LICENSE", "OPEN_SOURCE.md"):
        if (root / name).exists(): bundle.write(root / name, Path("MotionGraphics") / name)
with ZipFile(source_archive) as bundle:
    assert bundle.testzip() is None
print(f"Source: {source_archive}")
