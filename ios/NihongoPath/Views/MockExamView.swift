import SwiftUI
import Combine

private struct ExamListing: Decodable, Identifiable {
    let id: String
    let title: String
    let count: Int

    func belongs(to level: String) -> Bool {
        StudyLevel.valid(level) && count > 0 &&
            id.range(of: "^" + level.lowercased() + "-practice-[0-9]{1,3}$", options: .regularExpression) != nil
    }
}

private enum ExamSection: String, Decodable, CaseIterable {
    case vocabulary, grammar, reading

    var title: String {
        switch self {
        case .vocabulary: return "Vocabulary ও Kanji"
        case .grammar: return "Grammar"
        case .reading: return "Reading"
        }
    }
}

private struct ExamQuestion: Decodable, Identifiable {
    let id: String
    let category: ExamSection
    let prompt: String
    let passage: String?
    let choices: [String]
    let answer: Int
    let explanation: String?

    var isValid: Bool {
        !id.isEmpty && !examText(prompt).isEmpty && choices.count >= 2 &&
            choices.allSatisfy { !examText($0).isEmpty } && choices.indices.contains(answer) &&
            (category != .reading || !examText(passage ?? "").isEmpty)
    }
}

private struct ExamPaper: Decodable {
    let id: String
    let title: String
    let level: String
    let kind: String
    let excluded: Int
    let questions: [ExamQuestion]

    func matches(_ listing: ExamListing, level: String) -> Bool {
        listing.belongs(to: level) && id == listing.id && self.level == level && kind == "JLPT" &&
            excluded == 0 && questions.count == listing.count &&
            Set(questions.map(\.id)).count == questions.count &&
            Set(questions.map(\.category)) == Set(ExamSection.allCases) &&
            questions.allSatisfy(\.isValid)
    }
}

private func decodeExamText(_ source: String) -> String {
    source.replacingOccurrences(of: "&nbsp;", with: " ")
        .replacingOccurrences(of: "&lt;", with: "<")
        .replacingOccurrences(of: "&gt;", with: ">")
        .replacingOccurrences(of: "&quot;", with: "\"")
        .replacingOccurrences(of: "&#39;", with: "'")
        .replacingOccurrences(of: "&amp;", with: "&")
}

private func examText(_ source: String) -> String {
    decodeExamText(source.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression))
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

private func formattedExamText(_ source: String) -> Text {
    let tagPattern = #"<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>"#
    guard let regex = try? NSRegularExpression(pattern: tagPattern) else { return Text(verbatim: examText(source)) }
    let tags = regex.matches(in: source, range: NSRange(source.startIndex..., in: source))
    var cursor = source.startIndex
    var openTags: [String] = []
    var output = Text(verbatim: "")

    func append(_ value: String) {
        guard !value.isEmpty else { return }
        var text = Text(verbatim: decodeExamText(value))
        if openTags.contains("u") { text = text.underline() }
        if openTags.contains("strong") || openTags.contains("b") { text = text.bold() }
        if openTags.contains("em") || openTags.contains("i") { text = text.italic() }
        if openTags.contains("rp") { return }
        output = output + text
    }

    for match in tags {
        guard let range = Range(match.range, in: source),
              let nameRange = Range(match.range(at: 2), in: source) else { continue }
        append(String(source[cursor..<range.lowerBound]))
        cursor = range.upperBound
        let name = source[nameRange].lowercased()
        let closing = match.range(at: 1).length > 0
        if closing, let index = openTags.lastIndex(of: name) { openTags.remove(at: index) }
        switch (name, closing) {
        case ("br", _), ("p", true), ("div", true), ("tr", true), ("li", true):
            append("\n")
        case ("td", true), ("th", true):
            append("   ")
        case ("rt", false):
            append("（")
        case ("rt", true):
            append("）")
        case ("u", false), ("b", false), ("strong", false), ("i", false), ("em", false), ("rp", false):
            openTags.append(name)
        default:
            break
        }
    }
    append(String(source[cursor...]))
    return output
}

