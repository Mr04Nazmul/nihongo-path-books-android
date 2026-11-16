import SwiftUI

@main struct NihongoPathApp: App {
    @StateObject private var store = StudyStore()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
                .tint(Color(red: 0.67, green: 0.16, blue: 0.37))
                .task { do { try await store.refresh() } catch { store.message = error.localizedDescription } }
                .alert("Nihongo Path", isPresented: Binding(get: { store.message != nil }, set: { if !$0 { store.message = nil } })) {
                    Button("ঠিক আছে", role: .cancel) { store.message = nil }
                } message: { Text(store.message ?? "") }
        }
    }
}
