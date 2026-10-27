import SwiftUI
import PhotosUI

struct ComposePostView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var draft = PostDraft()
    @State private var selection: PhotosPickerItem?
    @State private var photoTask: Task<Void, Never>?
    @State private var sending = false
    @State private var error: String?
    @State private var uncertain = false
    @State private var confirmDiscard = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Cosa vuoi condividere?", text: $draft.body, axis: .vertical)
                        .lineLimit(5...12)
                    Text("\(draft.body.utf16.count)/2200").font(.caption).foregroundStyle(.primary)
                }
                Section {
                    Toggle("Aggiungi un avviso sui contenuti", isOn: $draft.warningEnabled)
                    if draft.warningEnabled {
                        TextField("Argomento da segnalare", text: $draft.contentWarning, axis: .vertical)
                            .lineLimit(1...4)
                        Text("\(draft.warning.utf16.count)/160").font(.caption).foregroundStyle(.primary)
                        if draft.warning.isEmpty {
                            Text("Scrivi un breve avviso oppure disattivalo.")
                                .font(.footnote).foregroundStyle(.primary)
                        } else if draft.warning.utf16.count > 160 {
                            Text("Accorcia l’avviso a 160 caratteri per pubblicare.")
                                .font(.footnote).foregroundStyle(.red)
                        }
                    }
                } footer: {
                    if draft.warningEnabled {
                        Text("Nel feed testo e foto resteranno nascosti finché chi legge sceglierà Mostra contenuto.")
                    }
                }
                Section("Foto") {
                    PhotosPicker(selection: $selection, matching: .images) {
                        Label("Scegli una foto", systemImage: "photo")
                    }
                    if draft.preparing { ProgressView("Preparazione della foto…") }
                    if selection != nil && draft.jpeg == nil {
                        Button("Rimuovi foto", role: .destructive) { selection = nil }
                    }
                    if let jpeg = draft.jpeg, let image = UIImage(data: jpeg) {
                        Image(uiImage: image).resizable().scaledToFit().accessibilityLabel("Foto selezionata")
                        TextField("Descrizione per chi usa VoiceOver", text: $draft.alt, axis: .vertical)
                        Text("\(draft.alt.utf16.count)/300").font(.caption).foregroundStyle(.primary)
                        if draft.alt.utf16.count > 300 {
                            Text("Accorcia la descrizione della foto a 300 caratteri per pubblicare.")
                                .font(.footnote).foregroundStyle(.red)
                        }
                        Button("Rimuovi foto", role: .destructive) {
                            selection = nil
                        }
                    }
                }
                Section {
                    Text("Il post seguirà la visibilità del tuo profilo.").font(.footnote).foregroundStyle(.primary)
                    if let error { Text(error).foregroundStyle(.red) }
                    if sending { ProgressView("Pubblicazione…") }
                    if uncertain {
                        Text("L’esito dell’invio non è confermato. Chiudi e aggiorna il feed prima di pubblicare di nuovo, per evitare duplicati.")
                    }
                }
            }
            .disabled(sending || uncertain)
            .navigationTitle("Nuovo post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") {
                        if !draft.hasChanges { dismiss() }
                        else { confirmDiscard = true }
                    }.disabled(sending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Pubblica") { Task { await publish() } }
                        .disabled(sending || draft.preparing || uncertain || !draft.canPublish)
                }
            }
            .interactiveDismissDisabled(sending || draft.hasChanges)
            .confirmationDialog("Scartare questo post?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Scarta post", role: .destructive) { dismiss() }
            }
            .onChange(of: selection) { _, selected in
                photoTask?.cancel()
                let revision = draft.selectPhoto(present: selected != nil)
                error = nil
                guard let selected else { return }
                photoTask = Task { await preparePhoto(selected, revision: revision) }
            }
            .onDisappear { photoTask?.cancel() }
        }
    }

    private func preparePhoto(_ selected: PhotosPickerItem, revision: Int) async {
        do {
            guard let data = try await selected.loadTransferable(type: Data.self) else {
                throw PhotoPreparation.PreparationError.invalidImage
            }
            let result = try await PhotoPreparation.prepareJPEG(data: data)
            try Task.checkCancellation()
            draft.finishPhoto(result, revision: revision)
        } catch {
            guard !Task.isCancelled else { return }
            if draft.finishPhoto(nil, revision: revision) {
                self.error = "Non riesco a preparare questa foto entro 3 MB. Scegline un’altra."
            }
        }
    }

    private func publish() async {
        guard !sending, draft.canPublish else { return }
        sending = true
        error = nil
        defer { sending = false }
        do {
            draft.uploadedPath = try await coordinator.uploadPhoto(jpeg: draft.jpeg, uploaded: draft.uploadedPath)
        } catch {
            self.error = "Foto non caricata. Verifica la connessione e riprova."
            return
        }
        do {
            try await coordinator.sendPost(
                body: draft.body, alt: draft.alt, path: draft.uploadedPath,
                contentWarning: draft.warning
            )
            dismiss()
            await coordinator.probe()
        } catch let error as APIError {
            self.error = ErrorMessages.message(for: error)
            uncertain = error.mayHaveCommitted
        } catch { uncertain = true }
    }
}
