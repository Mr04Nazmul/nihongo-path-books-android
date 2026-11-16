import XCTest
@testable import NihongoPath

final class NihongoPathTests: XCTestCase {
    @MainActor func testAllLevelsDecodeBoundedPreviewsAndStrokes() throws {
        let suite = UserDefaults(suiteName:"ios-preview-tests")!; suite.removePersistentDomain(forName:"ios-preview-tests")
        let store = StudyStore(defaults:suite)
        for level in StudyLevel.all {
            for subject in Subject.allCases {
                let entries = try store.preview(level:level,subject:subject)
                XCTAssertEqual(entries.count,subject == .kanji ? 10 : 5)
                XCTAssertEqual(Set(entries.map(\.id)).count,entries.count)
                XCTAssertTrue(entries.allSatisfy { !$0.title.isEmpty && !$0.translation.isEmpty })
                if subject == .kanji {
                    for entry in entries {
                        let code = String(format:"%05x",try XCTUnwrap(entry.character?.unicodeScalars.first).value)
                        let strokes: StrokeData = try store.local("stroke-\(level.lowercased())-\(code)")
                        XCTAssertFalse(strokes.paths.isEmpty); XCTAssertEqual(strokes.character,entry.character)
                    }
                }
            }
        }
    }
    func testDateParsingAcceptsServerPrecisionAndRejectsGarbage() {
        XCTAssertNotNil(DateParser.date("2026-11-16T10:00:00.123456Z"))
        XCTAssertNotNil(DateParser.date("2026-11-16T10:00:00Z"))
        XCTAssertNil(DateParser.date("not-a-date"))
    }
    @MainActor func testSavedStateStaysLocalAndCanBeToggled() {
        let suite = UserDefaults(suiteName:"ios-bookmark-tests")!; suite.removePersistentDomain(forName:"ios-bookmark-tests")
        let store = StudyStore(defaults:suite)
        store.toggleSaved("N5:example"); XCTAssertTrue(store.saved.contains("N5:example"))
        store.toggleSaved("N5:example"); XCTAssertFalse(store.saved.contains("N5:example"))
        store.toggleLearned("N1:example"); XCTAssertEqual(suite.stringArray(forKey:"ios.learned"),["N1:example"])
        suite.removePersistentDomain(forName:"ios-bookmark-tests")
    }
    func testInvalidPathsRejectedBeforeNetwork() async {
        let api = APIClient()
        for path in ["https://bad.example", "/content/../secret", "/me?token=x", "/me#fragment"] {
            do { let _:EmptyResponse = try await api.request(path); XCTFail("Accepted invalid path") }
            catch let error as APIError { XCTAssertEqual(error.status,0) }
            catch { XCTFail("Expected input rejection, not network") }
        }
    }
    @MainActor func testCannotGrantAccessWithoutSignedInServerSnapshot() {
        let store = StudyStore(defaults:UserDefaults(suiteName:"ios-access-tests")!)
        for level in StudyLevel.all { XCTAssertFalse(store.hasAccess(level)) }
    }
}