@MainActor
struct MockExamView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var level = "N5"
    @State private var listings: [ExamListing] = []
    @State private var loadError: String?
    @State private var loading = false

    private var loadKey: String { level + "|" + store.token + "|" + String(store.hasAccess(level)) }

    var body: some View {
        List {
            Picker("JLPT level", selection: $level) {
                ForEach(StudyLevel.all, id: \.self) { Text($0).tag($0) }
            }.pickerStyle(.segmented)
            if !store.hasAccess(level) {
                Text("এই লেভেলের সক্রিয় access দিয়ে JLPT Mock Test খুলুন।")
            } else if loading {
                ProgressView()
            } else if let loadError {
                Text(loadError)
                Button("আবার চেষ্টা করুন") { Task { await load() } }
            } else if listings.isEmpty {
                Text("এই লেভেলে পরীক্ষার সেট পাওয়া যায়নি।")
            } else {
                ForEach(listings) { listing in
                    NavigationLink {
                        MockPaperView(listing: listing, level: level)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(listing.title)
                            Text("\(listing.count) প্রশ্ন").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("JLPT Mock Test")
        .task(id: loadKey) { await load() }
    }

    private func load() async {
        let key = loadKey
        let selected = level
        listings = []
        loadError = nil
        loading = store.hasAccess(selected)
        guard loading else { return }
        defer { if key == loadKey && !Task.isCancelled { loading = false } }
        do {
            let result: [ExamListing] = try await store.api.request(
                "/content/mock/\(selected.lowercased())/catalog.json", token: store.token)
            guard key == loadKey, !Task.isCancelled else { return }
            var seen = Set<String>()
            listings = result.filter { $0.belongs(to: selected) && seen.insert($0.id).inserted }
        } catch {
            guard key == loadKey, !Task.isCancelled else { return }
            loadError = error.localizedDescription
        }
    }
}

@MainActor
private struct MockPaperView: View {
    @EnvironmentObject private var store: StudyStore
    let listing: ExamListing
    let level: String
    @State private var paper: ExamPaper?
    @State private var loadError: String?
    @State private var deadline: TimeInterval?
    @State private var remaining = 0
    @State private var index = 0
    @State private var answers: [String: Int] = [:]
    @State private var finished = false
    @State private var confirmSubmit = false

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var duration: Int { ["N5": 60, "N4": 80, "N3": 100, "N2": 105, "N1": 110][level] ?? 60 }

    var body: some View {
        List {
            if let paper, store.hasAccess(level) {
                if finished {
                    result(paper)
                } else if deadline != nil {
                    question(paper)
                } else {
                    Text("\(listing.count) প্রশ্ন · \(duration) মিনিট")
                    Button("পরীক্ষা শুরু করুন") {
                        remaining = duration * 60
                        deadline = ProcessInfo.processInfo.systemUptime + Double(remaining)
                    }
                }
            } else if let loadError {
                Text(loadError)
                Button("আবার চেষ্টা করুন") { Task { await load() } }
            } else if store.hasAccess(level) {
                ProgressView()
            } else {
                Text("এই লেভেলের access শেষ হয়েছে।")
            }
        }
        .navigationTitle(listing.title)
        .task(id: store.token) { await load() }
        .onReceive(timer) { _ in
            if !store.hasAccess(level) { paper = nil }
            updateTime()
        }
        .confirmationDialog("পরীক্ষা জমা দেবেন?", isPresented: $confirmSubmit, titleVisibility: .visible) {
            Button("জমা দিন") { finished = true }
            Button("ফিরে যান", role: .cancel) {}
        }
    }

    private func load() async {
        let token = store.token
        paper = nil
        loadError = nil
        deadline = nil
        remaining = 0
        index = 0
        answers = [:]
        finished = false
        guard listing.belongs(to: level), store.hasAccess(level) else { return }
        do {
            let result: ExamPaper = try await store.api.request(
                "/content/mock/\(level.lowercased())/\(listing.id).json", token: token)
            guard !Task.isCancelled, store.token == token, store.hasAccess(level) else { return }
            guard result.matches(listing, level: level) else {
                throw APIError(status: 0, message: "পরীক্ষার প্রশ্ন যাচাই করা যায়নি।")
            }
            paper = result
        } catch {
            guard !Task.isCancelled, store.token == token else { return }
            loadError = error.localizedDescription
        }
    }

    private func updateTime() {
        guard let deadline, !finished else { return }
        remaining = max(0, Int(ceil(deadline - ProcessInfo.processInfo.systemUptime)))
        if remaining == 0 { finished = true }
    }

    @ViewBuilder private func question(_ paper: ExamPaper) -> some View {
        let question = paper.questions[index]
        Section {
            Text(String(format: "%02d:%02d", remaining / 60, remaining % 60)).monospacedDigit()
            Text("\(index + 1) / \(paper.questions.count) · \(question.category.title)")
            if let passage = question.passage { formattedExamText(passage) }
            formattedExamText(question.prompt).font(.headline)
        }
        Section {
            ForEach(question.choices.indices, id: \.self) { choice in
                Button {
                    updateTime()
                    if !finished { answers[question.id] = choice }
                } label: {
                    Label {
                        formattedExamText(question.choices[choice])
                    } icon: {
                        Image(systemName: answers[question.id] == choice ? "checkmark.circle.fill" : "circle")
                    }
                }
            }
        }
        Section {
            Button("আগের প্রশ্ন") { index -= 1 }.disabled(index == 0)
            Button("পরের প্রশ্ন") { index += 1 }.disabled(index == paper.questions.count - 1)
            Button("জমা দিন") { confirmSubmit = true }
        }
    }

    @ViewBuilder private func result(_ paper: ExamPaper) -> some View {
        Section("ফলাফল") {
            ForEach(ExamSection.allCases, id: \.self) { section in
                let questions = paper.questions.filter { $0.category == section }
                let correct = questions.filter { answers[$0.id] == $0.answer }.count
                let skipped = questions.filter { answers[$0.id] == nil }.count
                Text("\(section.title) · \(correct)/\(questions.count) সঠিক · \(skipped) বাদ")
            }
        }
        Section("উত্তর ও ব্যাখ্যা") {
            ForEach(paper.questions) { question in
                VStack(alignment: .leading, spacing: 6) {
                    formattedExamText(question.prompt).font(.headline)
                    if let selected = answers[question.id] {
                        Text("তোমার উত্তর · ") + formattedExamText(question.choices[selected])
                    } else {
                        Text("উত্তর দেওয়া হয়নি")
                    }
                    Text("সঠিক উত্তর · ") + formattedExamText(question.choices[question.answer])
                    if let explanation = question.explanation { formattedExamText(explanation) }
                }
            }
        }
    }
}
