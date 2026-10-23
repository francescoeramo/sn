import Foundation

// Synthetic wire-contract checks, runnable on Linux without UIKit or XCTest.
let payload = Data(#"{"user_id":"u","me":{"id":"u","username":"fra","display_name":"Fra"},"profiles":[{"id":"u","username":"fra","display_name":"Fra","bio":"Ciao"}],"posts":[{"id":"p","author_id":"u","body":"Ciao","kind":"post","media_path":null,"media_type":null,"alt":"","created_at":"2026-10-23T12:30:00.123+00:00","content_warning":"avviso"}],"nextCursor":"2026-10-23T12:30:00+00:00","circlePosts":[{"post_id":"circle-post"}]}"#.utf8)
let snapshot = try JSONDecoder().decode(Bootstrap.self, from: payload)
precondition(snapshot.posts.count == 1 && snapshot.profiles[0].bio == "Ciao")
precondition(snapshot.posts[0].date != nil)
precondition(snapshot.posts[0].attachments.isEmpty)
precondition(snapshot.circlePosts[0].post_id == "circle-post")
precondition(snapshot.posts[0].content_warning == "avviso")
let encoded = try JSONEncoder().encode(NewPost(body: "testo", media_path: nil, alt: ""))
let object = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
precondition(object["media_path"] is NSNull)
precondition(object["kind"] as? String == "post")
let old = Data(#"{"user_id":"u","me":{"id":"u","username":"fra","display_name":null}}"#.utf8)
let oldSnapshot = try JSONDecoder().decode(Bootstrap.self, from: old)
precondition(oldSnapshot.posts.isEmpty)
print("8 controlli contratto Swift superati: bootstrap, date, allegati, cerchie, warning, null JSON, tipo post, compatibilità M0")
