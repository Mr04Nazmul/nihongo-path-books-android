import Foundation

struct Example: Codable, Hashable {
    var ja: String?, word: String?, reading: String?, bn: String?, meaning: String?
    var japanese: String { ja ?? word ?? "" }
    var translation: String { bn ?? meaning ?? "" }
}
struct StudyEntry: Codable, Identifiable, Hashable {
    let id: String
    var word: String?, pattern: String?, character: String?, level: String?
    var reading: String?, pattern_reading: String?, meaning: String?, meaning_bn: String?, english: String?
    var formation: String?, explanation: String?, examples: [Example]?
    var onyomi: [String]?, kunyomi: [String]?
    var title: String { word ?? pattern ?? character ?? "" }
    var pronunciation: String { reading ?? pattern_reading ?? kunyomi?.first ?? onyomi?.first ?? title }
    var translation: String { meaning_bn ?? meaning ?? english ?? "" }
    func key(level: String) -> String { level + ":" + id }
}
struct Lessons: Codable {
    var vocab: [StudyEntry], grammar: [StudyEntry], kanji: [StudyEntry]
    func entries(_ subject: Subject) -> [StudyEntry] {
        switch subject { case .vocab: return vocab; case .grammar: return grammar; case .kanji: return kanji }
    }
}
struct KanjiCatalogue: Codable { var level: String; var entries: [StudyEntry] }
struct StrokeData: Codable { var paths: [String]; var character: String }
enum Subject: String, CaseIterable, Identifiable {
    case vocab, grammar, kanji
    var id: String { rawValue }
    var title: String { switch self { case .vocab: return "Vocabulary · শব্দ"; case .grammar: return "Grammar · ব্যাকরণ"; case .kanji: return "Kanji · 漢字" } }
    var icon: String { switch self { case .vocab: return "book.closed"; case .grammar: return "text.book.closed"; case .kanji: return "pencil.tip.crop.circle" } }
}
enum StudyLevel {
    static let all = ["N5", "N4", "N3", "N2", "N1"]
    static func valid(_ value: String) -> Bool { all.contains(value) }
}
struct UserProfile: Codable { var id: String; var email: String; var name: String? }
struct Balance: Codable { var level: String; var credits: Int }
struct Unlock: Codable { var level: String; var expires_at: String }
struct Tier: Codable, Identifiable {
    var id: String; var level: String; var credits: Int; var seconds: Int; var enabled: Bool
}
struct AccountSnapshot: Codable {
    var user: UserProfile; var serverTime: String; var balances: [Balance]; var unlocks: [Unlock]; var tiers: [Tier]
}
struct SessionResponse: Codable { var token: String; var user: UserProfile }
struct OAuthStart: Codable { var url: URL }
struct EmptyResponse: Codable { var ok: Bool? }
struct APIError: Error, LocalizedError {
    var status: Int; var message: String
    var errorDescription: String? { message }
}
enum DateParser {
    static func date(_ string: String) -> Date? {
        let fractional = ISO8601DateFormatter(); fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }
}
