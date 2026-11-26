import SwiftUI
import JavaScriptCore
import Combine

private struct PracticeItem: Encodable, Identifiable {
    let id: String
    let skill: String
    let kind: String
    let prompt: String
    let answer: String
    let reading: String
    let entry: StudyEntry
    let examAligned: Bool
    let difficulty = 0.0
    let guess = 0.25
    let slip = 0.05
    let seconds = 15
    let load = 1
    let accessible = true
}

private struct PracticeEvent: Codable {
    let id: String
    let at: Double
    let item: String
    let skill: String
    let correct: Bool
    let difficulty: Double
    let guess: Double
    let slip: Double
    let rating: Int
    let seconds: Double
}

private struct PracticeRequest: Encodable {
    let events: [PracticeEvent]
    let items: [PracticeItem]
    let level: String
    let preview: Bool
    let review: Bool
    let used: Set<String>
    let now: Double
    let remaining: Int
}

private struct PracticeQuestion {
    let item: PracticeItem
    let reading: Bool
    let choices: [String]

    var answer: String { reading ? item.reading : item.answer }
}

@MainActor
struct AdaptivePracticeView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var level = "N5"
    @State private var question: PracticeQuestion?
    @State private var selection: String?
    @State private var events: [PracticeEvent] = []
    @State private var items: [PracticeItem] = []
    @State private var seen: Set<String> = []
    @State private var context: JSContext?
    @State private var review = false
    @State private var preview = true
    @State private var owner = ""
    @State private var remaining = 300
    @State private var started = 0.0
    @State private var sessionMessage = ""
    @State private var loading = false

    private let timer = Timer.publish(every: 2, on: .main, in: .common).autoconnect()
    private var canShow: Bool { preview || (store.hasAccess(level) && store.snapshot?.user.id == owner) }
    private var historyKey: String { "ios.adaptive." + owner }

    var body: some View {
        List {
            Picker("JLPT level", selection: $level) {
                ForEach(StudyLevel.all, id: \.self) { Text($0).tag($0) }
            }.pickerStyle(.segmented)
            Button("Daily Smart Study") { Task { await start(review: false) } }.disabled(loading)
            Button("Smart Review") { Task { await start(review: true) } }.disabled(loading)
            if loading { ProgressView() }
            if !sessionMessage.isEmpty { Text(sessionMessage) }
            if canShow, let question {
                Section {
                    if question.reading { Text("読み方 · Reading") }
                    Text(question.item.prompt).font(.title2)
                    ForEach(question.choices, id: \.self) { choice in
                        Button(choice) { answer(choice, question: question) }.disabled(selection != nil)
                    }
                    if let selection {
                        Text(selection == question.answer ? "সঠিক" : "সঠিক উত্তর · " + question.answer)
                        Button("পরেরটি") { advance() }
                    }
                }
            }
        }
        .navigationTitle("Smart Study")
        .onChange(of: level) { _ in clear() }
        .onChange(of: store.token) { _ in clear() }
        .onReceive(timer) { _ in if !canShow { clear() } }
    }

    private func clear() {
        question = nil
        selection = nil
        items = []
        events = []
        seen = []
        sessionMessage = ""
    }

    private func start(review: Bool) async {
        guard !loading else { return }
        clear()
        loading = true
        defer { loading = false }
        let selectedLevel = level
        let token = store.token
        let full = store.hasAccess(selectedLevel)
        let account = store.snapshot?.user.id ?? "guest"
        do {
            var lessons: [(Subject, [StudyEntry])] = []
            for subject in Subject.allCases {
                let entries: [StudyEntry]
                if full {
                    entries = try await store.fetchEntries(level: selectedLevel, subject: subject)
                } else {
                    entries = try store.preview(level: selectedLevel, subject: subject)
                }
                lessons.append((subject, entries))
            }
            guard !Task.isCancelled, level == selectedLevel, store.token == token,
                  !full || store.hasAccess(selectedLevel) else { return }
            owner = account
            preview = !full
            self.review = review
            remaining = 300
            items = lessons.flatMap { subject, entries in
                let usable = entries.filter { !$0.title.isEmpty && !$0.translation.isEmpty }
                let readings = Set(usable.map(\.pronunciation))
                guard Set(usable.map(\.translation)).count >= 4 else { return [PracticeItem]() }
                return usable.map { entry in
                    let identifier = selectedLevel + ":" + (full ? "full" : "preview") + ":" + subject.rawValue + ":" + entry.id
                    return PracticeItem(id: identifier, skill: identifier, kind: subject.rawValue,
                        prompt: entry.title, answer: entry.translation, reading: entry.pronunciation,
                        entry: entry, examAligned: entry.pronunciation != entry.title && readings.count >= 4)
                }
            }
            if let history = UserDefaults.standard.data(forKey: historyKey) {
                events = try JSONDecoder().decode([PracticeEvent].self, from: history)
            }
            if context == nil {
                guard let path = Bundle.main.url(forResource: "AdaptiveEngine", withExtension: "js"),
                      let js = JSContext() else {
                    sessionMessage = "Smart Study চালু করা যায়নি।"
                    return
                }
                js.evaluateScript(try String(contentsOf: path, encoding: .utf8))
                context = js
            }
            advance()
        } catch {
            sessionMessage = error.localizedDescription
        }
    }

    private func advance() {
        question = nil
        selection = nil
        guard canShow else { clear(); return }
        guard let engine = context?.objectForKeyedSubscript("NihongoPractice"),
              let request = try? JSONEncoder().encode(PracticeRequest(events: events, items: items,
                  level: level, preview: preview, review: review, used: seen,
                  now: Date().timeIntervalSince1970 * 1000, remaining: remaining)),
              let input = String(data: request, encoding: .utf8),
              let result = engine.invokeMethod("selectPractice", withArguments: [input]),
              !result.isUndefined else {
            sessionMessage = "অনুশীলনের হিসাব এই মুহূর্তে পাওয়া যাচ্ছে না।"
            return
        }
        guard !result.isNull, let identifier = result.toString() else {
            sessionMessage = review ? "এখন কোনো রিভিউ বাকি নেই।" : "এই অনুশীলন সেশন শেষ।"
            return
        }
        let reading = identifier.hasSuffix(":reading")
        let id = reading ? String(identifier.dropLast(":reading".count)) : identifier
        guard let item = items.first(where: { $0.id == id }) else { return }
        let correct = reading ? item.reading : item.answer
        let others = Set(items.filter { $0.kind == item.kind }.map { reading ? $0.reading : $0.answer })
            .subtracting([correct])
        let choices = (Array(others.shuffled().prefix(3)) + [correct]).shuffled()
        started = ProcessInfo.processInfo.systemUptime
        question = PracticeQuestion(item: item, reading: reading, choices: choices)
        sessionMessage = ""
    }

    private func answer(_ choice: String, question: PracticeQuestion) {
        guard selection == nil, canShow else { return }
        let seconds = max(1, ProcessInfo.processInfo.systemUptime - started)
        let correct = choice == question.answer
        let item = question.item
        let event = PracticeEvent(id: UUID().uuidString,
            at: Date().timeIntervalSince1970 * 1000, item: item.id, skill: item.skill,
            correct: correct, difficulty: question.reading ? 0.2 : item.difficulty,
            guess: 1 / Double(question.choices.count), slip: item.slip, rating: correct ? 3 : 1,
            seconds: seconds)
        let updated = Array((events + [event]).suffix(3000))
        guard let encoded = try? JSONEncoder().encode(updated) else { return }
        UserDefaults.standard.set(encoded, forKey: historyKey)
        events = updated
        seen.insert(item.id)
        remaining -= Int(seconds.rounded(.up))
        selection = choice
    }
}
