import SwiftUI
import UIKit

struct StorySelection: Identifiable {
    let id = UUID()
    let stories: [NativeStory]
    let selectedId: String
}

struct StoriesSection: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    let onSelect: (StorySelection) -> Void

    var body: some View {
        Section {
            if let message = coordinator.storiesError {
                Text(message)
                Button("Riprova a caricare le storie") { Task { await coordinator.loadStories(refresh: true) } }
                    .disabled(coordinator.isLoadingStories)
            }
            if !coordinator.storiesHaveLoaded && coordinator.isLoadingStories {
                ProgressView("Caricamento storie…")
            } else {
                let active = coordinator.stories.filter { $0.isActive(at: Date()) }
                if active.isEmpty { Text("Nessuna storia attiva.").font(.footnote) }
                ScrollView(.horizontal) {
                    HStack(spacing: 12) {
                        ForEach(active) { story in
                            Button {
                                onSelect(StorySelection(stories: active, selectedId: story.id))
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: story.viewed ? "person.crop.circle" : "person.crop.circle.badge.clock")
                                        .font(.title2)
                                    Text(story.authorName).font(.subheadline)
                                }.frame(minWidth: 64, minHeight: 64)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("Storia di \(story.authorName)")
                            .accessibilityValue(story.viewed ? "Già vista" : "Non vista")
                        }
                    }
                }
            }
            if coordinator.storiesCursor != nil {
                Button("Carica le storie precedenti") { Task { await coordinator.loadStories() } }
                    .disabled(coordinator.isLoadingStories)
            }
        } header: {
            Text("Storie").foregroundStyle(Color(uiColor: .label))
        }
        .task(id: coordinator.connectionGeneration) { await coordinator.loadStories(refresh: true) }
    }
}

struct StoryPlayer: View {
    @Environment(\.dismiss) private var dismiss
    let stories: [NativeStory]
    @State private var index: Int

    init(stories: [NativeStory], selectedId: String) {
        self.stories = stories // Freeze order until dismissal, independently of list refreshes.
        _index = State(initialValue: stories.firstIndex { $0.id == selectedId } ?? 0)
    }

    var body: some View {
        NavigationStack {
            if stories.indices.contains(index) {
                StorySlide(story: stories[index], canGoBack: index > 0,
                           previous: { if index > 0 { index -= 1 } }, next: {
                    if index + 1 < stories.count { index += 1 } else { dismiss() }
                })
                .id(stories[index].id)
                #if DEBUG
                .safeAreaInset(edge: .top) {
                    if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1" {
                        Text("Collaudo M2 · dati locali").font(.caption2).padding(4)
                            .dynamicTypeSize(.large).accessibilityHidden(true)
                    }
                }
                #endif
                .navigationTitle("Storia \(index + 1) di \(stories.count)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Chiudi") { dismiss() }
                    }
                }
            }
        }
    }
}

private struct StorySlide: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    let story: NativeStory
    let canGoBack: Bool
    let previous: () -> Void
    let next: () -> Void
    @State private var revealed = false
    @State private var paused = false
    @State private var held = false
    @State private var image: UIImage?
    @State private var failed = false
    @State private var attempt = 0
    @State private var playback = StoryPlayback()
    private var allowed: Bool { story.warning == nil || revealed }

    var body: some View {
        VStack(spacing: 16) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(story.authorName).font(.headline)
                    if playback.expired || !story.isActive(at: Date()) {
                        ContentUnavailableView("Storia scaduta", systemImage: "clock")
                    } else {
                        if let warning = story.warning {
                            Text(warning).font(.headline)
                            Button(revealed ? "Nascondi storia" : "Mostra storia") {
                                revealed.toggle()
                                if !revealed { image = nil; playback = StoryPlayback() }
                            }.frame(minHeight: 44)
                        }
                        if allowed {
                            if !story.body.isEmpty { Text(story.body) }
                            if story.photo == nil {
                                Text("Questo allegato non è ancora disponibile nell’app.")
                            } else if let image {
                                Image(uiImage: image).resizable().scaledToFit()
                                    .accessibilityLabel(story.photo?.alt.isEmpty == false ? story.photo!.alt : "Foto della storia")
                                    .onLongPressGesture(minimumDuration: 0.1, pressing: { held = $0 }, perform: {})
                            } else if failed {
                                Button("Ricarica foto") { attempt += 1 }.frame(minHeight: 44)
                            } else { ProgressView("Caricamento foto…") }
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding()
            }
            VStack(spacing: 12) {
                ProgressView(value: playback.progress).accessibilityLabel("Tempo della storia")
                if voiceOver { Text("Avanza con i pulsanti quando hai finito di leggere.").font(.footnote) }
                HStack(spacing: 12) {
                    Button("Precedente", systemImage: "backward.end", action: previous)
                        .disabled(!canGoBack)
                        .frame(maxWidth: .infinity)
                    Button(paused ? "Riprendi" : "Pausa", systemImage: paused ? "play" : "pause") { paused.toggle() }
                        .frame(maxWidth: .infinity)
                    Button("Successiva", systemImage: "forward.end", action: next)
                        .frame(maxWidth: .infinity)
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.bordered)
                .controlSize(.large)
            }.padding()
        }
        .task(id: "\(revealed)-\(scenePhase == .active)-\(attempt)") {
            guard story.mayLoadPhoto(at: Date(), revealed: allowed, active: scenePhase == .active),
                  image == nil, let photo = story.photo else { return }
            failed = false
            do {
                let data = try await coordinator.image(path: photo.media_path)
                try Task.checkCancellation()
                guard story.isActive(at: Date()) else { image = nil; return }
                image = PhotoPreparation.thumbnail(data: data)
                failed = image == nil
            } catch is CancellationError { return }
            catch { failed = true }
        }
        .task(id: "\(scenePhase == .active)-\(voiceOver)") {
            guard scenePhase == .active else { return }
            var previousTime = ProcessInfo.processInfo.systemUptime
            while !Task.isCancelled {
                let time = ProcessInfo.processInfo.systemUptime
                let advance = playback.advance(by: time - previousTime, now: Date(), story: story,
                    ready: image != nil, revealed: allowed, paused: paused || held, active: true, voiceOver: voiceOver)
                previousTime = time
                if playback.expired { image = nil; return }
                if advance { next(); return }
                do { try await Task.sleep(for: .milliseconds(100)) } catch { return }
            }
        }
    }
}
