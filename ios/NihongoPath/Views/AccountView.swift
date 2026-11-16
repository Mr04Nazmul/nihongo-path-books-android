import SwiftUI

struct AccountView: View {
    @EnvironmentObject var store: StudyStore
    @State private var email = "", password = "", name = ""
    @State private var register = false
    @State private var confirmDelete = false
    var body: some View {
        Form {
            if let snapshot = store.snapshot {
                Section("অ্যাকাউন্ট") {
                    Text(snapshot.user.name ?? "Nihongo Path"); Text(snapshot.user.email).textSelection(.enabled)
                    Button("Refresh access") { store.run { try await store.refresh() } }
                }
                Section("আপনার access") {
                    ForEach(StudyLevel.all,id:\.self) { level in
                        HStack { Text(level); Spacer(); Text(store.hasAccess(level) ? "সক্রিয়" : "Preview").foregroundStyle(.secondary) }
                    }
                    Text("iPhone-এ reward বর্তমানে উপলব্ধ নয়। Existing access থাকলে পূর্ণ পাঠ পড়তে পারবেন। এই সংস্করণ credit খরচ বা reward প্রদান করে না।").font(.footnote)
                }
                Section {
                    Button("Logout") { store.run { try await store.logout() } }
                    Button("Delete Nihongo app data",role:.destructive) { confirmDelete = true }
                } footer: { Text("এটি shared Nihongo Path Books profile, credits, access ও account-linked history মুছে দেয়; Android-এও প্রভাব পড়ে। Shared sign-in identity রাখা হয়। সম্পূর্ণ identity মুছতে support-এ যোগাযোগ করুন।") }
            } else {
                Section("Sign in · লগইন") {
                    TextField("ইমেইল",text:$email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("পাসওয়ার্ড",text:$password).textContentType(register ? .newPassword : .password)
                    if register { TextField("আপনার নাম",text:$name).textContentType(.name) }
                    Toggle("নতুন অ্যাকাউন্ট",isOn:$register)
                    Button(register ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন") {
                        store.run { defer { password = "" }; try await store.login(email:email,password:password,name:name,register:register) }
                    }.disabled(store.busy)
                    if store.busy { ProgressView() }
                } footer: { Text("অ্যাকাউন্ট ছাড়াই preview পড়তে পারবেন। আগে Google দিয়ে account খুললে email/password login কাজ নাও করতে পারে; support-এ যোগাযোগ করুন। iOS social login এখনো উপলব্ধ নয়।") }
            }
            Section("পড়ার অভ্যাস") {
                Button("প্রতিদিন সন্ধ্যা ৭টায় reminder") { store.run { try await store.remindDaily(); store.message = "Reminder চালু হয়েছে।" } }
                Button("Reminder বন্ধ করুন") { store.cancelReminder(); store.message = "Reminder বন্ধ হয়েছে।" }
            }
            Section("সহায়তা ও গোপনীয়তা") {
                Link("Support email",destination:URL(string:"mailto:najmulhossain20244@gmail.com")!)
                Link("Privacy policy",destination:APIClient.base.appendingPathComponent("privacy"))
                NavigationLink("Licences & credits") { LicenseView() }
                Text("iOS 1.0.0 · Development build").font(.caption)
            }
        }.navigationTitle("প্রোফাইল")
        .confirmationDialog("Shared Nihongo Path Books data মুছবেন? Android access ও credits-ও মুছে যাবে। এই কাজ ফেরানো যাবে না।",isPresented:$confirmDelete,titleVisibility:.visible) {
            Button("হ্যাঁ, shared app data মুছুন",role:.destructive) { store.run { try await store.deleteAppData() } }
            Button("বাতিল",role:.cancel) {}
        }
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
