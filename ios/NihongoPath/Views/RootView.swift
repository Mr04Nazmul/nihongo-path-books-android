import SwiftUI

struct RootView: View {
    @EnvironmentObject var store: StudyStore
    var body: some View {
        TabView {
            NavigationStack { HomeView() }.tabItem { Label("হোম", systemImage: "house") }
            NavigationStack { LibraryView() }.tabItem { Label("বই", systemImage: "books.vertical") }
            NavigationStack { StudyList(subject: .kanji) }.tabItem { Label("কানজি", systemImage: "pencil.tip.crop.circle") }
            NavigationStack { AccountView() }.tabItem { Label("প্রোফাইল", systemImage: "person.crop.circle") }
        }
    }
}
struct HomeView: View {
    @EnvironmentObject var store: StudyStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image("BrandLogo").resizable().scaledToFit().frame(width: 38, height: 38)
                    Text("Nihongo Path Books").font(.system(size: 18, weight: .semibold, design: .serif))
                }
                Text("こんにちは！").font(.system(size: 25, weight: .semibold, design: .serif))
                Text("চলুন, জাপানি শেখার পথে এগিয়ে যাই")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
                Image("AndroidHomeHero").resizable()
                    .frame(maxWidth: .infinity).frame(height: 101)
                    .clipShape(RoundedRectangle(cornerRadius: 15))
                    .accessibilityHidden(true)
                HStack {
                    Label("শেখা হয়েছে", systemImage: "chart.line.uptrend.xyaxis")
                    Spacer()
                    Text(store.learned.count, format: .number).monospacedDigit()
                }.font(.system(size: 13, weight: .semibold)).padding(12).modifier(HomePaper())
                HStack(spacing: 8) {
                    homeTile("বইঘর", note: "JLPT বইসমূহ", art: "AndroidHomeBooks") { LibraryView() }
                    homeTile("বুকমার্ক", note: "সংরক্ষিত পাঠ", art: "AndroidHomeBookmark") {
                        StudyList(subject: .vocab, onlySaved: true)
                    }
                }
                HStack(spacing: 8) {
                    homeTile("পড়ার পছন্দ", note: "বিষয় বেছে পড়ুন", art: "AndroidHomeReading") { LibraryView() }
                    homeTile("ক্রেডিট সেন্টার", note: "রিওয়ার্ড ও অ্যাক্সেস", art: "AndroidHomeCredit") { CreditCenterView() }
                }
                Text("কানার দ্রুত অনুশীলন").font(.system(size: 12, weight: .semibold))
                    .frame(maxWidth: .infinity).padding(.top, 6)
                HStack(spacing: 6) {
                    kanaTile("あ", title: "হিরাগানা", ranges: [0x3041...0x3096])
                    kanaTile("ア", title: "কাতাকানা", ranges: [0x30A1...0x30FA])
                    kanaTile("１２", title: "সংখ্যা", ranges: [0xFF10...0xFF19])
                }
                NavigationLink { MockExamView() } label: { Label("JLPT Mock Test", systemImage: "checklist") }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading).modifier(HomePaper())
                NavigationLink { AdaptivePracticeView() } label: { Label("Smart Study", systemImage: "brain.head.profile") }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading).modifier(HomePaper())
            }.padding(14)
        }.background(Color.pink.opacity(0.035)).toolbar(.hidden, for: .navigationBar)
    }

    private func homeTile<Destination: View>(_ title: String, note: String, art: String,
                                              @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) {
            HStack(spacing: 5) {
                Image(art).resizable().scaledToFit().frame(width: 42, height: 48).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 12, weight: .semibold))
                    Text(note).font(.system(size: 10)).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.system(size: 9))
            }.padding(.horizontal, 7).frame(height: 70).modifier(HomePaper())
        }.buttonStyle(.plain)
    }

    private func kanaTile(_ glyph: String, title: String, ranges: [ClosedRange<UInt32>]) -> some View {
        NavigationLink {
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 8) {
                    ForEach(ranges.flatMap { Array($0) }, id: \.self) { code in
                        if let scalar = Unicode.Scalar(code) {
                            Button { store.speak(String(scalar)) } label: {
                                Text(String(scalar)).font(.system(size: 24, design: .serif))
                                    .frame(maxWidth: .infinity, minHeight: 54).modifier(HomePaper())
                            }.buttonStyle(.plain)
                        }
                    }
                }.padding()
            }.navigationTitle(title)
        } label: {
            VStack(spacing: 2) {
                Text(glyph).font(.system(size: 25, design: .serif))
                Text(title).font(.system(size: 10))
            }.frame(maxWidth: .infinity).frame(height: 62).modifier(HomePaper())
        }.buttonStyle(.plain)
    }
}

