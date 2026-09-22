"""Compatibility entrypoint for the current R8.2 browser acceptance."""
from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).with_name("test_r8_2_flow.py")),
    run_name="__main__",
)
