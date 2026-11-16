import SwiftUI
import WebKit
import PencilKit

struct DrawingBoard: UIViewRepresentable {
    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView(); canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: UIColor.systemPink, width: 5)
        canvas.backgroundColor = .clear; canvas.isOpaque = false
        canvas.accessibilityLabel = "কানজি লেখার বোর্ড"
        return canvas
    }
    func updateUIView(_ uiView: PKCanvasView, context: Context) {}
}
struct StrokeView: View {
    @EnvironmentObject var store: StudyStore
    let character: String
    let level: String
    let protectedContent: Bool
    @State private var data: StrokeData?
    @State private var error: String?
    @State private var replay = UUID()
    var body: some View {
        VStack {
            if let data { StrokeAnimation(paths: data.paths).id(replay); Button("আবার দেখুন") { replay = UUID() } }
            else if let error { Text(error).font(.footnote).foregroundStyle(.secondary) }
            else { ProgressView() }
            Text("KanjiVG · CC BY-SA 3.0").font(.caption2).foregroundStyle(.secondary)
        }.task(id: character) {
            guard character.unicodeScalars.count == 1, let scalar = character.unicodeScalars.first, StudyLevel.valid(level) else { error = "এই অক্ষরের stroke পাওয়া যায়নি।"; return }
            let code = String(format:"%05x", scalar.value)
            do {
                if let local: StrokeData = try? store.local("stroke-" + level.lowercased() + "-" + code) { data = local }
                else if protectedContent && store.hasAccess(level) {
                    data = try await store.api.request("/content/strokes/" + level.lowercased() + "/" + code + ".json", token: store.token)
                } else { error = "এই অক্ষরের stroke পাওয়া যায়নি।" }
            } catch { self.error = error.localizedDescription }
        }
    }
}
struct StrokeAnimation: UIViewRepresentable {
    let paths: [String]
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame:.zero,configuration:config); web.isOpaque = false; web.backgroundColor = .clear; web.scrollView.isScrollEnabled = false
        func escape(_ s: String) -> String { s.replacingOccurrences(of:"&",with:"&amp;").replacingOccurrences(of:"\"",with:"&quot;").replacingOccurrences(of:"<",with:"&lt;").replacingOccurrences(of:">",with:"&gt;") }
        let lines = paths.enumerated().map { i,path in "<path pathLength='1' d=\"\(escape(path))\" style='animation-delay:\(Double(i)*0.8)s'/>" }.joined()
        let html = """
        <!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><meta http-equiv='Content-Security-Policy' content="default-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0;display:grid;place-items:center;background:#fff5f8}svg{width:100%;height:220px}path{fill:none;stroke:#a2295a;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:draw .75s linear forwards}@keyframes draw{to{stroke-dashoffset:0}}@media(prefers-reduced-motion:reduce){path{animation:none;stroke-dashoffset:0}}</style></head><body><svg viewBox='0 0 109 109' role='img' aria-label='Kanji stroke order'>\(lines)</svg></body></html>
        """
        web.loadHTMLString(html, baseURL:nil); return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: ()) { uiView.stopLoading(); uiView.loadHTMLString("",baseURL:nil) }
}
