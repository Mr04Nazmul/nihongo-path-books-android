import Foundation

/// Redirects are rejected so an app-session token cannot follow a redirect to another host.
final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
actor APIClient {
    static let base = URL(string: "https://vjygltfnrmyghlwyjtwu.supabase.co/functions/v1/nihongo-books-v1")!
    private let session: URLSession
    init(session: URLSession? = nil) {
        if let session { self.session = session }
        else {
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 30
            config.urlCache = nil
            self.session = URLSession(configuration: config, delegate: NoRedirect(), delegateQueue: nil)
        }
    }
    func request<T: Decodable>(_ path: String, method: String = "GET", token: String = "", body: [String: String]? = nil, as: T.Type = T.self) async throws -> T {
        guard path.hasPrefix("/"), !path.contains(".."), !path.contains("?"), !path.contains("#"), !path.contains("\\"),
              let url = URL(string: Self.base.absoluteString + path), url.host == Self.base.host else {
            throw APIError(status: 0, message: "Invalid study request")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if !token.isEmpty { req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if method != "GET" {
            req.httpBody = try JSONEncoder().encode(body ?? [:])
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: req)
        guard let response = response as? HTTPURLResponse else { throw APIError(status: 0, message: "Study service did not respond") }
        guard (200..<300).contains(response.statusCode) else {
            let error = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError(status: response.statusCode, message: error?["error"] as? String ?? "Study service unavailable. Please try again.")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
