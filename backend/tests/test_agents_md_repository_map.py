"""AGENTS.md 的 Repository Map 必须真的映射整个仓库。

那一节所属的文档在第 5 行写着「it **maps the whole repo**」——这是一句**显式的全集
声明**，所以「每个顶层目录必须表态」是它自己的判据，不是外加的洁癖。

wave 156 实测：四个**已跟踪**的顶层目录不在图里——`deploy/`（27 份 helm chart）、
`.github/`（21 份 CI 与模板）、`plans/`（1 份设计笔记，2026-07 落错了地方，家应该在
`docs/plans/`）、`pr-build/`（2 张 2026-04 的前后对比截图）。前两个是真内容，补进图里；
后两个连同 `.agent/` 在图下面那行里点名说明为什么不在图上。

**为什么这里加反向校验是对的，而 wave 105 判过「不该无差别补表」**：判据要跟着语气走。
`ROOT_MAKE_TARGETS` 那张表从不声称覆盖全集，给它加反向校验会把一堆正常情况打红；
这一节**自己声称了**，所以两边都得查。同一形状的先例是
`frontend-vue/scripts/standalone-check.mjs` 的 `SCAN_ROOTS ∪ EXCLUDED_ROOTS`。

扫描面用 `git ls-files`（已跟踪）而不是 `os.listdir`：本地的构建产物、缓存和别人的
临时目录不是"仓库的一部分"，把它们算进来只会逼出一张永远在变的豁免表。
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_MD = REPO_ROOT / "AGENTS.md"


def _map_section() -> str:
    text = AGENTS_MD.read_text(encoding="utf-8")
    start = text.index("## Repository Map")
    return text[start : text.index("Third-party extensions are loaded", start)]


def _mapped_top_level() -> set[str]:
    """图里那棵树上出现的顶层目录名。"""
    tree = _map_section()
    fence = tree.index("```")
    body = tree[fence : tree.index("```", fence + 3)]
    return set(re.findall(r"^[├└]──\s+(\.?[A-Za-z][A-Za-z0-9_.\-]*)/", body, re.M))


def _declared_off_map() -> set[str]:
    """图下面那行里点名「有意不在图上」的目录。"""
    return set(re.findall(r"`(\.?[A-Za-z][A-Za-z0-9_.\-]*)/`", _map_section().split("```")[-1]))


def _tracked_top_level() -> set[str]:
    listed = subprocess.run(["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    return {p.split("/")[0] for p in listed if "/" in p and p}


def test_the_three_sets_are_non_empty():
    """尺子先量自己：任何一个正则写坏都会让下面两条静默全绿。"""
    assert len(_mapped_top_level()) >= 10, _mapped_top_level()
    assert len(_declared_off_map()) >= 2, _declared_off_map()
    assert len(_tracked_top_level()) >= 10, _tracked_top_level()


def test_every_tracked_top_level_directory_is_accounted_for():
    """正向 + 反向：树 ∪ 「有意不在图上」恰好覆盖每个已跟踪的顶层目录。"""
    tracked = _tracked_top_level()
    accounted = _mapped_top_level() | _declared_off_map()
    missing = sorted(tracked - accounted)
    assert not missing, f"这些顶层目录既不在 Repository Map 里、也没在它下面那行点名：{missing}。AGENTS.md 说它 maps the whole repo——补进图里，或者在那行里说明为什么不在图上。"


def test_nothing_is_declared_off_map_that_no_longer_exists():
    """反向的反向：点名「不在图上」的目录必须真的还在，否则那句说明就是过期的。"""
    tracked = _tracked_top_level()
    stale = sorted(name for name in _declared_off_map() if name not in tracked)
    assert not stale, f"这些目录已经不在仓库里了，从那行说明里删掉：{stale}"


def test_every_path_named_in_the_tree_exists():
    """图里点名的路径都得存在——包括嵌在 backend/ 下面的那几行。"""
    tree = _map_section()
    fence = tree.index("```")
    body = tree[fence : tree.index("```", fence + 3)]
    missing = []
    prefix = ""
    for line in body.split("\n"):
        m = re.match(r"^([│\s]*)[├└]──\s+(\.?[A-Za-z][A-Za-z0-9_.\-/]*)/", line)
        if not m:
            continue
        indent, name = m.group(1), m.group(2)
        if len(indent) == 0:
            prefix = name + "/" if name in {"backend"} else ""
            candidate = name
        else:
            candidate = prefix + name
        if not (REPO_ROOT / candidate).exists():
            missing.append(candidate)
    assert not missing, f"Repository Map 点名了不存在的路径：{missing}"
