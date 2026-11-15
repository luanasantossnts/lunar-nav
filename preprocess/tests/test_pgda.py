# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""Tests for the PGDA reference helpers (pure functions; no network)."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pgda_reference import bilinear, disc_mask, product_for, stats  # noqa: E402


def test_product_choice_finest_that_covers():
    assert product_for(-89.7) == ("85S_060M", 60)
    assert product_for(-84.78) == ("75S_120M", 120)
    assert product_for(-69.4) == ("65S_240M", 240)
    assert product_for(-30.0) == (None, None)


def test_stats_percentiles_ignore_nodata():
    s = stats(np.array([0.0, 0.25, 0.5, 0.75, 1.0, np.nan]))
    assert s["median"] == 0.5 and s["pixels"] == 5
    assert abs(s["p10"] - 0.1) < 1e-9 and abs(s["p90"] - 0.9) < 1e-9


def test_disc_mask_and_bilinear():
    m = disc_mask((5, 5), (2.0, 2.0), 1.0)
    assert m.sum() == 5  # centre + 4 neighbours
    grid = np.array([[0.0, 1.0], [2.0, 3.0]])
    assert bilinear(grid, (0.5, 0.5)) == 1.5
