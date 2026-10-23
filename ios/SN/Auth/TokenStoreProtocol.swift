import Foundation

protocol TokenStore {
    func load() -> TokenPair?
    func save(_ tokens: TokenPair) throws
    func clear()
}

