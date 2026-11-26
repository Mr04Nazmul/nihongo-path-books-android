import Foundation
import JavaScriptCore

@MainActor
enum AdaptiveScript {
    private static let context: JSContext? = {
        guard let url = Bundle.main.url(forResource: "AdaptiveEngine", withExtension: "js"),
              let script = try? String(contentsOf: url, encoding: .utf8),
              let context = JSContext() else { return nil }
        context.evaluateScript(script)
        return context.exception == nil ? context : nil
    }()

    static func call(_ method: String, arguments: [Any]) -> JSValue? {
        guard let context else { return nil }
        context.exception = nil
        let result = context.objectForKeyedSubscript("NihongoPractice")?.invokeMethod(method, withArguments: arguments)
        return context.exception == nil ? result : nil
    }
}
