import SwiftUI

@main struct NihongoPathApp: App {
    @StateObject private var store = StudyStore()
    @AppStorage("ios.appearance.mode") private var mode = "system"
    @AppStorage("ios.appearance.accent") private var accent = "sakura"

    private var colorScheme: ColorScheme? {
        switch mode {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    private var tint: Color {
        switch accent {
        case "ocean": return Color(red: 0.12, green: 0.40, blue: 0.68)
        case "forest": return Color(red: 0.17, green: 0.43, blue: 0.32)
        default: return Color(red: 0.67, green: 0.16, blue: 0.37)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
                .tint(tint)
                .preferredColorScheme(colorScheme)
                .task { do { try await store.refresh() } catch { store.message = error.localizedDescription } }
                .alert("Nihongo Path", isPresented: Binding(get: { store.message != nil }, set: { if !$0 { store.message = nil } })) {
                    Button("ঠিক আছে", role: .cancel) { store.message = nil }
                } message: { Text(store.message ?? "") }
        }
    }
}
