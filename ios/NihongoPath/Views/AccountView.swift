import SwiftUI

struct AccountView: View {
    @Environment(\.colorScheme) private var theme
    private var palette: SakuraPalette { SakuraPalette(theme) }
    @EnvironmentObject var store: StudyStore
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var register = false
    @State private var confirmDelete = false
    var body: some View {
        Form {
            if let snapshot = store.snapshot {
                Section("অ্যাকাউন্ট") {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill").font(.system(size: 38))
                            .foregroundStyle(Color.accentColor).accessibilityHidden(true)
                        VStack(alignment: .leading) {
                            Text(snapshot.user.name ?? "Nihongo Path").font(.headline)
                            Text(snapshot.user.email).font(.footnote).textSelection(.enabled)
                        }
                    }
                    NavigationLink { CreditCenterView() } label: { Label("ক্রেডিট সেন্টার", systemImage: "sparkles") }
                }
                Section {
                    Button("Logout") { store.run { try await store.logout() } }
                    Button("Delete Nihongo app data",role:.destructive) { confirmDelete = true }
                } footer: { Text("এটি shared Nihongo Path Books profile, credits, access ও account-linked history মুছে দেয়; Android-এও প্রভাব পড়ে। Shared sign-in identity রাখা হয়। সম্পূর্ণ identity মুছতে support-এ যোগাযোগ করুন।") }
            } else {
                Section {
                    TextField("ইমেইল",text:$email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("পাসওয়ার্ড",text:$password).textContentType(register ? .newPassword : .password)
                    if register { TextField("আপনার নাম",text:$name).textContentType(.name) }
                    Toggle("নতুন অ্যাকাউন্ট",isOn:$register)
                    Button(register ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন") {
                        store.run { defer { password = "" }; try await store.login(email:email,password:password,name:name,register:register) }
                    }.disabled(store.busy)
                    if !register {
                        Button { store.run { try await store.signInWithGoogle() } } label: {
                            Label("Google দিয়ে লগইন", systemImage: "person.crop.circle")
                        }.disabled(store.busy)
                    }
                    if store.busy { ProgressView() }
                } header: {
                    Text("Sign in · লগইন")
                } footer: { Text("অ্যাকাউন্ট ছাড়াই preview পড়তে পারবেন। আগে Google দিয়ে account খুললে একই Google account ব্যবহার করুন।") }
            }
            Section("আপনার পড়ার জায়গা") {
                NavigationLink {
                    StudyList(subject: .vocab, onlySaved: true)
                } label: {
                    Label("বুকমার্ক ও অগ্রগতি", systemImage: "heart")
                }
                LabeledContent("শেখা হয়েছে", value: store.learned.count.formatted())
                LabeledContent("বুকমার্ক", value: store.saved.count.formatted())
                NavigationLink { AppearanceSettingsView() } label: {
                    Label("থিম ও রং", systemImage: "circle.lefthalf.filled")
                }
                NavigationLink { ReadingSettingsView() } label: {
                    Label("পড়ার পছন্দ", systemImage: "textformat.size")
                }
            }
            Section("পড়ার অভ্যাস") {
                Button("প্রতিদিন পড়ার reminder") { store.run { try await store.remindDaily(); store.message = "Reminder চালু হয়েছে।" } }
                Button("Reminder বন্ধ করুন") { store.cancelReminder(); store.message = "Reminder বন্ধ হয়েছে।" }
            }
            Section("সহায়তা ও গোপনীয়তা") {
                Link("Support email",destination:URL(string:"mailto:najmulhossain20244@gmail.com")!)
                Link("Privacy policy",destination:APIClient.base.appendingPathComponent("privacy"))
                NavigationLink("Licences & credits") { LicenseView() }
                Text("iOS 1.0.0 · Development build").font(.caption)
            }
        }.scrollContentBackground(.hidden)
        .background(palette.paper)
        .navigationTitle("প্রোফাইল")
        .confirmationDialog("Shared Nihongo Path Books data মুছবেন? Android access ও credits-ও মুছে যাবে। এই কাজ ফেরানো যাবে না।",isPresented:$confirmDelete,titleVisibility:.visible) {
            Button("হ্যাঁ, shared app data মুছুন",role:.destructive) { store.run { try await store.deleteAppData() } }
            Button("বাতিল",role:.cancel) {}
        }
    }
}
struct CreditCenterView: View {
    @EnvironmentObject private var store: StudyStore

