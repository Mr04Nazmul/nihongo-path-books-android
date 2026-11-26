import SwiftUI
import WebKit
import PencilKit

struct DrawingBoard: UIViewRepresentable {
    @Binding var samples: [[[Double]]]

    func makeCoordinator() -> Coordinator { Coordinator(samples: $samples) }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: UIColor.systemPink, width: 5)
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.accessibilityLabel = "কানজি লেখার বোর্ড"
        canvas.delegate = context.coordinator
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        context.coordinator.samples = $samples
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var samples: Binding<[[[Double]]]>

        init(samples: Binding<[[[Double]]]>) { self.samples = samples }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            let size = canvasView.bounds.size
            let side = min(size.width, size.height)
            guard side > 0 else { return }
            let origin = CGPoint(x: (size.width - side) / 2, y: (size.height - side) / 2)
            samples.wrappedValue = canvasView.drawing.strokes.map { stroke in
                let path = stroke.path
                let count = min(path.count, 72)
                return (0..<count).map { index in
                    let step = index * (path.count - 1) / max(1, count - 1)
                    let point = path[step].location.applying(stroke.transform)
                    return [Double((point.x - origin.x) / side), Double((point.y - origin.y) / side)]
                }
            }
        }
    }
}

private struct StrokeAssessment: Decodable {
    struct Count: Decodable { let actual: Int; let expected: Int }
    struct Stroke: Decodable { let shape: Double; let reversed: Bool; let otherStroke: Int? }
    let count: Count
    let strokes: [Stroke]?
}

struct StrokeView: View {
    @EnvironmentObject var store: StudyStore
    let character: String
    let level: String
    let protectedContent: Bool
    @State private var data: StrokeData?
    @State private var error: String?
    @State private var replay = UUID()
    @State private var board = UUID()
    @State private var samples: [[[Double]]] = []
    @State private var feedback: String?
    var body: some View {
        VStack {
            if let data { StrokeAnimation(paths: data.paths).id(replay).frame(height: 220); Button("আবার দেখুন") { replay = UUID() } }
            else if let error { Text(error).font(.footnote).foregroundStyle(.secondary) }
            else { ProgressView() }
            Text("KanjiVG · CC BY-SA 3.0").font(.caption2).foregroundStyle(.secondary)
            Text("লেখার অনুশীলন").font(.headline)
            DrawingBoard(samples: $samples).id(board)
                .frame(height: 280)
                .background(Color.pink.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            HStack {
                Button("লেখা যাচাই করুন") { assess() }.disabled(samples.isEmpty || data == nil)
                Spacer()
                Button("বোর্ড মুছুন", role: .destructive) {
                    samples = []
                    feedback = nil
                    board = UUID()
                }
            }
            if let feedback { Text(feedback).font(.footnote) }
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

    @MainActor private func assess() {
        guard let data, !protectedContent || store.hasAccess(level),
              let input = try? JSONSerialization.data(withJSONObject: ["actual": samples, "paths": data.paths]),
              let request = String(data: input, encoding: .utf8),
              let result = AdaptiveScript.call("handwritingFeedback", arguments: [request])?.toString(),
              let assessment = try? JSONDecoder().decode(StrokeAssessment.self, from: Data(result.utf8)) else {
            feedback = "লেখা যাচাই করা যায়নি।"
            return
        }
        guard assessment.count.actual == assessment.count.expected else {
            feedback = "স্ট্রোক \(assessment.count.actual) / \(assessment.count.expected)।"
            return
        }
        guard let strokes = assessment.strokes else {
            feedback = "প্রতিটি স্ট্রোক এক টানে আঁকুন।"
            return
        }
        if let index = strokes.firstIndex(where: { $0.reversed }) {
            feedback = "স্ট্রোক \(index + 1)-এর লেখার দিক আবার দেখুন।"
        } else if let index = strokes.firstIndex(where: { $0.otherStroke != nil }) {
            feedback = "স্ট্রোক \(index + 1)-এর লেখার ক্রম আবার দেখুন।"
        } else if let target = strokes.enumerated().max(by: { $0.element.shape < $1.element.shape }),
                  target.element.shape > 0.12 {
            feedback = "স্ট্রোক \(target.offset + 1)-এর আকৃতি আবার দেখুন।"
        } else {
            feedback = "স্ট্রোকের সংখ্যা, দিক ও আকৃতি মিলেছে।"
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
