import SwiftUI
import PhotosUI

struct ComposePostView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var bodyText = ""
    @State private var alt = ""
    @State private var selection: PhotosPickerItem?
    @State private var jpeg: Data?
    @State private var uploadedPath: String?
    @State private var preparing = false
    @State private var sending = false
    @State private var error: String?
    @State private var uncertain = false
    @State private var confirmDiscard = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Cosa vuoi condividere?", text: $bodyText, axis: .vertical)
                        .lineLimit(5...12)
                    Text("\(bodyText.utf16.count)/2200").font(.caption).foregroundStyle(.secondary)
                }
                Section("Foto") {
                    PhotosPicker(selection: $selection, matching: .images) {
                        Label("Scegli una foto", systemImage: "photo")
                    }
                    if preparing { ProgressView("Preparazione della foto…") }
                    if let jpeg, let image = UIImage(data: jpeg) {
                        Image(uiImage: image).resizable().scaledToFit().accessibilityLabel("Foto selezionata")
                        TextField("Descrizione per chi usa VoiceOver", text: $alt, axis: .vertical)
                        Text("\(alt.utf16.count)/300").font(.caption).foregroundStyle(.secondary)
                        if alt.utf16.count > 300 {
                            Text("Accorcia la descrizione della foto a 300 caratteri per pubblicare.")
                                .font(.footnote).foregroundStyle(.red)
                        }
                        Button("Rimuovi foto", role: .destructive) {
                            self.jpeg = nil
                            selection = nil
                            uploadedPath = nil
                        }
                    }
                }
                Section {
                    Text("Il post seguirà la visibilità del tuo profilo.").font(.footnote).foregroundStyle(.secondary)
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
                        if bodyText.isEmpty && jpeg == nil { dismiss() }
                        else { confirmDiscard = true }
                    }.disabled(sending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Pubblica") { Task { await publish() } }
                        .disabled(sending || preparing || uncertain || bodyText.utf16.count > 2200 || alt.utf16.count > 300 || (bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && jpeg == nil))
                }
            }
            .interactiveDismissDisabled(sending || !bodyText.isEmpty || jpeg != nil)
            .confirmationDialog("Scartare questo post?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Scarta post", role: .destructive) { dismiss() }
            }
            .task(id: selection) { await preparePhoto() }
        }
    }

    private func preparePhoto() async {
        guard let selection else { return }
        preparing = true
        jpeg = nil
        uploadedPath = nil
        error = nil
        defer { preparing = false }
        do {
            guard let data = try await selection.loadTransferable(type: Data.self), data.count <= 32 * 1024 * 1024,
                  let image = PhotoPreparation.thumbnail(data: data),
                  let result = image.jpegData(compressionQuality: 0.8), result.count <= 3 * 1024 * 1024 else {
                error = "Non riesco a preparare questa foto entro 3 MB. Scegline un’altra."
                return
            }
            try Task.checkCancellation()
            jpeg = result
        } catch is CancellationError {
            return
        } catch { self.error = "Impossibile aprire la foto. Riprova a selezionarla." }
    }

    private func publish() async {
        guard !sending else { return }
        sending = true
        error = nil
        defer { sending = false }
        do {
            uploadedPath = try await coordinator.uploadPhoto(jpeg: jpeg, uploaded: uploadedPath)
        } catch {
            self.error = "Foto non caricata. Verifica la connessione USB e riprova."
            return
        }
        do {
            try await coordinator.sendPost(body: bodyText, alt: alt, path: uploadedPath)
            dismiss()
            await coordinator.probe()
        } catch let error as APIError {
            self.error = ErrorMessages.message(for: error)
            if case .server(let status, _, _) = error, (400..<500).contains(status) {} else { uncertain = true }
        } catch { uncertain = true }
    }
}
