import Foundation
import SwiftUI
import AVFoundation
import UserNotifications

@MainActor final class StudyStore: ObservableObject {
    @Published var snapshot: AccountSnapshot?
    @Published var message: String?
    @Published var busy = false
    @Published var saved: Set<String>
    @Published var learned: Set<String>
    @Published var token: String
    let api = APIClient()
    let speech = AVSpeechSynthesizer()
    private var snapshotUptime: TimeInterval = 0
    private var snapshotServerTime: Date?
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        token = SessionVault.read()
        saved = Set(defaults.stringArray(forKey: "ios.saved") ?? [])
        learned = Set(defaults.stringArray(forKey: "ios.learned") ?? [])
    }
    var signedIn: Bool { !token.isEmpty && snapshot != nil }
    func toggleSaved(_ key: String) { if saved.contains(key) { saved.remove(key) } else { saved.insert(key) }; defaults.set(Array(saved), forKey: "ios.saved") }
    func toggleLearned(_ key: String) { if learned.contains(key) { learned.remove(key) } else { learned.insert(key) }; defaults.set(Array(learned), forKey: "ios.learned") }
    func speak(_ text: String) {
        speech.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: text); u.voice = AVSpeechSynthesisVoice(language: "ja-JP"); u.rate = 0.42; speech.speak(u)
    }
    func local<T: Decodable>(_ resource: String, as: T.Type = T.self) throws -> T {
        guard !resource.contains(".."), let url = Bundle.main.url(forResource: resource, withExtension: "json", subdirectory: "StudyData") else { throw APIError(status: 0, message: "Bundled study content could not be found") }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }
    func preview(level: String, subject: Subject) throws -> [StudyEntry] {
        guard StudyLevel.valid(level) else { return [] }
        if subject == .kanji {
            let c: KanjiCatalogue = try local("kanji-" + level.lowercased()); return c.entries
        }
        let l: Lessons = try local("lessons-" + level.lowercased()); return l.entries(subject)
    }
    func now() -> Date {
        guard let date = snapshotServerTime else { return Date() }
        return date.addingTimeInterval(ProcessInfo.processInfo.systemUptime - snapshotUptime)
    }
    func hasAccess(_ level: String) -> Bool {
        guard signedIn, let unlock = snapshot?.unlocks.first(where: { $0.level == level }), let expiry = DateParser.date(unlock.expires_at) else { return false }
        return expiry > now()
    }
    func fetchEntries(level: String, subject: Subject) async throws -> [StudyEntry] {
        guard StudyLevel.valid(level) else { throw APIError(status: 0, message: "Invalid level") }
        // Never persist protected curriculum. The server remains the source of entitlement decisions.
        guard hasAccess(level) else { return try preview(level: level, subject: subject) }
        if subject == .kanji {
            let c: KanjiCatalogue = try await api.request("/content/kanji/" + level.lowercased() + ".json", token: token); return c.entries
        }
        let l: Lessons = try await api.request("/content/data/lessons-" + level.lowercased() + ".json", token: token); return l.entries(subject)
    }
    func refresh() async throws {
        guard !token.isEmpty else { return }
        do {
            let value: AccountSnapshot = try await api.request("/me", token: token)
            guard let time = DateParser.date(value.serverTime) else { throw APIError(status: 0, message: "Study server time unavailable") }
            snapshotServerTime = time; snapshotUptime = ProcessInfo.processInfo.systemUptime; snapshot = value
        } catch {
            if let e = error as? APIError, e.status == 401 { localSignOut() }
            throw error
        }
    }
    func login(email: String, password: String, name: String, register: Bool) async throws {
        let clean = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.contains("@"), !password.isEmpty, !register || password.count >= 10 else { throw APIError(status: 0, message: "সঠিক ইমেইল দিন। নতুন পাসওয়ার্ডে অন্তত ১০ অক্ষর রাখুন।") }
        let result: SessionResponse = try await api.request(register ? "/auth/register" : "/auth/login", method: "POST", body: ["email":clean,"password":password,"name":name,"referralCode":""])
        try await accept(result)
    }
    func accept(_ result: SessionResponse) async throws {
        try SessionVault.save(result.token); token = result.token
        do { try await refresh() } catch { localSignOut(); throw error }
    }
    func localSignOut() {
        token = ""; snapshot = nil; snapshotServerTime = nil; SessionVault.clear()
        // Bookmarks stay device-local, never overwrite the Android/shared server study state.
    }
    func logout() async throws {
        if !token.isEmpty { let _: EmptyResponse = try await api.request("/auth/logout", method: "POST", token: token) }
        localSignOut()
    }
    func deleteAppData() async throws {
        guard signedIn else { return }
        let _: EmptyResponse = try await api.request("/account", method: "DELETE", token: token)
        localSignOut(); saved.removeAll(); learned.removeAll()
        defaults.removeObject(forKey: "ios.saved"); defaults.removeObject(forKey: "ios.learned")
    }
    func remindDaily() async throws {
        let center = UNUserNotificationCenter.current()
        guard try await center.requestAuthorization(options: [.alert,.sound]) else { throw APIError(status: 0, message: "Notifications বন্ধ আছে। Settings থেকে চালু করতে পারবেন।") }
        let content = UNMutableNotificationContent(); content.title = "Nihongo Path"; content.body = "আজ একটু জাপানি চর্চা করুন · 日本語を勉強しましょう"; content.sound = .default
        var date = DateComponents(); date.hour = 19; date.minute = 0
        let request = UNNotificationRequest(identifier: "nihongo-daily", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true))
        try await center.add(request)
    }
    func cancelReminder() { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["nihongo-daily"]) }
    func run(_ action: @escaping () async throws -> Void) {
        guard !busy else { return }; busy = true
        Task { defer { busy = false }; do { try await action() } catch { message = error.localizedDescription } }
    }
}