    var body: some View {
        List {
            if let snapshot = store.snapshot {
                ForEach(StudyLevel.all, id: \.self) { level in
                    Section(level) {
                        LabeledContent("ক্রেডিট", value: (snapshot.balances.first { $0.level == level }?.credits ?? 0).formatted())
                        if store.hasAccess(level),
                           let unlock = snapshot.unlocks.first(where: { $0.level == level }),
                           let expiry = DateParser.date(unlock.expires_at) {
                            LabeledContent("অ্যাক্সেস শেষ হবে") { Text(expiry, format: .dateTime.day().month().hour().minute()) }
                        } else {
                            Text("অ্যাক্সেস বন্ধ").foregroundStyle(.secondary)
                        }
                    }
                }
                Section {
                    Text("এই iOS build-এ rewarded ad দিয়ে নতুন ক্রেডিট পাওয়া যায় না।").foregroundStyle(.secondary)
                    Button("অ্যাক্সেস আপডেট করুন") { store.run { try await store.refresh() } }.disabled(store.busy)
                }
            } else {
                NavigationLink("ক্রেডিট দেখতে লগইন করুন") { AccountView() }
            }
        }.navigationTitle("ক্রেডিট সেন্টার")
    }
}

struct LicenseView: View {
    private var licenseText: String { guard let url = Bundle.main.url(forResource:"KANJIVG-LICENSE",withExtension:"txt") else { return "Licence file is included with this app." }; return (try? String(contentsOf:url,encoding:.utf8)) ?? "Licence could not be opened." }
    var body: some View {
        ScrollView { VStack(alignment:.leading,spacing:16) {
            Text("Kanji stroke diagrams: KanjiVG © Ulrich Apel. CC BY-SA 3.0. Original stroke geometry retained; rendered as SVG animations.")
            Link("KanjiVG source",destination:URL(string:"https://kanjivg.tagaini.net/")!)
            Link("CC BY-SA 3.0 licence",destination:URL(string:"https://creativecommons.org/licenses/by-sa/3.0/")!)
            Text("Nihongo Path lesson previews and logo reused from the owner’s existing app assets. Preview data is bundled; protected full books are fetched only after existing server entitlement checks.")
            Text(licenseText).font(.footnote)
        }.padding() }.navigationTitle("Licences")
    }
}

private struct AppearanceSettingsView: View {
    @AppStorage("ios.appearance.mode") private var mode = "system"
    @AppStorage("ios.appearance.accent") private var accent = "sakura"

    var body: some View {
        Form {
            Picker("থিম", selection: $mode) {
                Text("সিস্টেম").tag("system")
                Text("লাইট").tag("light")
                Text("ডার্ক").tag("dark")
            }.pickerStyle(.inline)
            Picker("রং", selection: $accent) {
                Text("সাকুরা গোলাপি").tag("sakura")
                Text("সমুদ্র নীল").tag("ocean")
                Text("বন সবুজ").tag("forest")
            }.pickerStyle(.inline)
        }.navigationTitle("থিম ও রং")
    }
}

private struct ReadingSettingsView: View {
    @EnvironmentObject private var store: StudyStore
    @AppStorage("ios.reader.textSize") private var textSize = "standard"
    @AppStorage("ios.reader.speechRate") private var speechRate = 0.42

    var body: some View {
        Form {
            Picker("লেখার আকার", selection: $textSize) {
                Text("ছোট").tag("small")
                Text("সাধারণ").tag("standard")
                Text("বড়").tag("large")
            }.pickerStyle(.inline)
            Section("উচ্চারণের গতি") {
                Slider(value: $speechRate, in: 0.25...0.60, step: 0.01)
                    .accessibilityLabel("উচ্চারণের গতি")
                Button("উচ্চারণ শুনুন") { store.speak("こんにちは") }
            }
        }.navigationTitle("পড়ার পছন্দ")
    }
}
