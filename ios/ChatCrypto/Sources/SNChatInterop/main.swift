import Foundation
import SNChatCrypto

#if DEBUG
let report = try ChatInteropProbe.run()
FileHandle.standardOutput.write(report)
FileHandle.standardOutput.write(Data("\n".utf8))
#else
fatalError("Interoperability probe requires a debug build")
#endif