private struct HomePaper: ViewModifier {
    func body(content: Content) -> some View {
        content.background(.background, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.pink.opacity(0.15)))
    }
}
struct LibraryView: View {
    @Environment(\.colorScheme) private var theme
    private let names = ["Beginner", "Basic", "Intermediate", "Upper Intermediate", "Advanced"]
    private let colors: [UInt32] = [0xF6DCE5, 0xEBE2F1, 0xE9EEE7, 0xFFEADB, 0xF4E0E9]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                Text("▣  JLPT Books").font(.system(size: 24, weight: .semibold, design: .serif))
                Text("JLPT অনুযায়ী সাজানো পাঠ্যপুস্তকসমূহ").font(.system(size: 11)).foregroundStyle(.secondary)
                ForEach(Array(StudyLevel.all.enumerated()), id: \.element) { index, level in
                    NavigationLink {
                        List {
                            ForEach(Subject.allCases) { subject in
                                NavigationLink { StudyList(subject: subject, initialLevel: level) } label: {
                                    Label(subject.title, systemImage: subject.icon)
                                }
                            }
                        }.navigationTitle(level + " Books")
                    } label: {
                        levelCard(level, index: index)
                    }.buttonStyle(.plain)
                }
            }.padding(14)
        }.navigationTitle("বইঘর").navigationBarTitleDisplayMode(.inline)
    }

    private func levelCard(_ level: String, index: Int) -> some View {
        let rgb = colors[index]
        let color = theme == .dark ? Color(uiColor: .secondarySystemBackground) :
            Color(red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255,
                  blue: Double(rgb & 255) / 255)
        return ZStack(alignment: .leading) {
            color
            Image("AndroidBooks" + level).resizable().frame(width: 171, height: 85)
                .frame(maxWidth: .infinity, alignment: .trailing).accessibilityHidden(true)
            LinearGradient(colors: [color, color, color.opacity(0)], startPoint: .leading, endPoint: .trailing)
            VStack(alignment: .leading, spacing: 2) {
                Text(level).font(.system(size: 26, weight: .semibold, design: .serif))
                Text(names[index]).font(.system(size: 11, weight: .semibold))
                Text("Vocabulary · Grammar · Kanji").font(.system(size: 9))
            }.padding(.leading, 15)
        }.frame(height: 85).clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.pink.opacity(0.15)))
    }
}
struct StudyList: View {
    @EnvironmentObject var store: StudyStore
    let subject: Subject
    var onlySaved = false
    @State var level: String
    @State private var entries: [StudyEntry] = []
    @State private var query = ""
    @State private var loading = false
    @State private var error: String?
    @State private var showingFull = false
    @State private var lesson = 0
    private let lessonSize = 15
    @Environment(\.scenePhase) private var scenePhase
    private let clock = Timer.publish(every: 2, on: .main, in: .common).autoconnect()
    init(subject: Subject, onlySaved: Bool = false, initialLevel: String = "N5") { self.subject = subject; self.onlySaved = onlySaved; _level = State(initialValue: initialLevel) }
    private var resumeKey: String {
        let account = store.snapshot?.user.id ?? "guest"
        return "ios.reader.resume." + [account, level, subject.rawValue, showingFull ? "full" : "preview"].joined(separator: ".")
    }

