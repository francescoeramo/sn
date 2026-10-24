import SwiftUI
import UIKit
import ImageIO

struct FeedView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    let me: Me?
    @State private var composing = false

    var body: some View {
        TabView {
            NavigationStack {
                List {
                    if let message = coordinator.lastErrorMessage {
                        Section {
                            Text(message).foregroundStyle(.secondary)
                            Button("Riprova") { Task { await coordinator.probe() } }
                        }
                    }
                    if coordinator.homePosts.isEmpty {
                        ContentUnavailableView {
                            Label(coordinator.offline ? "Connessione assente" : "Il tuo feed è ancora vuoto", systemImage: coordinator.offline ? "cable.connector.slash" : "text.bubble")
                        } description: {
                            Text(coordinator.offline ? "La sessione è conservata. Controlla la connessione e riprova." : "Qui troverai i post condivisi con te. Puoi iniziare scrivendone uno.")
                        }
                    }
                    ForEach(coordinator.homePosts) { post in
                        PostRow(post: post, author: coordinator.profiles.first { $0.id == post.author_id })
                            .listRowInsets(EdgeInsets(top: 20, leading: 20, bottom: 20, trailing: 20))
                    }
                    if coordinator.nextCursor != nil {
                        Button {
                            Task { await coordinator.loadMore() }
                        } label: {
                            HStack {
                                Text("Carica i post precedenti")
                                if coordinator.isLoadingMore { ProgressView() }
                            }
                        }
                        .disabled(coordinator.isLoadingMore || coordinator.isProbing)
                    } else if !coordinator.homePosts.isEmpty {
                        Label("Sei in pari", systemImage: "checkmark")
                            .foregroundStyle(.secondary)
                    }
                }
                .listStyle(.plain)
                .refreshable { await coordinator.probe() }
                .navigationTitle("SN")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Nuovo post", systemImage: "square.and.pencil") { composing = true }
                    }
                }
                .sheet(isPresented: $composing) { ComposePostView() }
            }
            .tabItem { Label("Feed", systemImage: "house") }
            NavigationStack {
                List {
                    Section {
                        Text(me?.displayName ?? me?.username ?? "Il tuo profilo").font(.title2.bold())
                        if let me { Text("@\(me.username)").foregroundStyle(.secondary) }
                        if let bio = coordinator.profiles.first(where: { $0.id == me?.id })?.bio, !bio.isEmpty {
                            Text(bio)
                        }
                    }
                    Section("I tuoi post") {
                        if let message = coordinator.profileError {
                            Text(message).foregroundStyle(.secondary)
                            Button("Riprova") {
                                Task { await coordinator.loadProfile(refresh: true) }
                            }.disabled(coordinator.isLoadingProfile)
                        }
                        if !coordinator.profileHasLoaded && coordinator.isLoadingProfile {
                            ProgressView("Caricamento dei tuoi post…")
                        } else if coordinator.profileHasLoaded && coordinator.profilePosts.isEmpty {
                            Text("Non hai ancora pubblicato post.").foregroundStyle(.secondary)
                        }
                        ForEach(coordinator.profilePosts) { post in
                            PostRow(post: post, author: nil)
                        }
                        if coordinator.profileNextCursor != nil {
                            Button {
                                Task { await coordinator.loadProfile() }
                            } label: {
                                HStack {
                                    Text("Carica i post precedenti")
                                    if coordinator.isLoadingProfile { ProgressView() }
                                }
                            }.disabled(coordinator.isLoadingProfile)
                        } else if coordinator.profileHasLoaded && !coordinator.profilePosts.isEmpty {
                            Label("Hai caricato tutti i tuoi post", systemImage: "checkmark")
                                .foregroundStyle(.secondary)
                        }
                    }
                    Section {
                        NavigationLink("Sessione e accesso") { SessionView(me: me) }
                    }
                }
                .refreshable { await coordinator.loadProfile(refresh: true) }
                .task(id: "\(coordinator.profileGeneration)-\(coordinator.connectionGeneration)") {
                    await coordinator.loadProfile(refresh: true)
                }
                .navigationTitle("Profilo")
            }
            .tabItem { Label("Profilo", systemImage: "person.crop.circle") }
        }
    }
}

private struct PostRow: View {
    let post: FeedPost
    let author: FeedProfile?
    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let author {
                VStack(alignment: .leading, spacing: 2) {
                    Text(author.display_name.isEmpty ? author.username : author.display_name).font(.headline)
                    Text("@\(author.username)").font(.subheadline).foregroundStyle(.secondary)
                }
            }
            if let date = post.date {
                Text(date, format: .dateTime.day().month(.abbreviated).hour().minute())
                    .font(.caption).foregroundStyle(.secondary)
            }
            if let warning = post.content_warning, !warning.isEmpty, !revealed {
                Text(warning).font(.headline)
                Button("Mostra contenuto") { revealed = true }
            } else {
                if !post.body.isEmpty { Text(post.body).textSelection(.enabled) }
                ForEach(post.attachments) { media in
                    if media.media_type?.hasPrefix("image/") == true {
                        PrivatePostImage(path: media.media_path, alt: media.alt)
                    } else {
                        Label("Allegato non ancora disponibile nell’app", systemImage: "paperclip")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PrivatePostImage: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    let path: String
    let alt: String
    @State private var image: UIImage?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
                    .accessibilityLabel(alt.isEmpty ? "Foto del post" : alt)
            } else if failed {
                Button("Ricarica immagine", systemImage: "arrow.clockwise") { attempt += 1 }
            } else {
                ProgressView("Caricamento immagine…").frame(maxWidth: .infinity, minHeight: 120)
            }
        }
        .task(id: "\(path)-\(attempt)-\(coordinator.connectionGeneration)") {
            guard image == nil else { return }
            failed = false
            do {
                let data = try await coordinator.image(path: path)
                try Task.checkCancellation()
                image = PhotoPreparation.thumbnail(data: data)
                failed = image == nil
            } catch is CancellationError {
                return
            } catch { failed = true }
        }
    }
}

enum PhotoPreparation {
    static func thumbnail(data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1600,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
