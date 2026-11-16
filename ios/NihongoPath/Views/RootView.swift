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
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Image("BrandLogo").resizable().scaledToFit().frame(width: 65, height: 65).accessibilityHidden(true)
                    VStack(alignment: .leading) { Text("Nihongo Path").font(.title2.bold()); Text("বাংলায় জাপানি শিখুন · 日本語").font(.subheadline).foregroundStyle(.secondary) }
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("こんにちは 🌸").font(.largeTitle.bold())
                    Text("প্রতিদিন একটু চর্চায় এগিয়ে যান।").font(.title3)
                    Text("N5 থেকে N1 · শব্দ, ব্যাকরণ ও কানজি").foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(24).background(Color.pink.opacity(0.10), in: RoundedRectangle(cornerRadius: 24))
                ForEach(Subject.allCases) { subject in
                    NavigationLink { StudyList(subject: subject) } label: {
                        Label(subject.title, systemImage: subject.icon).font(.headline).padding(22).frame(maxWidth: .infinity, alignment: .leading).background(Color.pink.opacity(0.07), in: RoundedRectangle(cornerRadius: 18))
                    }.buttonStyle(.plain)
                }
                NavigationLink { StudyList(subject: .vocab, onlySaved: true) } label: { Label("প্রিয় শব্দ ও পাঠ", systemImage: "heart.fill") }
                HStack { Label("\(store.saved.count) প্রিয় পাঠ", systemImage:"heart"); Spacer(); Label("\(store.learned.count) শেখা হয়েছে", systemImage:"checkmark.circle") }.font(.footnote)
                Text("কিছু পাঠ বিনামূল্যে। পূর্ণ পাঠে সার্ভার-যাচাইকৃত access প্রয়োজন।").font(.footnote).foregroundStyle(.secondary)
            }.padding()
        }.navigationTitle("Nihongo Path").navigationBarTitleDisplayMode(.inline)
    }
}
struct LibraryView: View {
    var body: some View {
        List {
            ForEach(StudyLevel.all, id: \.self) { level in
                Section(level) { ForEach(Subject.allCases) { subject in NavigationLink(subject.title) { StudyList(subject: subject, initialLevel: level) } } }
            }
        }.navigationTitle("বই · Books")
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
    @Environment(\.scenePhase) private var scenePhase
    private let clock = Timer.publish(every: 2, on: .main, in: .common).autoconnect()
    init(subject: Subject, onlySaved: Bool = false, initialLevel: String = "N5") { self.subject = subject; self.onlySaved = onlySaved; _level = State(initialValue: initialLevel) }
    var filtered: [StudyEntry] { entries.filter { e in (!onlySaved || store.saved.contains(e.key(level: level))) && (query.isEmpty || (e.title + e.pronunciation + e.translation).localizedCaseInsensitiveContains(query)) } }
    var body: some View {
        VStack(spacing: 0) {
            Picker("JLPT level", selection: $level) { ForEach(StudyLevel.all, id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented).padding()
            List {
                Section {
                    Text(showingFull ? "পূর্ণ পাঠ · সক্রিয় access" : (subject == .kanji ? "প্রথম ১০টি কানজি বিনামূল্যে" : "প্রথম ৫টি পাঠ বিনামূল্যে")).font(.footnote).foregroundStyle(.secondary)
                    if let error { Text(error).foregroundStyle(.red); Button("আবার চেষ্টা করুন") { Task { await load() } } }
                    if loading { ProgressView("পাঠ খোলা হচ্ছে…") }
                    ForEach(filtered) { entry in
                        NavigationLink { EntryView(entry: entry, level: level, subject: subject, protectedContent: showingFull) } label: {
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
        .onReceive(clock) { _ in if showingFull && !store.hasAccess(level) { entries = (try? store.preview(level: level, subject: subject)) ?? []; showingFull = false } }
        .onChange(of: scenePhase) { phase in if phase != .active && showingFull { entries = []; showingFull = false } else if phase == .active { Task { await load() } } }
    }
    @MainActor private func load() async {
        loading = true; error = nil; entries = []; let selected = level
        defer { loading = false }
        do {
            let result = try await store.fetchEntries(level: selected, subject: subject)
            guard selected == level, !Task.isCancelled else { return }
            entries = result; showingFull = store.hasAccess(selected)
        } catch {
            guard selected == level else { return }
            entries = (try? store.preview(level: selected, subject: subject)) ?? []; showingFull = false; self.error = error.localizedDescription
        }
    }
}
struct EntryView: View {
    @EnvironmentObject var store: StudyStore
    let entry: StudyEntry
    let level: String
    let subject: Subject
    let protectedContent: Bool
    @State private var valid = true
    @State private var canvasReset = UUID()
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
                        StrokeView(character: entry.character ?? entry.title, level: level, protectedContent: protectedContent).frame(height: 280)
                        Text("লেখার অনুশীলন").font(.headline)
                        DrawingBoard().id(canvasReset).frame(height: 280).background(Color.pink.opacity(0.04)).clipShape(RoundedRectangle(cornerRadius:16))
                        Button("বোর্ড মুছুন", role: .destructive) { canvasReset = UUID() }
                    }
                    ForEach(Array((entry.examples ?? []).enumerated()), id: \.offset) { _, example in
                        VStack(alignment: .leading, spacing: 5) { Text(example.japanese).font(.title3); Text(example.reading ?? "").foregroundStyle(.secondary); Text(example.translation) }.padding().frame(maxWidth:.infinity,alignment:.leading).background(Color.pink.opacity(0.06),in:RoundedRectangle(cornerRadius:12))
                    }
                    Button { store.toggleLearned(entry.key(level:level)) } label: { Label(store.learned.contains(entry.key(level: level)) ? "শেখা হয়েছে" : "শেখা হয়েছে হিসেবে রাখুন",systemImage:"checkmark.circle") }.buttonStyle(.borderedProminent)
                }.padding()
            } else { Text("Access শেষ হয়েছে। পাঠ আবার খুলুন।").padding() }
        }.navigationTitle(level).navigationBarTitleDisplayMode(.inline)
        .onReceive(clock) { _ in if protectedContent && !store.hasAccess(level) { valid = false; store.speech.stopSpeaking(at:.immediate) } }
        .onChange(of: scenePhase) { phase in if phase != .active && protectedContent { valid = false; store.speech.stopSpeaking(at:.immediate) } }
        .onDisappear { store.speech.stopSpeaking(at:.immediate) }
    }
}
