from pathlib import Path


def add_mock_edge(source: str) -> str:
    anchor = r"data\/lessons-n[1-5]\.json|kanji\/"
    mock = r"mock\/n[1-5]\/(?:catalog|n[1-5]-practice-[0-9]{1,3})\.json|"
    if mock in source:
        return source
    if source.count(anchor) != 1:
        raise ValueError("Unexpected premium route")
    return source.replace(anchor, mock + anchor)


def apply_mock_overlay(root: Path):
    java = root / "app/src/main/java/online/devnazu/books"
    bridge = java / "MainActivity$openReader$4.java"
    source = bridge.read_text()
    anchor = "    @JavascriptInterface\n    public final String adaptiveHistory()"
    if source.count(anchor) != 1:
        raise ValueError("Unexpected adaptive bridge")
    if "public final boolean recordMockResult(" not in source:
        bridge.write_text(source.replace(anchor, '''    @JavascriptInterface
    public final boolean recordMockResult(String result) {
        return !this.$requestPreview && !adaptiveOwner.equals("guest") && adaptiveAllowed()
            && AdaptiveHistory.get(this.this$0).recordMock(adaptiveOwner, adaptiveLevel, result);
    }

    @JavascriptInterface
    public final String lastMockResult() {
        return !this.$requestPreview && !adaptiveOwner.equals("guest") && adaptiveAllowed()
            ? AdaptiveHistory.get(this.this$0).recentMock(adaptiveOwner, adaptiveLevel) : "";
    }

''' + anchor))
    interceptor = java / "MainActivity$openReader$5.java"
    source = interceptor.read_text()
    anchor = '        if (SourceCompat.startsWith(path2, "kanji/",'
    if 'boolean mockExam =' not in source:
        if source.count(anchor) != 1:
            raise ValueError("Unexpected native content interception")
        source = source.replace(anchor, '''        boolean mockPath = path2.startsWith("mock/");
        boolean mockExam = this.$level != null && this.$level.matches("N[1-5]")
            && path2.matches("mock/" + this.$level.toLowerCase(java.util.Locale.ROOT)
                + "/(catalog|" + this.$level.toLowerCase(java.util.Locale.ROOT)
                + "-practice-[0-9]{1,3})\\\\.json");
        if (mockPath && (!mockExam || this.$requestPreview || !"study.html".equals(this.$requestPage))) {
            return shouldInterceptRequest$denied(403);
        }
        if (mockExam || SourceCompat.startsWith(path2, "kanji/",''')
        level_guard = '            if (!Intrinsics.areEqual(Access.INSTANCE.contentLevel(path2), this.$level)) {'
        if source.count(level_guard) != 1:
            raise ValueError("Unexpected native content-level guard")
        source = source.replace(level_guard, level_guard.replace("if (!", "if (!mockExam && !"))
        interceptor.write_text(source)
    edge = root / "backend-snapshot/index.ts"
    edge.write_text(add_mock_edge(edge.read_text()))
