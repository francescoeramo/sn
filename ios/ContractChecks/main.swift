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
precondition(object["content_warning"] as? String == "")
let warned = try JSONEncoder().encode(NewPost(body: "testo", media_path: nil, alt: "", content_warning: "Tema sensibile"))
let warnedObject = try JSONSerialization.jsonObject(with: warned) as! [String: Any]
precondition(warnedObject["content_warning"] as? String == "Tema sensibile")
let profilePayload = Data(#"{"posts":[],"nextCursor":{"created_at":"2026-10-24T09:00:00.123456+00:00","post_id":"00000000-0000-4000-8000-000000000001"}}"#.utf8)
let profile = try JSONDecoder().decode(ProfilePostsPage.self, from: profilePayload)
precondition(profile.posts.isEmpty)
precondition(profile.nextCursor?.created_at == "2026-10-24T09:00:00.123456+00:00")
let terminal = try JSONDecoder().decode(ProfilePostsPage.self, from: Data(#"{"posts":[],"nextCursor":null}"#.utf8))
precondition(terminal.nextCursor == nil)
print("13 controlli contratto Swift superati: bootstrap, date, allegati, cerchie, warning, null JSON, tipo post, compatibilità M0, profilo e cursore")