    private var lessonCount: Int { (entries.count + lessonSize - 1) / lessonSize }
    private var lessonEntries: [StudyEntry] {
        Array(entries.dropFirst(lesson * lessonSize).prefix(lessonSize))
    }
    private var resumeEntry: StudyEntry? {
        let last = UserDefaults.standard.string(forKey: resumeKey)
        return lessonEntries.first(where: { $0.id == last }) ??
            lessonEntries.first(where: { !store.learned.contains($0.key(level: level)) }) ??
            lessonEntries.first
    }

    var filtered: [StudyEntry] {
        if query.isEmpty && !onlySaved { return lessonEntries }
        return entries.filter { entry in
            (!onlySaved || store.saved.contains(entry.key(level: level))) &&
                (query.isEmpty || (entry.title + entry.pronunciation + entry.translation).localizedCaseInsensitiveContains(query))
        }
    }

    private func destination(_ entry: StudyEntry) -> some View {
        let key = resumeKey
        return EntryView(entry: entry, level: level, subject: subject, protectedContent: showingFull)
            .onAppear { UserDefaults.standard.set(entry.id, forKey: key) }
    }

    private func restoreLesson() {
        let last = UserDefaults.standard.string(forKey: resumeKey)
        lesson = (entries.firstIndex(where: { $0.id == last }) ?? 0) / lessonSize
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("JLPT level", selection: $level) { ForEach(StudyLevel.all, id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented).padding()
            List {
                Section {
                    Text(showingFull ? "পূর্ণ পাঠ · সক্রিয় access" : (subject == .kanji ? "প্রথম ১০টি কানজি বিনামূল্যে" : "প্রথম ৫টি পাঠ বিনামূল্যে")).font(.footnote).foregroundStyle(.secondary)
                    if let error { Text(error).foregroundStyle(.red); Button("আবার চেষ্টা করুন") { Task { await load() } } }
                    if loading { ProgressView("পাঠ খোলা হচ্ছে…") }
                    if query.isEmpty && !onlySaved, let resumeEntry {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("পাঠ \(lesson + 1) / \(lessonCount)").font(.headline)
                            ProgressView(value: Double(lessonEntries.filter { store.learned.contains($0.key(level: level)) }.count),
                                         total: Double(lessonEntries.count))
                            NavigationLink { destination(resumeEntry) } label: {
                                Label("পাঠ শুরু", systemImage: "play.fill")
                            }
                            if lessonCount > 1 {
                                HStack {
                                    Button("আগের পাঠ") { lesson -= 1 }.disabled(lesson == 0)
                                    Spacer()
                                    Button("পরের পাঠ") { lesson += 1 }.disabled(lesson + 1 >= lessonCount)
                                }.buttonStyle(.borderless)
                            }
                        }.padding(.vertical, 5)
                    }
                    ForEach(filtered) { entry in
                        NavigationLink { destination(entry) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(entry.title).font(.title2).foregroundStyle(.primary)
                                Text(entry.pronunciation).font(.subheadline).foregroundStyle(.secondary)
                                Text(entry.translation).font(.body)
                            }.padding(.vertical, 5)
                        }
                        .swipeActions { Button { store.toggleSaved(entry.key(level: level)) } label: { Label("প্রিয়", systemImage: "heart") }.tint(.pink) }
                    }
                    if filtered.isEmpty && !loading && error == nil { Text("কোনো পাঠ পাওয়া যায়নি।").foregroundStyle(.secondary) }
                }
                if !showingFull {
                    Section { Text("পূর্ণ পাঠের access থাকলে প্রোফাইলে sign in করুন। iPhone-এ নতুন reward বর্তমানে উপলব্ধ নয়; কোনো credit কাটা হবে না।").font(.footnote) }
                }
            }.listStyle(.insetGrouped).refreshable { do { try await store.refresh() } catch { self.error = error.localizedDescription }; await load() }
        }
        .navigationTitle(onlySaved ? "প্রিয় পাঠ" : subject.title).navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "জাপানি / বাংলা / reading")
        .task(id: level + store.token) { await load() }
        .onReceive(clock) { _ in if showingFull && !store.hasAccess(level) { entries = (try? store.preview(level: level, subject: subject)) ?? []; showingFull = false; restoreLesson() } }
        .onChange(of: scenePhase) { phase in if phase != .active && showingFull { entries = []; showingFull = false } else if phase == .active { Task { await load() } } }
    }
    @MainActor private func load() async {
        loading = true; error = nil; entries = []; let selected = level
        let token = store.token
        defer { if selected == level && token == store.token && !Task.isCancelled { loading = false } }
        do {
            let result = try await store.fetchEntries(level: selected, subject: subject)
            guard selected == level, token == store.token, !Task.isCancelled else { return }
            entries = result; showingFull = store.hasAccess(selected); restoreLesson()
        } catch {
            guard selected == level, token == store.token, !Task.isCancelled else { return }
            entries = (try? store.preview(level: selected, subject: subject)) ?? []; showingFull = false; restoreLesson(); self.error = error.localizedDescription
        }
    }
}
struct EntryView: View {
    @EnvironmentObject var store: StudyStore
    let entry: StudyEntry
    let level: String
    let subject: Subject
    let protectedContent: Bool
    @AppStorage("ios.reader.textSize") private var textSize = "standard"
    @State private var valid = true
    private var readingSize: DynamicTypeSize {
        switch textSize {
        case "small": return .small
        case "large": return .xxLarge
        default: return .large
        }
    }
    @Environment(\.scenePhase) private var scenePhase
    private let clock = Timer.publish(every: 2, on: .main, in: .common).autoconnect()
    var body: some View {
        ScrollView {
            if valid {
                VStack(alignment: .leading, spacing: 18) {
                    Text(entry.title).font(.system(size: subject == .kanji ? 80 : 32, weight: .medium, design: .serif)).frame(maxWidth: .infinity)
                    Text(entry.pronunciation).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                    Text(entry.translation).font(.title3)
                    HStack {
                        Button { store.speak(entry.pronunciation) } label: { Label("উচ্চারণ", systemImage:"speaker.wave.2") }
                        Spacer()
                        Button { store.toggleSaved(entry.key(level: level)) } label: { Image(systemName: store.saved.contains(entry.key(level: level)) ? "heart.fill" : "heart") }.accessibilityLabel("প্রিয় পাঠ")
                    }
                    if let formation = entry.formation { Text("গঠন").font(.headline); Text(formation) }
                    if let explanation = entry.explanation { Text("ব্যবহার ও ব্যাখ্যা").font(.headline); Text(explanation) }
                    if subject == .kanji {
                        Text("音読み: " + (entry.onyomi ?? []).joined(separator:"・")); Text("訓読み: " + (entry.kunyomi ?? []).joined(separator:"・"))
                        StrokeView(character: entry.character ?? entry.title, level: level, protectedContent: protectedContent)
                    }
                    ForEach(Array((entry.examples ?? []).enumerated()), id: \.offset) { _, example in
                        VStack(alignment: .leading, spacing: 5) { Text(example.japanese).font(.title3); Text(example.reading ?? "").foregroundStyle(.secondary); Text(example.translation) }.padding().frame(maxWidth:.infinity,alignment:.leading).background(Color.pink.opacity(0.06),in:RoundedRectangle(cornerRadius:12))
                    }
                    Button { store.toggleLearned(entry.key(level:level)) } label: { Label(store.learned.contains(entry.key(level: level)) ? "শেখা হয়েছে" : "শেখা হয়েছে হিসেবে রাখুন",systemImage:"checkmark.circle") }.buttonStyle(.borderedProminent)
                }.padding()
            } else { Text("Access শেষ হয়েছে। পাঠ আবার খুলুন।").padding() }
        }.dynamicTypeSize(readingSize)
        .navigationTitle(level).navigationBarTitleDisplayMode(.inline)
        .onReceive(clock) { _ in if protectedContent && !store.hasAccess(level) { valid = false; store.speech.stopSpeaking(at:.immediate) } }
        .onChange(of: scenePhase) { phase in if phase != .active && protectedContent { valid = false; store.speech.stopSpeaking(at:.immediate) } }
        .onDisappear { store.speech.stopSpeaking(at:.immediate) }
    }
}
